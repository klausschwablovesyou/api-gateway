-- Create ips table
CREATE TABLE IF NOT EXISTS ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip VARCHAR(45) NOT NULL,
  used_at BIGINT NOT NULL
);

-- Create index on ip for faster lookups
CREATE INDEX IF NOT EXISTS idx_ips_ip ON ips(ip);

-- Create index on used_at for range queries
CREATE INDEX IF NOT EXISTS idx_ips_used_at ON ips(used_at);
