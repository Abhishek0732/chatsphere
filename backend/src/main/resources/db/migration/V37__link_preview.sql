-- Link previews (URL unfurl). Populated asynchronously AFTER a message is sent,
-- by a server-side fetch of the linked page's Open Graph tags. Stored right on the
-- message row so the read path attaches a preview with ZERO extra queries — the
-- columns are already loaded with the message. Only ever set for non-encrypted
-- messages (the server cannot read ciphertext, so it cannot unfurl a DM's links).
-- Nullable column adds are INSTANT in MySQL 8 (no rewrite of the messages table).
ALTER TABLE messages
    ADD COLUMN link_url   VARCHAR(1024) NULL,
    ADD COLUMN link_title VARCHAR(300)  NULL,
    ADD COLUMN link_desc  VARCHAR(600)  NULL,
    ADD COLUMN link_image VARCHAR(1024) NULL,
    ADD COLUMN link_site  VARCHAR(150)  NULL;
