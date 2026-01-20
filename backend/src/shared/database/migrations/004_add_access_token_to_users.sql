-- Add access_token column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'access_token'
  ) THEN
    ALTER TABLE users ADD COLUMN access_token TEXT;
  END IF;
END $$;

-- Create index on access_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_access_token ON users(access_token);
