-- Move the encryption key material OFF the `users` table.
--
-- V30 put the public key and the (password-wrapped) private key on `users`. That
-- was a mistake at scale: `users` is one of the hottest tables in the app — the
-- chat list, the send path and the notification fan-out all batch-load user rows —
-- and every one of those reads was dragging a TEXT blob nobody had asked for along
-- with it.
--
-- The keys are read in exactly two places: at login (my own) and when first
-- messaging someone (their public key). That is a different access pattern from
-- `users`, so it belongs in a different table.
CREATE TABLE user_keys (
    user_id         BIGINT       NOT NULL,
    public_key      VARCHAR(255) NOT NULL,
    enc_private_key TEXT         NOT NULL,
    enc_key_salt    VARCHAR(64)  NOT NULL,
    enc_key_iv      VARCHAR(64)  NOT NULL,
    key_version     INT          NOT NULL DEFAULT 1,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_keys_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

-- Carry across anyone who already has keys, so nobody loses their history.
INSERT INTO user_keys (user_id, public_key, enc_private_key, enc_key_salt, enc_key_iv, key_version)
SELECT id, public_key, enc_private_key, enc_key_salt, enc_key_iv, GREATEST(key_version, 1)
FROM users
WHERE public_key IS NOT NULL
  AND enc_private_key IS NOT NULL
  AND enc_key_salt IS NOT NULL
  AND enc_key_iv IS NOT NULL;

ALTER TABLE users
    DROP COLUMN public_key,
    DROP COLUMN enc_private_key,
    DROP COLUMN enc_key_salt,
    DROP COLUMN enc_key_iv,
    DROP COLUMN key_version;
