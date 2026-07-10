-- Password reset: short-lived, single-use tokens sent to a user's email.
-- Only a SHA-256 hash of the token is stored, so a DB leak can't be used to
-- reset accounts. Expired/used rows are harmless and can be swept periodically.
CREATE TABLE password_reset_tokens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,          -- SHA-256 hex of the raw token
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_prt_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_prt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
