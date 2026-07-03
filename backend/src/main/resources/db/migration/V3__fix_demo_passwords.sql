-- Corrects the demo users' password hash to a valid BCrypt hash for "password".
UPDATE users
SET password_hash = '$2y$10$14GCyirDAI/xOR2FSW4Yv.wMgRCEMrIwVE5Y7QoYFPPNceLFbfjQO'
WHERE username IN ('admin', 'alice', 'bob');
