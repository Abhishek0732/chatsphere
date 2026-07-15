-- Reciprocal privacy toggles, WhatsApp-style. Both default ON so existing
-- behaviour is unchanged until a user explicitly opts out.
--
--   read_receipts_enabled  When OFF, this user neither sends read receipts nor
--                          sees anyone else's (enforced for DIRECT chats; group
--                          read receipts are always on, as in WhatsApp).
--   last_seen_enabled      When OFF, this user's last-seen / online is hidden
--                          from others AND theirs is hidden from this user.
ALTER TABLE users
    ADD COLUMN read_receipts_enabled TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN last_seen_enabled     TINYINT(1) NOT NULL DEFAULT 1;
