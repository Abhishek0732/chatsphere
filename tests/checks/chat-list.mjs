/**
 * The chat list — the first screen anyone sees. It must carry the last message
 * and an unread badge, and it must come back fast: this one endpoint used to do
 * a fistful of queries PER conversation.
 */
import { get, post, assert, assertEqual, assertStatus, waitFor, RUN_ID } from '../lib/api.mjs';
import { sendMessage } from '../lib/stomp.mjs';

export const area = 'chat list';

const BUDGET_MS = 500;

export const checks = [
  {
    name: `GET /conversations carries last message + unread count, in < ${BUDGET_MS}ms`,
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const bob = await ctx.stompFor('bob');

      // Bob says something alice hasn't read — that is what an unread badge is.
      const content = `e2e unread ${RUN_ID}`;
      sendMessage(bob, convId, content, `tmp-unread-${RUN_ID}`);

      const summary = await waitFor(
        async () => {
          const res = await get('/conversations', { token: ctx.alice.token });
          assertStatus(res, 200, 'GET /conversations');
          const c = res.body.find((x) => x.id === convId);
          return c?.lastMessage?.content === content ? c : null;
        },
        { what: "bob's message to surface as the last message in alice's chat list" },
      );

      assert(summary.lastMessage != null, 'chat list entry has no lastMessage');
      assertEqual(summary.lastMessage.content, content, 'last message content');
      assertEqual(summary.lastMessage.senderId, ctx.bob.user.id, 'last message senderId');
      assert(
        typeof summary.unreadCount === 'number' && summary.unreadCount >= 1,
        `unread count should be at least 1 for a message alice hasn't read, got ${summary.unreadCount}`,
      );
      assert(summary.name, 'chat list entry has no name');

      // Time a clean call (the one above raced an async counter update).
      const timedRes = await get('/conversations', { token: ctx.alice.token });
      assertStatus(timedRes, 200, 'GET /conversations (timed)');
      ctx.note(`${Math.round(timedRes.ms)}ms, ${timedRes.body.length} conversations`);
      assert(
        timedRes.ms < BUDGET_MS,
        `chat list took ${Math.round(timedRes.ms)}ms, budget is ${BUDGET_MS}ms`,
      );

      // Leave the badge as we found it, and bin the message we sent.
      ctx.trash.messages.push({ conversationId: convId, messageId: summary.lastMessage.id, as: 'bob' });
      ctx.trash.after.push(async () => {
        await post(`/conversations/${convId}/read`, { token: ctx.alice.token });
      });
    },
  },
];
