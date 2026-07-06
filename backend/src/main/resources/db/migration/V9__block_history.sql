-- Keep block history so messages sent DURING a block stay hidden even after
-- unblocking (WhatsApp-style). A row is "active" while unblocked_at IS NULL;
-- unblocking stamps unblocked_at instead of deleting the row. A pair can be
-- blocked/unblocked repeatedly, so the (blocker, blocked) uniqueness is dropped.
ALTER TABLE blocks DROP INDEX uq_block;
ALTER TABLE blocks ADD COLUMN unblocked_at DATETIME NULL;
