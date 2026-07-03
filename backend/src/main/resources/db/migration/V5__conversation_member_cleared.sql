-- Per-user "delete chat": each member can clear a conversation for themselves.
-- Messages up to (and including) this id are hidden from that member, and the
-- conversation disappears from their list until a newer message arrives.
ALTER TABLE conversation_members
    ADD COLUMN cleared_up_to_message_id BIGINT NULL;
