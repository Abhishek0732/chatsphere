-- Per-user "delete chat": remove a conversation from THIS member's list without
-- touching the other participant. Distinct from cleared_up_to_message_id (which
-- only hides old messages but keeps the row in the list): once hidden, the whole
-- conversation drops off this member's list until a NEWER message arrives, at
-- which point it resurfaces automatically (last_message_id climbs past this id).
--
-- "Delete for everyone" sets this (and the cleared floor) for every member at
-- once and broadcasts a removal event; "delete for me" sets it for one member.
ALTER TABLE conversation_members
    ADD COLUMN hidden_up_to_message_id BIGINT NULL;
