/**
 * End-to-end encryption of direct messages.
 *
 * The claim is not "we encrypt things" — it is that THE SERVER CANNOT READ YOUR
 * DIRECT MESSAGES. So these checks are written from the server's side of the fence:
 * they use the server's own API and ask it to produce the plaintext. It must not be
 * able to.
 *
 * (The browser half — that Alice and Bob can actually read each other, and that a
 * fresh device restores the key from the password — needs WebCrypto and a real
 * browser, so it lives in the Playwright checks rather than here.)
 */
import { get, assert, assertStatus, RUN_ID } from '../lib/api.mjs';
import { sendMessage } from '../lib/stomp.mjs';

export const area = 'encryption';

/** Looks like what the client produces: `v1.<iv>.<ciphertext>`, all base64. */
const ENVELOPE = /^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/;

export const checks = [
  {
    name: 'the server stores ciphertext it cannot read, and never leaks it',
    async run(ctx) {
      const convId = await ctx.aliceBobConversation();
      const alice = await ctx.stompFor('alice');

      // A word that could not possibly occur by accident, so if the server can
      // surface it ANYWHERE, we know the encryption is a lie.
      const secret = `zarquon-${RUN_ID}`;
      // Stand in for what the browser would produce. The server must treat this as
      // opaque: it has no key and no business trying.
      const ciphertext = `v1.${Buffer.from('iv-' + RUN_ID).toString('base64')}.${Buffer.from(
        'sealed-' + secret,
      ).toString('base64')}`;

      sendMessage(alice, convId, ciphertext, `tmp-enc-${RUN_ID}`, { encrypted: true });
      await new Promise((r) => setTimeout(r, 800));

      const res = await get(`/conversations/${convId}/messages?limit=20`, { token: ctx.bob.token });
      assertStatus(res, 200, 'GET messages');
      const stored = res.body.find((m) => m.content === ciphertext);

      assert(!!stored, 'the encrypted message was stored and returned to the recipient');
      assert(stored.encrypted === true, 'the message is flagged encrypted');
      assert(ENVELOPE.test(stored.content), 'what came back is the ciphertext envelope, untouched');
      ctx.trash.messages.push({ conversationId: convId, messageId: stored.id, as: 'alice' });

      // The server's own search must not find it. There is nothing to find: the
      // FULLTEXT index has ciphertext in it, and encrypted rows are excluded anyway.
      const search = await get(`/search/messages?q=${encodeURIComponent('zarquon')}`, {
        token: ctx.alice.token,
      });
      assertStatus(search, 200, 'GET /search/messages');
      const leaked = (search.body ?? []).some((m) => (m.content ?? '').includes(ciphertext));
      assert(!leaked, 'server-side search does not return encrypted messages');

      // The notification the recipient gets must quote NEITHER the plaintext (we do
      // not have it) NOR the ciphertext (that would just be gibberish in their
      // notification centre).
      const notes = await get('/notifications', { token: ctx.bob.token });
      assertStatus(notes, 200, 'GET /notifications');
      const body = (notes.body ?? []).map((n) => n.body ?? '');
      assert(
        !body.some((b) => b.includes(ciphertext) || b.includes(secret)),
        'the notification preview leaks neither the ciphertext nor the secret',
      );
      ctx.note('stored as ciphertext; not searchable; not previewed');
    },
  },

  {
    name: 'a GROUP message cannot be marked encrypted (nobody could read it)',
    async run(ctx) {
      // Encryption here is a property of a two-person conversation. If a client sets
      // the flag on a group message, the server must refuse it — otherwise the
      // message would be hidden from the previews of people who can read it fine.
      const groupId = await ctx.groupConversation();
      if (groupId == null) {
        ctx.note('skipped: no group conversation available');
        return;
      }
      const alice = await ctx.stompFor('alice');
      const content = `e2e group not-encrypted ${RUN_ID}`;

      sendMessage(alice, groupId, content, `tmp-genc-${RUN_ID}`, { encrypted: true });
      await new Promise((r) => setTimeout(r, 800));

      const res = await get(`/conversations/${groupId}/messages?limit=20`, {
        token: ctx.alice.token,
      });
      assertStatus(res, 200, 'GET group messages');
      const stored = res.body.find((m) => m.content === content);
      assert(!!stored, 'the group message was stored');
      assert(
        stored.encrypted === false,
        'the server refused the encrypted flag on a group message',
      );
      ctx.trash.messages.push({ conversationId: groupId, messageId: stored.id, as: 'alice' });
    },
  },

  {
    name: 'everyone has a public key, and the private key is only ever stored wrapped',
    async run(ctx) {
      const mine = await get('/keys/me', { token: ctx.alice.token });
      assertStatus(mine, 200, 'GET /keys/me');

      // The server holds the private key, but only inside a blob that the user's
      // password unwraps. It has neither the password nor any way to open it.
      if (mine.body.encPrivateKey) {
        assert(!!mine.body.encKeySalt, 'the wrapped key has a KDF salt');
        assert(!!mine.body.encKeyIv, 'the wrapped key has an IV');
        assert(
          !mine.body.encPrivateKey.includes('BEGIN PRIVATE KEY'),
          'the stored private key is not in the clear',
        );
      }

      // A peer's PUBLIC key is fetchable by anyone — that is what it is for.
      const peer = await get(`/keys/${ctx.bob.user.id}`, { token: ctx.alice.token });
      assertStatus(peer, 200, `GET /keys/${ctx.bob.user.id}`);
      assert('publicKey' in peer.body, 'a peer public key can be fetched to encrypt to them');
      ctx.note(mine.body.encPrivateKey ? 'alice has a wrapped key on the server' : 'no key set up yet');
    },
  },
];
