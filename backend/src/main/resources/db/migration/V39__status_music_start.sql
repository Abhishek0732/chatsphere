-- Where in the track the status's music starts (ms). Lets a poster scrub a longer
-- song (e.g. their own uploaded audio) to the part they want, instead of always
-- from 0. NULL / 0 means play from the beginning, as before.
ALTER TABLE statuses ADD COLUMN music_start_ms INT NULL;
