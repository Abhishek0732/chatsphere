-- @mentions in a status: the tagged user ids, stored on the row as a CSV so the
-- feed renders them without an extra join per status.
ALTER TABLE statuses ADD COLUMN mentions VARCHAR(512) NULL;
