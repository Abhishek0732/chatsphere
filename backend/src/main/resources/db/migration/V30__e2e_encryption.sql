-- End-to-end encryption for DIRECT chats.
--
-- The server stops being able to read direct messages. It stores ciphertext and
-- hands it to the recipient, and that is all it can do with it.
--
-- Each user has an ECDH key pair. The PUBLIC key is public — anyone who wants to
-- message you needs it. The PRIVATE key never leaves the browser in the clear: it
-- is encrypted there with a key derived from the user's password (PBKDF2), and only
-- that blob is stored here. The server never sees the password, so it can never
-- unwrap the key — but the user can, on any device they log in to.
ALTER TABLE users
    -- Raw ECDH P-256 public point, base64url. Safe to hand to anyone.
    ADD COLUMN public_key         VARCHAR(255) NULL,
    -- The private key, encrypted with the user's password. Opaque to us.
    ADD COLUMN enc_private_key    TEXT         NULL,
    -- PBKDF2 salt + AES-GCM IV for the blob above. Not secrets; needed to unwrap.
    ADD COLUMN enc_key_salt       VARCHAR(64)  NULL,
    ADD COLUMN enc_key_iv         VARCHAR(64)  NULL,
    -- Bumped whenever the key pair is REPLACED (e.g. after a password reset, where
    -- the old private key is unrecoverable). Lets a client notice that a peer's key
    -- changed rather than silently failing to decrypt.
    ADD COLUMN key_version        INT          NOT NULL DEFAULT 0;

-- Is this message's content ciphertext?
--
-- Existing messages stay 0 (plaintext) — turning encryption on cannot retroactively
-- make old history unreadable. Every read path checks this: search skips encrypted
-- rows (there is nothing to match), and notification/push previews say "sent you a
-- message" instead of leaking the text they can no longer read anyway.
ALTER TABLE messages
    ADD COLUMN encrypted TINYINT(1) NOT NULL DEFAULT 0;
