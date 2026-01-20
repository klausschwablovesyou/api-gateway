-- Create request_limit_unit enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_limit_unit') THEN
    CREATE TYPE request_limit_unit AS ENUM ('second', 'minute', 'hour', 'day');
  END IF;
END $$;

-- Create apis table
CREATE TABLE IF NOT EXISTS apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url VARCHAR(2048) NOT NULL,
  request_limit INTEGER NOT NULL,
  request_limit_unit request_limit_unit NOT NULL
);

-- Create index on api_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_apis_api_url ON apis(api_url);
