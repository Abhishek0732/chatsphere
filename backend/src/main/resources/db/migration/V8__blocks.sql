-- User blocking: when A blocks B, B's messages are no longer delivered to A
-- (live or in history) until A unblocks B. One-directional; A can still be
-- reached by others normally.
CREATE TABLE blocks (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    blocker_id BIGINT   NOT NULL,
    blocked_id BIGINT   NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_block         UNIQUE (blocker_id, blocked_id),
    CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_block_blocker (blocker_id),
    INDEX idx_block_blocked (blocked_id)
);
