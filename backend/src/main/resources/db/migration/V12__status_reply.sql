-- Status replies / reactions are delivered as normal chat messages that carry a
-- lightweight snapshot of the status they answer (so the quoted preview survives
-- the status's 24h expiry). All columns are nullable — ordinary messages leave
-- them empty.
ALTER TABLE messages
    ADD COLUMN status_ref_id BIGINT NULL,
    ADD COLUMN status_ref_type VARCHAR(10) NULL,
    ADD COLUMN status_ref_media_url VARCHAR(512) NULL,
    ADD COLUMN status_ref_caption VARCHAR(700) NULL,
    ADD COLUMN status_ref_bg_color VARCHAR(40) NULL;
