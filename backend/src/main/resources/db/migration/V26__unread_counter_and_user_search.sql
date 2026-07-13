-- ── 1. Stop counting unread messages on every chat-list load ────────────────
-- Counting is proportional to how many unread messages you have, per chat: for a
-- user with 350 active conversations that was ~260ms of the ~325ms the chat list
-- took. The count is now kept on the membership row and maintained on write, so
-- the list reads it for free from a row it has already loaded.
ALTER TABLE conversation_members ADD COLUMN unread_count INT NOT NULL DEFAULT 0;

UPDATE conversation_members cm
SET unread_count = (
    SELECT COUNT(*) FROM messages m
    WHERE m.conversation_id = cm.conversation_id
      AND m.deleted = 0
      AND m.sender_id <> cm.user_id
      AND m.id > GREATEST(COALESCE(cm.last_read_message_id, 0),
                          COALESCE(cm.cleared_up_to_message_id, 0))
);

-- ── 2. Directory search was a full scan of every user ───────────────────────
-- LIKE '%q%' has a leading wildcard, so no B-tree index can serve it: every
-- search read all 100k+ user rows. This lets it use MATCH ... AGAINST instead.
CREATE FULLTEXT INDEX ft_users_search ON users (username, display_name, email);

-- Prefix search ("jo" -> "John") for queries too short for FULLTEXT. Without this
-- the display_name half of the OR was a full scan.
CREATE INDEX idx_users_display_name ON users (display_name);
