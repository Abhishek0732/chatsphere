-- Being @mentioned in someone's status lets you add that status to your own
-- (WhatsApp does exactly this). A re-shared status is a normal row that remembers
-- where it came from, so it can be attributed to the original author and can
-- outlive the original.
--
-- No foreign key on original_status_id on purpose: the source expires after 24h
-- and may be deleted by its author, and neither event should take down the copy.
ALTER TABLE statuses
    ADD COLUMN original_status_id BIGINT NULL,
    ADD COLUMN original_user_id   BIGINT NULL;

-- The only lookup we make: "has this user already added that status?"
CREATE INDEX idx_status_repost ON statuses (user_id, original_status_id);
