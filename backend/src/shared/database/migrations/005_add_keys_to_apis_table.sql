-- Add name, public_key, and private_key columns to apis table
ALTER TABLE apis ADD COLUMN IF NOT EXISTS name VARCHAR(255) UNIQUE NOT NULL;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS public_key VARCHAR(512) NOT NULL;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS private_key VARCHAR(512) NOT NULL;

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_apis_name ON apis(name);

-- Create index on public_key for authentication lookups
CREATE INDEX IF NOT EXISTS idx_apis_public_key ON apis(public_key);
