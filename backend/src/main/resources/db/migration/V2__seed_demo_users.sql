-- Demo users for immediate testing. Password for all three is: password
-- (BCrypt hash below is the canonical Spring Security hash for "password".)
INSERT INTO users (username, email, password_hash, display_name, role, about) VALUES
  ('admin', 'admin@chatsphere.dev', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin',  'ADMIN', 'ChatSphere administrator'),
  ('alice', 'alice@chatsphere.dev', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Alice',  'USER',  'Hi, I am Alice'),
  ('bob',   'bob@chatsphere.dev',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Bob',    'USER',  'Hi, I am Bob');
