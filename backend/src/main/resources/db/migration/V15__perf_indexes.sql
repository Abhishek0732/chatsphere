-- Performance indexes for the hottest read paths.
--
-- The existing indexes lead with a column that sits BEFORE the ordering column
-- (e.g. messages has (conversation_id, created_at) but every hot query orders/
-- ranges by id), which forces a filesort. These composites let the ordered
-- range scans be served straight from the index. All additive + online-safe.

-- Message history paging / last-message / unread-count all filter by
-- conversation_id and order/range by id.
CREATE INDEX idx_msg_conv_id ON messages (conversation_id, id);

-- Notification panel reads the latest N by id for a user.
CREATE INDEX idx_notif_user_id ON notifications (user_id, id);

-- Status feed prunes expired rows per user; let both be served from one index.
CREATE INDEX idx_status_user_expires ON statuses (user_id, expires_at);
