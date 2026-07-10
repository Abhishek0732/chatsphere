-- Rotatable QR token: scanning a user's code adds them instantly (no request/
-- accept). Rotating the token invalidates any previously shared/leaked QR image.
ALTER TABLE users ADD COLUMN qr_token VARCHAR(64) NULL;
UPDATE users SET qr_token = REPLACE(UUID(), '-', '') WHERE qr_token IS NULL;
ALTER TABLE users MODIFY qr_token VARCHAR(64) NOT NULL;
ALTER TABLE users ADD CONSTRAINT uq_users_qr_token UNIQUE (qr_token);
