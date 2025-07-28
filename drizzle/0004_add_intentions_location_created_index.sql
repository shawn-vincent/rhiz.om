-- Add index for efficient timestamp-based intention queries
-- Required for ultra-minimal sync system catch-up functionality
CREATE INDEX IF NOT EXISTS intentions_location_created_idx ON rhiz_om_intentions(location_id, created_at);