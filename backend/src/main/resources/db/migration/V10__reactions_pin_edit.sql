-- Message reactions (emoji), pinning, and edit tracking.
CREATE TABLE message_reactions (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT      NOT NULL,
    user_id    BIGINT      NOT NULL,
    emoji      VARCHAR(16) NOT NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reaction UNIQUE (message_id, user_id, emoji),
    CONSTRAINT fk_reaction_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
    CONSTRAINT fk_reaction_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    INDEX idx_reaction_message (message_id)
);

ALTER TABLE messages ADD COLUMN pinned    BOOLEAN  NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL;
