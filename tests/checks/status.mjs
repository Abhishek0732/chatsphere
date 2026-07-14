/**
 * Status: @mentions, and "add this to my status".
 *
 * The permission is the whole feature: ONLY someone the author @mentioned may
 * re-share the status, the copy stays CREDITED to the author, and nobody can add
 * the same thing twice. A viewer who wasn't tagged must be told so (canAdd:false)
 * AND actually refused by the server (403) — a client-side-only check would let
 * anyone re-share a status they were never offered.
 */
import { get, post, del, assert, assertEqual, assertStatus, RUN_ID } from '../lib/api.mjs';
import { ensureUser } from '../lib/signup.mjs';

export const area = 'status';

/** alice can only @mention people who are her CONTACTS (StatusService.encodeMentions). */
async function ensureContact(ownerToken, ownerId, targetToken, targetId) {
  const mine = await get('/contacts', { token: ownerToken });
  assertStatus(mine, 200, 'GET /contacts');
  if (mine.body.some((c) => c.user?.id === targetId)) return;

  const sent = await post('/contacts', { token: ownerToken, body: { contactUserId: targetId } });
  assertStatus(sent, 200, 'send a contact request');
  if (sent.body.status === 'PENDING') {
    const incoming = await get('/contacts/requests', { token: targetToken });
    assertStatus(incoming, 200, 'GET /contacts/requests');
    const req = incoming.body.find((r) => r.user?.id === ownerId);
    assert(req, 'the contact request never reached the recipient');
    const accepted = await post(`/contacts/requests/${req.id}/accept`, { token: targetToken });
    assertStatus(accepted, 204, 'accept the contact request');
  }
  const after = await get('/contacts', { token: ownerToken });
  assert(after.body.some((c) => c.user?.id === targetId), 'the contact was never actually added');
}

/** Find a status item in someone's feed. */
function itemInFeed(feed, ownerId, statusId) {
  const owner = feed.find((u) => u.user?.id === ownerId);
  return owner?.items?.find((i) => i.id === statusId) ?? null;
}

export const checks = [
  {
    name: 'a mentioned user can add a status; a bystander gets canAdd:false and a 403',
    async run(ctx) {
      // bob must be a contact of alice's, or the mention is dropped on the floor.
      await ensureContact(ctx.alice.token, ctx.alice.user.id, ctx.bob.token, ctx.bob.user.id);

      // Someone who can SEE alice's status but was NOT tagged in it. A shared
      // conversation is what puts alice in their feed at all.
      const bystander = await ensureUser({ username: 'e2e_bystander', displayName: 'E2E Bystander' });
      const conv = await post('/conversations/direct', {
        token: bystander.accessToken,
        body: { targetUserId: ctx.alice.user.id },
      });
      assertStatus(conv, 200, 'bystander opens a direct chat with alice (so they share a feed)');

      // ── alice posts a status mentioning bob ──
      const caption = `e2e status ${RUN_ID} — hey @${ctx.bob.user.displayName}!`;
      const created = await post('/status', {
        token: ctx.alice.token,
        body: { type: 'TEXT', caption, bgColor: '#075E54', mentions: [ctx.bob.user.id] },
      });
      assertStatus(created, 200, 'alice posts a status');
      const statusId = created.body.id;
      ctx.trash.after.push(() => del(`/status/${statusId}`, { token: ctx.alice.token }));

      assert(
        (created.body.mentions ?? []).some((m) => m.id === ctx.bob.user.id),
        'bob was not recorded as mentioned on the status',
      );

      // ── bob, who was mentioned, is offered it ──
      const bobFeed = await get('/status', { token: ctx.bob.token });
      assertStatus(bobFeed, 200, "GET /status (bob's feed)");
      const bobsView = itemInFeed(bobFeed.body, ctx.alice.user.id, statusId);
      assert(bobsView, "alice's status never appeared in bob's feed");
      assertEqual(bobsView.canAdd, true, 'canAdd for the user who WAS mentioned');

      // ── the bystander, who wasn't, is not ──
      const byFeed = await get('/status', { token: bystander.accessToken });
      assertStatus(byFeed, 200, "GET /status (bystander's feed)");
      const bysView = itemInFeed(byFeed.body, ctx.alice.user.id, statusId);
      assert(bysView, "alice's status never appeared in the bystander's feed");
      assertEqual(bysView.canAdd, false, 'canAdd for a user who was NOT mentioned');

      // ...and the server enforces it, not just the UI.
      const forbidden = await post(`/status/${statusId}/add`, { token: bystander.accessToken });
      assertStatus(forbidden, 403, 'a NON-mentioned user adding the status to theirs');

      // ── bob adds it; the copy is credited to alice ──
      const added = await post(`/status/${statusId}/add`, { token: ctx.bob.token });
      assertStatus(added, 200, 'the mentioned user adds the status');
      const copyId = added.body.id;
      ctx.trash.after.push(() => del(`/status/${copyId}`, { token: ctx.bob.token }));

      assert(copyId !== statusId, 'adding a status must create a copy, not hand back the original');
      assert(added.body.originalUser, 'the copy has no originalUser — the author lost their credit');
      assertEqual(added.body.originalUser.id, ctx.alice.user.id, 'the copy is credited to');
      assertEqual(added.body.caption, caption, "the copy's caption");

      // ── and it cannot be added twice ──
      const again = await post(`/status/${statusId}/add`, { token: ctx.bob.token });
      assertStatus(again, 400, 'adding the same status a SECOND time');

      // The feed now says so too.
      const bobFeed2 = await get('/status', { token: ctx.bob.token });
      const bobsView2 = itemInFeed(bobFeed2.body, ctx.alice.user.id, statusId);
      assertEqual(bobsView2?.canAdd, false, 'canAdd after bob has already added it');

      ctx.note(`status ${statusId} → copy ${copyId}, credited to alice`);
    },
  },
];
