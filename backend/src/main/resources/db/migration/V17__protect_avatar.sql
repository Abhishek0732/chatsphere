-- Privacy: when enabled, other clients apply download/screenshot deterrents to
-- this user's profile picture. Defaults off so existing users are unaffected.
ALTER TABLE users
    ADD COLUMN protect_avatar BOOLEAN NOT NULL DEFAULT FALSE;
