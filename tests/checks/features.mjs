/**
 * The five features added on top of the base app:
 *   1. large media    — the upload cap actually moved (100 MB)
 *   2. catch-up sync  — GET /api/sync returns everything past a watermark, in order
 *   3. privacy toggles — read receipts + last-seen are reciprocal and server-enforced
 *   4. reactions       — a full-picker (multi-codepoint) emoji round-trips intact
 *   5. disappearing    — a per-conversation timer stamps expires_at and is broadcast
 *
 * All against the REAL API + STOMP, no mocks.
 */
import { get, post, put, assert, assertEqual, assertStatus, waitFor, RUN_ID } from '../lib/api.mjs';
import { sendMessage } from '../lib/stomp.mjs';

export const area = 'features';

const QUEUE = '/user/queue/messages';
const UPDATED = '/user/queue/message-updated';

async function persisted(token, conversationId, limit = 100) {
  const res = await get(`/conversations/${conversationId}/messages?limit=${limit}`, { token });
  assertStatus(res, 200, `GET messages for conversation ${conversationId}`);
  return res.body;
}

export const checks = [
  {
    name: 'large media: the upload limit is 100 MB (multipart cap moved off 25 MB)',
    async run() {
      // A 40 MB body would have been rejected at the old 25 MB cap. We don't push a
      // real 40 MB file through the suite; we prove the ceiling moved by sending a
      // body just over the OLD cap and asserting it is NOT a 413. (An empty-part
      // 400 is fine — what must never happen again is "payload too large".)
      const bytes = 30 * 1024 * 1024; // 30 MB — over the old 25 MB, under the new 100 MB
      const filler = Buffer.alloc(bytes, 0x41);
      const auth = await (await import('../lib/api.mjs')).login('alice', 'password');
      const form = new FormData();
      form.append('file', new Blob([filler], { type: 'application/octet-stream' }), 'big.bin');
      const res = await fetch(`${(await import('../lib/api.mjs')).API_URL}/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        body: form,
      });
      assert(res.status !== 413, `30 MB upload was rejected as too large (413) — cap did not move`);
      assert(res.status < 500, `30 MB upload 5xx'd (status ${res.status})`);
    },
  },

  {
    name: 'catch-up sync: /api/sync returns everything past the watermark, in order',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      const tag = `${RUN_ID}-sync`;
      sendMessage(alice, convId, `sync A ${tag}`, `tmp-${tag}-a`);
      const echoA = await alice.waitForFrame(QUEUE, (m) => m.content === `sync A ${tag}`);
      sendMessage(alice, convId, `sync B ${tag}`, `tmp-${tag}-b`);
      const echoB = await alice.waitForFrame(QUEUE, (m) => m.content === `sync B ${tag}`);

      // Ask for everything strictly newer than A. B must be in, A must be out.
      const res = await waitFor(
        async () => {
          const r = await get(`/sync?since=${echoA.id}`, { token: ctx.alice.token });
          assertStatus(r, 200, 'GET /api/sync');
          return r.body.some((m) => m.id === echoB.id) ? r : null;
        },
        { what: 'the catch-up sync to return the newer message' },
      );
      const ids = res.body.map((m) => m.id);
      assert(!ids.includes(echoA.id), 'sync leaked a message at/under the watermark');
      const ascending = [...ids].sort((a, b) => a - b);
      assert(ids.every((id, i) => id === ascending[i]), 'sync results were not in ascending id order');
      assert(ids.every((id) => id > echoA.id), 'sync returned an id not strictly past the watermark');

      ctx.trash.messages.push({ conversationId: convId, messageId: echoA.id, as: 'alice' });
      ctx.trash.messages.push({ conversationId: convId, messageId: echoB.id, as: 'alice' });
    },
  },

  {
    name: 'read receipts are reciprocal: turning mine off hides the blue tick from me',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      const tag = `${RUN_ID}-rr`;
      sendMessage(alice, convId, `rr ${tag}`, `tmp-${tag}`);
      const echo = await alice.waitForFrame(QUEUE, (m) => m.content === `rr ${tag}`);

      // Bob reads up to the newest message.
      const bobRead = await post(`/conversations/${convId}/read`, { token: ctx.bob.token });
      assertStatus(bobRead, 204, 'bob marks the conversation read');

      // With read receipts ON, alice sees her message as READ.
      await waitFor(
        async () => {
          const rows = await persisted(ctx.alice.token, convId);
          const m = rows.find((x) => x.id === echo.id);
          return m && m.status === 'READ' ? m : null;
        },
        { what: "alice's message to show READ while receipts are on" },
      );

      try {
        // Alice turns her read receipts OFF.
        const off = await put('/users/me', { token: ctx.alice.token, body: { readReceiptsEnabled: false } });
        assertStatus(off, 200, 'disable alice read receipts');
        assertEqual(off.body.readReceiptsEnabled, false, 'alice readReceiptsEnabled after disable');

        // Now the SAME message must read back as SENT — she opted out of the receipt.
        const rows = await persisted(ctx.alice.token, convId);
        const m = rows.find((x) => x.id === echo.id);
        assertEqual(m.status, 'SENT', 'alice message status with her read receipts off');
      } finally {
        // Restore, so the demo account is left as it was found.
        await put('/users/me', { token: ctx.alice.token, body: { readReceiptsEnabled: true } });
      }
      ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
    },
  },

  {
    name: 'last-seen is reciprocal: hiding mine hides everyone’s from me',
    async run(ctx) {
      // With last-seen ON, alice can see bob's presence fields (online is non-null).
      const onView = await get(`/users/${ctx.bob.user.id}`, { token: ctx.alice.token });
      assertStatus(onView, 200, "GET bob as alice (last-seen on)");
      assert(onView.body.online !== null && onView.body.online !== undefined,
        'presence should be visible while alice shares last-seen');

      try {
        const off = await put('/users/me', { token: ctx.alice.token, body: { lastSeenEnabled: false } });
        assertStatus(off, 200, 'disable alice last-seen');
        assertEqual(off.body.lastSeenEnabled, false, 'alice lastSeenEnabled after disable');

        // Reciprocity: now alice can't see bob's presence either.
        const offView = await get(`/users/${ctx.bob.user.id}`, { token: ctx.alice.token });
        assertStatus(offView, 200, 'GET bob as alice (last-seen off)');
        assert(offView.body.online === null || offView.body.online === undefined,
          "bob's presence should be hidden once alice hides her own");
      } finally {
        await put('/users/me', { token: ctx.alice.token, body: { lastSeenEnabled: true } });
      }
    },
  },

  {
    name: 'reactions: a multi-codepoint emoji (family) round-trips intact (VARCHAR widened)',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');
      const bob = await ctx.stompFor('bob');
      alice.subscribe(UPDATED);

      const tag = `${RUN_ID}-react`;
      sendMessage(alice, convId, `react ${tag}`, `tmp-${tag}`);
      const echo = await alice.waitForFrame(QUEUE, (m) => m.content === `react ${tag}`);

      // 👨‍👩‍👧‍👦 is 7 code points / 11 UTF-16 units — it would have been truncated to a
      // broken glyph by the old VARCHAR(16). Bob reacts; alice gets the update.
      const family = '👨‍👩‍👧‍👦';
      bob.publish('/app/chat.react', { conversationId: convId, messageId: echo.id, emoji: family });

      const updated = await alice.waitForFrame(
        UPDATED,
        (m) => m.id === echo.id && (m.reactions ?? []).some((r) => r.emoji === family),
      );
      const reaction = updated.reactions.find((r) => r.emoji === family);
      assertEqual(reaction.emoji, family, 'the stored emoji matches what was sent (not truncated)');

      // Toggle it back off to leave the message clean, then bin it.
      bob.publish('/app/chat.react', { conversationId: convId, messageId: echo.id, emoji: family });
      ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
    },
  },

  {
    name: 'report user: a report is accepted (204); self-report is rejected (400)',
    async run(ctx) {
      const ok = await post(`/reports/${ctx.bob.user.id}`, {
        token: ctx.alice.token,
        body: { reason: 'spam', details: `e2e ${RUN_ID}` },
      });
      assertStatus(ok, 204, 'alice reports bob');

      const self = await post(`/reports/${ctx.alice.user.id}`, {
        token: ctx.alice.token,
        body: { reason: 'spam' },
      });
      assertStatus(self, 400, 'a user cannot report themselves');
    },
  },

  {
    name: 'view-once: opens exactly once, then the media is gone server-side',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      const tag = `${RUN_ID}-vo`;
      const url = `/media/chatsphere-media/uploads/${tag}.jpg`;
      // Send a view-once IMAGE straight over STOMP (the suite has no e2ee, so this
      // is an unencrypted direct message — view-once still applies).
      alice.publish('/app/chat.send', {
        conversationId: convId,
        content: `vo ${tag}`,
        type: 'IMAGE',
        attachmentUrl: url,
        tempId: `tmp-${tag}`,
        viewOnce: true,
      });
      const echo = await alice.waitForFrame(QUEUE, (m) => m.content === `vo ${tag}`);
      assertEqual(echo.viewOnce, true, 'the echo carries the view-once flag');
      assertEqual(echo.viewOnceSeen, false, 'a fresh view-once is not yet seen');
      assert(echo.attachmentUrl, 'view-once media has a url before it is opened');

      // Bob opens it — this burns it.
      const opened = await post(`/conversations/${convId}/messages/${echo.id}/view-once`, {
        token: ctx.bob.token,
      });
      assertStatus(opened, 200, 'bob opens the view-once message');
      assertEqual(opened.body.viewOnceSeen, true, 'view-once reads as seen once opened');
      assert(!opened.body.attachmentUrl, 'the media url is gone the instant it is opened');

      // Alice (the sender) now reads it back as opened, media gone.
      const rows = await persisted(ctx.alice.token, convId);
      const m = rows.find((x) => x.id === echo.id);
      assertEqual(m.viewOnceSeen, true, 'the sender sees it flipped to opened');
      assert(!m.attachmentUrl, 'the sender no longer sees the media url either');

      // Opening again is idempotent — still seen, no error.
      const again = await post(`/conversations/${convId}/messages/${echo.id}/view-once`, {
        token: ctx.bob.token,
      });
      assertStatus(again, 200, 're-opening a spent view-once is a harmless no-op');

      ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
    },
  },

  {
    name: 'link preview: an internal (localhost) URL is never unfurled — SSRF blocked',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      const tag = `${RUN_ID}-ssrf`;
      // A URL pointing at our own network must never be fetched by the unfurler.
      sendMessage(alice, convId, `look http://localhost:9000/secret ${tag}`, `tmp-${tag}`);
      const echo = await alice.waitForFrame(QUEUE, (m) => (m.content ?? '').includes(tag));

      // Give the async unfurl a moment; a blocked URL must produce no preview, ever.
      await new Promise((r) => setTimeout(r, 1500));
      const rows = await persisted(ctx.alice.token, convId);
      const m = rows.find((x) => x.id === echo.id);
      assert(!m.linkPreview, 'a localhost/internal URL must never be unfurled');

      ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
    },
  },

  {
    name: 'disappearing messages: timer stamps expires_at, is broadcast, and clears',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');
      const bob = await ctx.stompFor('bob');
      bob.subscribe(`/topic/conversations/${convId}/disappearing`);

      try {
        // Alice turns on a 24h timer.
        const on = await post(`/conversations/${convId}/disappearing`, {
          token: ctx.alice.token,
          body: { ttlSeconds: 86400 },
        });
        assertStatus(on, 204, 'set disappearing timer');

        // Bob is told over STOMP.
        const evt = await bob.waitForFrame(
          `/topic/conversations/${convId}/disappearing`,
          (e) => e.conversationId === convId,
        );
        assertEqual(evt.ttlSeconds, 86400, 'broadcast ttlSeconds');

        // The conversation summary now carries the timer.
        const list = await get('/conversations', { token: ctx.alice.token });
        const conv = list.body.find((c) => c.id === convId);
        assertEqual(conv.disappearingTtlSeconds, 86400, 'summary disappearingTtlSeconds');

        // A new message is stamped with an expires_at roughly 24h out.
        const tag = `${RUN_ID}-disap`;
        sendMessage(alice, convId, `disap ${tag}`, `tmp-${tag}`);
        const echo = await alice.waitForFrame(QUEUE, (m) => m.content === `disap ${tag}`);
        const rows = await persisted(ctx.alice.token, convId);
        const m = rows.find((x) => x.id === echo.id);
        assert(m.expiresAt, 'a message in a disappearing chat has no expiresAt');
        const ttlMs = Date.parse(m.expiresAt) - Date.parse(m.createdAt);
        assert(Math.abs(ttlMs - 86400_000) < 60_000, `expires_at is ~24h out (got ${ttlMs}ms)`);
        ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
      } finally {
        // Turn it back off and confirm a fresh message is no longer stamped.
        await post(`/conversations/${convId}/disappearing`, {
          token: ctx.alice.token,
          body: { ttlSeconds: null },
        });
        const tag = `${RUN_ID}-nodisap`;
        sendMessage(alice, convId, `nodisap ${tag}`, `tmp-${tag}`);
        const echo = await alice.waitForFrame(QUEUE, (m) => m.content === `nodisap ${tag}`);
        const rows = await persisted(ctx.alice.token, convId);
        const m = rows.find((x) => x.id === echo.id);
        assert(!m.expiresAt, 'a message sent after the timer was cleared still got an expiresAt');
        ctx.trash.messages.push({ conversationId: convId, messageId: echo.id, as: 'alice' });
      }
    },
  },
];
