-- 1. Truncate users table (Destructive migration - no live users exist)
TRUNCATE TABLE users CASCADE;

-- 2. Drop password_hash entirely (passwords managed by Auth0)
ALTER TABLE users DROP COLUMN password_hash;

-- 3. Add columns to map to the external identity provider
ALTER TABLE users ADD COLUMN external_id VARCHAR(255) NOT NULL UNIQUE;
ALTER TABLE users ADD COLUMN external_provider VARCHAR(50) NOT NULL;

-- 4. Create index for fast lookups during token verification
CREATE INDEX idx_users_external_id ON users(external_id);
