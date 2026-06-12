CREATE TABLE IF NOT EXISTS request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID REFERENCES apis(id) ON DELETE SET NULL,
  ip_id UUID REFERENCES ips(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  status_code INT NOT NULL,
  occurred_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_logs_api_id ON request_logs(api_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_occurred_at ON request_logs(occurred_at DESC);
