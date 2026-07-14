/**
 * The core of the product: a message alice sends must reach bob live, and it
 * must still be there afterwards.
 *
 * The 20-message burst is not a load test — it is a REGRESSION test. Sending
 * used to take the conversation's row lock, and two people (or one person typing
 * fast) could deadlock; the send transaction rolled back and the message was
 * SILENTLY LOST. Nobody saw an error. So: send 20, then assert all 20 are on
 * disk. Zero loss, explicitly.
 */
import { get, assert, assertEqual, assertStatus, waitFor, RUN_ID } from '../lib/api.mjs';
import { sendMessage } from '../lib/stomp.mjs';

export const area = 'messaging';

const QUEUE = '/user/queue/messages';

/** Every message currently persisted in a conversation (paging past the default 30). */
async function persisted(token, conversationId, limit = 100) {
  const res = await get(`/conversations/${conversationId}/messages?limit=${limit}`, { token });
  assertStatus(res, 200, `GET messages for conversation ${conversationId}`);
  return res.body;
}

export const checks = [
  {
    name: 'alice → bob: delivered live over STOMP, persisted, echo keeps the tempId',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');
      const bob = await ctx.stompFor('bob');

      const nonce = `${RUN_ID}-solo`;
      const content = `e2e hello ${nonce}`;
      const tempId = `tmp-${nonce}`;

      sendMessage(alice, convId, content, tempId);

      // 1. bob gets it live, on the queue the app actually uses.
      const delivered = await bob.waitForFrame(QUEUE, (m) => m.content === content);
      assertEqual(delivered.conversationId, convId, 'delivered message conversationId');
      assertEqual(delivered.senderId, ctx.alice.user.id, 'delivered message senderId');

      // 2. the sender's echo carries the SAME tempId — that is what lets the UI
      //    reconcile its optimistic bubble instead of showing the message twice.
      const echo = await alice.waitForFrame(QUEUE, (m) => m.content === content);
      assertEqual(echo.tempId, tempId, "sender's echo tempId");
      assert(echo.id > 0, 'echo carries no server-assigned id');

      // 3. it is on disk, not just in flight.
      const rows = await waitFor(
        async () => {
          const all = await persisted(ctx.alice.token, convId);
          return all.find((m) => m.content === content) ? all : null;
        },
        { what: 'the message to be readable back from the API' },
      );
      const stored = rows.find((m) => m.content === content);
      assertEqual(stored.id, echo.id, 'persisted message id vs the id in the echo');

      ctx.trash.messages.push({ conversationId: convId, messageId: stored.id, as: 'alice' });
    },
  },

  {
    name: '20 rapid messages: all 20 persist, none silently lost',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      const N = 20;
      const nonce = `${RUN_ID}-burst`;
      const contents = Array.from({ length: N }, (_, i) => `e2e burst ${nonce} #${i + 1}`);

      // Fire them off back to back, no waiting in between — this is the shape of
      // the traffic that used to deadlock.
      const started = performance.now();
      contents.forEach((content, i) => sendMessage(alice, convId, content, `tmp-${nonce}-${i + 1}`));

      /** Whatever has landed so far — kept outside the try so cleanup can see it. */
      let landed = [];
      const poll = async () => {
        const all = await persisted(ctx.alice.token, convId, 200);
        const byContent = new Map(all.map((m) => [m.content, m]));
        landed = contents.filter((c) => byContent.has(c)).map((c) => byContent.get(c));
        return landed.length === N;
      };

      try {
        try {
          await waitFor(poll, {
            timeoutMs: 20_000,
            intervalMs: 200,
            what: `all ${N} messages to persist`,
          });
        } catch {
          // Don't report a timeout — report the DATA LOSS, which is the real fault.
          const stored = new Set(landed.map((m) => m.content));
          const missing = contents.filter((c) => !stored.has(c));
          throw new Error(
            `MESSAGE LOSS: only ${landed.length}/${N} of the burst persisted — ` +
              `${missing.length} message(s) were accepted and never stored. ` +
              `First missing: ${JSON.stringify(missing[0])}`,
          );
        }
        const elapsed = Math.round(performance.now() - started);

        assertEqual(landed.length, N, `messages persisted out of ${N} sent`);
        assertEqual(new Set(landed.map((m) => m.id)).size, N, 'distinct persisted message ids');
        ctx.note(`all ${N} persisted in ${elapsed}ms`);
      } finally {
        // Bin them whether we passed or failed — a red run must not leave 20
        // messages behind for the next one to trip over.
        for (const m of landed) {
          ctx.trash.messages.push({ conversationId: convId, messageId: m.id, as: 'alice' });
        }
      }
    },
  },
];
