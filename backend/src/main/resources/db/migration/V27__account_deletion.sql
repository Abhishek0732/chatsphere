-- Account deletion.
--
-- The user row is NOT dropped: messages.sender_id is ON DELETE CASCADE, so
-- removing it would erase every message this person ever sent from OTHER
-- people's conversations — their chat history would come apart because of
-- someone else's decision. Instead the account is closed and the person is
-- anonymised: they can never sign in again, their personal data is wiped, and
-- their old messages simply show as "Deleted user".
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;

-- Every "is this account still live" check filters on it.
CREATE INDEX idx_users_deleted_at ON users (deleted_at);
