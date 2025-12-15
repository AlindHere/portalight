-- Add GitHub-related fields to users table

-- Modify role check constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'lead', 'dev'));

-- Add GitHub-specific fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Change avatar from VARCHAR(10) to TEXT to support URLs
ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;

-- Make email nullable for GitHub users who keep their email private
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Create index for GitHub lookups
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_github_username ON users(github_username);
