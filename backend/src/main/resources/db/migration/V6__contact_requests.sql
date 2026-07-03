-- Contact invitations: adding a user no longer creates a contact directly.
-- A PENDING request is sent to the recipient; only on ACCEPT are (mutual)
-- contacts created. Declined/accepted requests are kept for history.
CREATE TABLE contact_requests (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id    BIGINT       NOT NULL,
    recipient_id BIGINT       NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME     NULL,
    CONSTRAINT fk_cr_sender    FOREIGN KEY (sender_id)    REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_cr_recipient (recipient_id, status),
    INDEX idx_cr_sender (sender_id, status)
);
