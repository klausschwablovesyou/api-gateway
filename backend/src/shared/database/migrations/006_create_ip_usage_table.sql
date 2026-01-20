-- Remove used_at column from ips table
ALTER TABLE ips DROP COLUMN IF EXISTS used_at;

-- Drop the used_at index if it exists
DROP INDEX IF EXISTS idx_ips_used_at;

-- Create ip_usage table
CREATE TABLE IF NOT EXISTS ip_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_id UUID NOT NULL REFERENCES ips(id) ON DELETE CASCADE,
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  last_used_at BIGINT NOT NULL
);

-- Create index on ip_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_ip_usage_ip_id ON ip_usage(ip_id);

-- Create index on api_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_ip_usage_api_id ON ip_usage(api_id);

-- Create index on last_used_at for range queries
CREATE INDEX IF NOT EXISTS idx_ip_usage_last_used_at ON ip_usage(last_used_at);

-- Create unique constraint for ip_id and api_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_usage_ip_api_unique ON ip_usage(ip_id, api_id);
