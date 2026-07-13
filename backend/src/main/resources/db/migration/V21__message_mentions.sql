-- @mentions: the user ids tagged in a message, stored on the row as a CSV so the
-- thread renders them without an extra join/query per message.
ALTER TABLE messages ADD COLUMN mentions VARCHAR(512) NULL;
