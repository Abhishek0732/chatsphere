-- Second performance-index pass (pre-launch). Targets hot queries the audit
-- found doing partial index scans or filesorts at lakh-scale.

-- Media / docs gallery: findAttachmentsByType filters (conversation_id, type)
-- then ranges by id. Without type in the index every message in the conv is
-- scanned. This lets it seek straight to (conv, IMAGE/FILE) and range by id.
CREATE INDEX idx_msg_conv_type_id ON messages (conversation_id, type, id);

-- Missed-call badge: countByCalleeIdAndStatus — no index led with (callee_id,
-- status). Read on every Calls-tab open.
CREATE INDEX idx_calls_callee_status ON calls (callee_id, status);

-- Contact list: findByOwnerIdOrderByIdDesc filtered owner_id but sorted by id,
-- which the (owner_id, contact_user_id) unique index can't satisfy -> filesort.
CREATE INDEX idx_contacts_owner_id ON contacts (owner_id, id);

-- Pinned-messages panel: filter (conversation_id, pinned) then order by id.
CREATE INDEX idx_msg_conv_pinned_id ON messages (conversation_id, pinned, id);
