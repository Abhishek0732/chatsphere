-- Richer music metadata for statuses: title/artist (from the in-app music
-- library or a device upload) and the track length, so the story viewer can
-- size the timeline without waiting on audio metadata.
ALTER TABLE statuses
    ADD COLUMN music_title VARCHAR(200) NULL AFTER music_url,
    ADD COLUMN music_artist VARCHAR(200) NULL AFTER music_title,
    ADD COLUMN music_duration_ms INT NULL AFTER music_artist;
