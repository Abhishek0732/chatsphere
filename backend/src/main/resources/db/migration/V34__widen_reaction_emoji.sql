-- Reactions moved from a fixed 6-emoji bar to a full picker. A picked emoji can
-- be a multi-codepoint ZWJ sequence (a family emoji is 7 code points, a flag is
-- 2); VARCHAR(16) truncated those into a different, broken glyph. 32 is ample.
ALTER TABLE message_reactions MODIFY COLUMN emoji VARCHAR(32) NOT NULL;
