-- View-once media: a photo/video/file that opens exactly once for the recipient,
-- then is gone. `view_once_seen_at` is stamped when the recipient opens it; at the
-- same moment the stored object is deleted and the URL is nulled server-side, so it
-- can never be served again. Adding nullable/defaulted columns is an INSTANT
-- metadata change in MySQL 8 — no table rewrite on the messages table.
ALTER TABLE messages
    ADD COLUMN view_once         BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN view_once_seen_at DATETIME(3) NULL;
