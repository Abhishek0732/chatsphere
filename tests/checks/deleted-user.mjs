/**
 * Someone deletes their account — and it must not take the app down with them.
 *
 * This actually happened: the deleted person's DIRECT conversation stayed in the
 * other person's list, the counterpart could no longer be resolved, and the chat
 * list returned a conversation with a NULL name. The client rendered the name
 * directly, so the whole chat list — every conversation, not just this one —
 * blew up for anyone who had ever spoken to them.
 *
 * So: register a throwaway, chat with alice, delete the throwaway, and check
 * that alice's app still works.
 */
import { get, post, del, assert, assertEqual, assertStatus, waitFor, RUN_ID } from '../lib/api.mjs';
import { registerUser } from '../lib/signup.mjs';
import { connectChatUser, sendMessage } from '../lib/stomp.mjs';

export const area = 'deleted user';

const QUEUE = '/user/queue/messages';

export const checks = [
  {
    name: "deleting an account leaves the other person's app working",
    async run(ctx) {
      // ── a throwaway person, who chats with alice ──
      const ghost = await registerUser({ prefix: 'e2edel' });
      const ghostToken = ghost.accessToken;

      const convRes = await post('/conversations/direct', {
        token: ghostToken,
        body: { targetUserId: ctx.alice.user.id },
      });
      assertStatus(convRes, 200, 'throwaway opens a direct chat with alice');
      const convId = convRes.body.id;

      const ghostSocket = await connectChatUser(ghostToken, 'ghost');
      const alice = await ctx.stompFor('alice');
      try {
        const content = `e2e from-the-doomed ${RUN_ID}`;
        sendMessage(ghostSocket, convId, content, `tmp-ghost-${RUN_ID}`);
        await alice.waitForFrame(QUEUE, (m) => m.content === content);
      } finally {
        await ghostSocket.disconnect();
      }

      // ── they delete their account (which needs their password) ──
      const wrongPw = await del('/users/me', {
        token: ghostToken,
        body: { password: 'not-my-password' },
      });
      assertStatus(wrongPw, 400, 'account deletion with the wrong password');

      const deleted = await del('/users/me', {
        token: ghostToken,
        body: { password: ghost.password },
      });
      assertStatus(deleted, 204, 'DELETE /users/me');

      // ── 1. alice's chat list STILL LOADS. This is the bug. ──
      const list = await get('/conversations', { token: ctx.alice.token });
      assertStatus(list, 200, "alice's chat list after the other person deleted their account");
      assert(Array.isArray(list.body), 'chat list is not a list');

      // ── 2. the orphaned conversation has a real name, never null ──
      const orphan = list.body.find((c) => c.id === convId);
      assert(orphan, `the conversation with the deleted user vanished from alice's list (id ${convId})`);
      assert(
        orphan.name != null,
        'the conversation with a deleted user has a NULL name — this is what crashed the chat list',
      );
      assertEqual(orphan.name, 'Deleted user', 'name of a conversation with a deleted account');

      // Every other conversation must still be intact too — a null name anywhere
      // takes the same screen down.
      const nameless = list.body.filter((c) => c.name == null);
      assertEqual(nameless.length, 0, 'conversations in the list with a null name');

      // ── 3. opening the chat still works, and the history survived ──
      const history = await get(`/conversations/${convId}/messages?limit=50`, { token: ctx.alice.token });
      assertStatus(history, 200, 'opening the chat with a deleted user');
      assert(
        history.body.some((m) => m.senderId === ghost.user.id),
        "the deleted person's messages were destroyed — they must stay in alice's history",
      );

      // ── 4. alice can no longer SEND to them ──
      const before = history.body.length;
      const doomed = `e2e should-never-land ${RUN_ID}`;
      sendMessage(alice, convId, doomed, `tmp-doomed-${RUN_ID}`);
      await alice.expectNoFrame(QUEUE, (m) => m.content === doomed, 2500);

      const after = await get(`/conversations/${convId}/messages?limit=50`, { token: ctx.alice.token });
      assertStatus(after, 200, 'messages after trying to send to a deleted user');
      assert(
        !after.body.some((m) => m.content === doomed),
        'a message to a DELETED account was accepted and stored — it must be refused',
      );
      assertEqual(after.body.length, before, 'message count after a send that should have been refused');

      // ── 5. and they can never sign in again ──
      const relogin = await post('/auth/login', {
        body: { usernameOrEmail: ghost.user.username, password: ghost.password },
      });
      assertStatus(relogin, 401, 'signing in to a deleted account');

      ctx.note(`throwaway ${ghost.user.username} (id ${ghost.user.id}) deleted; alice unaffected`);
    },
  },
];
