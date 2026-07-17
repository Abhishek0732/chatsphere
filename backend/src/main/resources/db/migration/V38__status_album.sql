-- Multiple photos/videos picked at once become ONE status "frame" (an album).
-- The ordered list of {url,type} items is stored as JSON here, alongside the
-- existing single media_url — which stays the primary (first) item so status
-- reply snapshots, reposts and chat-list previews keep working unchanged.
-- NULL means a plain single-media (or text) status, as before.
ALTER TABLE statuses ADD COLUMN media_json TEXT NULL;
