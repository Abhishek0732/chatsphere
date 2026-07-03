-- Support replying to a specific message.
ALTER TABLE messages
    ADD COLUMN reply_to_message_id BIGINT NULL AFTER attachment_url;

ALTER TABLE messages
    ADD CONSTRAINT fk_msg_reply
        FOREIGN KEY (reply_to_message_id) REFERENCES messages (id) ON DELETE SET NULL;
