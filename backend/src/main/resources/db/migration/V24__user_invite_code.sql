-- Short "add me" invite code (e.g. /i/7Kd9QaB2). Unlike the QR token, this is
-- shared as a plain link with people, so it is deliberately short and carries
-- no meaning on its own — it is only a lookup key, resolved server-side.
ALTER TABLE users ADD COLUMN invite_code VARCHAR(16) NULL;
CREATE UNIQUE INDEX uq_users_invite_code ON users (invite_code);
