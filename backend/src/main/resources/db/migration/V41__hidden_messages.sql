-- Per-user "delete message for me": a single message hidden from ONE member's
-- view without affecting anyone else (distinct from the shared "delete for
-- everyone" tombstone on the messages table). A row here means "this user no
-- longer sees this message". No FK on purpose — an orphaned row (message soft-
-- deleted, account removed) simply never matches and is harmless, and skipping
-- the constraint keeps inserts lock-free on the hot send/read path.
CREATE TABLE hidden_messages (
    user_id    BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, message_id)
);
