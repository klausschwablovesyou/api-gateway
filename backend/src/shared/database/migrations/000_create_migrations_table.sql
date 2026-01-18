-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  app VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT migrations_app_name_unique UNIQUE (app, name)
);

-- Create index for faster lookups by app
CREATE INDEX IF NOT EXISTS idx_migrations_app ON migrations(app);
