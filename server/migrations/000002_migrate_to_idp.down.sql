-- 1. Drop index
DROP INDEX IF EXISTS idx_users_external_id;

-- 2. Drop columns
ALTER TABLE users DROP COLUMN IF EXISTS external_provider;
ALTER TABLE users DROP COLUMN IF EXISTS external_id;

-- 3. Add password_hash back (with default for existing rows)
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
