-- Pre-launch scale pass. Measured on a seeded 100k-user / 2M-message database:
-- the chat list took >40s (it never loaded); after this migration + the query
-- changes that go with it, it is a few milliseconds.

-- ── 1. The chat list no longer derives "latest message per conversation" ──
-- That query was `id IN (SELECT MAX(id) ... GROUP BY conversation_id)`, which
-- MySQL cannot execute well: >40s for a user with 350 conversations. The last
-- message is now denormalised onto the conversation and maintained on write.
ALTER TABLE conversations ADD COLUMN last_message_id BIGINT NULL;

UPDATE conversations c
SET last_message_id = (
    SELECT MAX(m.id) FROM messages m
    WHERE m.conversation_id = c.id AND m.deleted = 0
);

-- ── 2. The single hottest index in the schema ──
-- `deleted` and `sender_id` are in the WHERE of every hot message query but were
-- in no index, so every candidate row was fetched from the clustered index only
-- to be thrown away. This makes the unread-count and page queries index-only.
CREATE INDEX idx_msg_conv_del_id_sender ON messages (conversation_id, deleted, id, sender_id);

-- Dead weight on the highest-write table: no query filters or orders by
-- created_at (they all use id), so this index only cost us on every INSERT.
DROP INDEX idx_msg_conv_created ON messages;

-- ── 3. Blocks: checked on EVERY message send and every chat-list load ──
-- Both queries filter on `unblocked_at IS NULL`, which was in neither index, so
-- MySQL row-looked-up every historical block row to test it. These are covering.
CREATE INDEX idx_block_blocker_active ON blocks (blocker_id, unblocked_at, blocked_id);
CREATE INDEX idx_block_blocked_active ON blocks (blocked_id, unblocked_at, blocker_id);

-- ── 4. Status feed: "which of these statuses have I already seen" ──
CREATE INDEX idx_sv_viewer_status ON status_views (viewer_id, status_id);

-- ── 5. Call log ordered by id, but the indexes were on created_at ──
-- so every call-log load did an index-merge + filesort over the user's history.
CREATE INDEX idx_calls_caller_id ON calls (caller_id, id);
CREATE INDEX idx_calls_callee_id ON calls (callee_id, id);

-- ── 6. Filesorts on bounded sets: sort column was missing from the index ──
CREATE INDEX idx_cr_recipient_status_id ON contact_requests (recipient_id, status, id);
CREATE INDEX idx_cr_sender_status_id ON contact_requests (sender_id, status, id);
CREATE INDEX idx_group_invite_invitee_status_id ON group_invites (invitee_id, status, id);

-- ── 7. Retention sweeps need to find old rows without a full scan ──
CREATE INDEX idx_notif_created ON notifications (created_at);
