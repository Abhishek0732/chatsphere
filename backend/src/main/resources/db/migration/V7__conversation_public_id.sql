-- Opaque, unguessable public identifier for conversations.
-- The numeric primary key stays internal; the URL/API-facing id is this token,
-- so conversation ids can no longer be enumerated by incrementing a number.
ALTER TABLE conversations ADD COLUMN public_id VARCHAR(24) NULL;

-- Backfill existing rows with an opaque per-row token. UUID() guarantees the
-- input is unique per row; SHA2 makes the emitted token look random (not the
-- time-ordered structure of a raw UUID).
UPDATE conversations
SET public_id = SUBSTRING(SHA2(CONCAT(id, '-', UUID(), '-', RAND()), 256), 1, 20)
WHERE public_id IS NULL;

ALTER TABLE conversations MODIFY public_id VARCHAR(24) NOT NULL;
ALTER TABLE conversations ADD CONSTRAINT uq_conversations_public_id UNIQUE (public_id);
