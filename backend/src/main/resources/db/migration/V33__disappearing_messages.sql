-- Per-conversation disappearing-message timer (NULL = off). When a conversation
-- has a TTL, every new message is stamped with expires_at = now + ttl and is
-- swept once that passes. The client also hides expired messages immediately,
-- so they vanish from view before the sweep hard-deletes the row.
ALTER TABLE conversations
    ADD COLUMN disappearing_ttl_seconds INT NULL;

ALTER TABLE messages
    ADD COLUMN expires_at DATETIME(3) NULL;

-- The sweep deletes by expires_at over a 2M-row table, so this must be a range
-- scan, never a full scan. Most rows are NULL (non-disappearing) and MySQL keeps
-- NULLs out of the hot part of the range, so the index stays small.
CREATE INDEX idx_msg_expires ON messages (expires_at);
