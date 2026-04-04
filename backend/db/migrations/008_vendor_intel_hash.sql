-- Vendor Intelligence Hash Key
-- Purpose: avoid oversized unique index on (source_key, vendor_id, domain)
-- Created: 2026-01-31

-- Add hash key column
ALTER TABLE vendor_intel
    ADD COLUMN IF NOT EXISTS vendor_key_hash TEXT;

-- Backfill existing rows
UPDATE vendor_intel
SET vendor_key_hash = md5(
    COALESCE(source_key, '') || '|' ||
    COALESCE(vendor_id, '') || '|' ||
    COALESCE(domain, '')
)
WHERE vendor_key_hash IS NULL;

-- Remove duplicates before adding unique constraint
DELETE FROM vendor_intel a
USING vendor_intel b
WHERE a.vendor_key_hash = b.vendor_key_hash
  AND a.id > b.id;

-- Drop oversized unique constraint if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'vendor_intel'
          AND constraint_name = 'vendor_intel_unique_source_vendor_domain'
    ) THEN
        ALTER TABLE vendor_intel
            DROP CONSTRAINT vendor_intel_unique_source_vendor_domain;
    END IF;
END $$;

-- Add unique constraint on hash
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'vendor_intel'
          AND constraint_name = 'vendor_intel_vendor_key_hash_key'
    ) THEN
        ALTER TABLE vendor_intel
            ADD CONSTRAINT vendor_intel_vendor_key_hash_key
            UNIQUE (vendor_key_hash);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_intel_key_hash ON vendor_intel(vendor_key_hash);
