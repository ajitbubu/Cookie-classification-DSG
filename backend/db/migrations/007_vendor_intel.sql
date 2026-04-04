-- Vendor Intelligence Schema + Cookie Pattern Enhancements
-- Purpose: Normalize vendor intelligence sources, enable domain pattern matching,
--          and store rich metadata for vendor/cookie enrichment.
-- Created: 2026-01-31

-- ============================================================================
-- Enhance cookie_patterns for source/metadata + domain matching
-- ============================================================================
ALTER TABLE cookie_patterns
    ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) NOT NULL DEFAULT 'name',
    ADD COLUMN IF NOT EXISTS source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Replace unique constraint on pattern with (pattern, match_type)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'cookie_patterns'
          AND constraint_name = 'cookie_patterns_pattern_key'
    ) THEN
        ALTER TABLE cookie_patterns DROP CONSTRAINT cookie_patterns_pattern_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'cookie_patterns'
          AND constraint_name = 'cookie_patterns_pattern_match_type_key'
    ) THEN
        ALTER TABLE cookie_patterns
            ADD CONSTRAINT cookie_patterns_pattern_match_type_key
            UNIQUE (pattern, match_type);
    END IF;
END $$;

-- Validate match_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'cookie_patterns'
          AND constraint_name = 'cookie_patterns_match_type_check'
    ) THEN
        ALTER TABLE cookie_patterns
            ADD CONSTRAINT cookie_patterns_match_type_check
            CHECK (match_type IN ('name', 'domain'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pattern_match_type ON cookie_patterns(match_type);
CREATE INDEX IF NOT EXISTS idx_pattern_source ON cookie_patterns(source);
CREATE INDEX IF NOT EXISTS idx_pattern_metadata ON cookie_patterns USING GIN(metadata);

-- ============================================================================
-- Vendor Intelligence Sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_intel_sources (
    source_key VARCHAR(50) PRIMARY KEY,
    source_name VARCHAR(255) NOT NULL,
    source_url TEXT,
    license TEXT,
    usage_constraints TEXT,
    last_fetched_at TIMESTAMP,
    last_updated_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Vendor Intelligence Records
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(50) NOT NULL REFERENCES vendor_intel_sources(source_key),

    vendor_id TEXT,
    vendor_name TEXT,
    domain TEXT,

    category_raw TEXT,
    category_base TEXT,
    category_v6 TEXT,
    purposes JSONB,
    confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    metadata JSONB,
    raw JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT vendor_intel_unique_source_vendor_domain
        UNIQUE (source_key, vendor_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_vendor_intel_source ON vendor_intel(source_key);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_domain ON vendor_intel(domain);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_vendor_name ON vendor_intel(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_category_base ON vendor_intel(category_base);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_category_v6 ON vendor_intel(category_v6);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_metadata ON vendor_intel USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_vendor_intel_raw ON vendor_intel USING GIN(raw);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_vendor_intel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_vendor_intel_updated_at'
    ) THEN
        CREATE TRIGGER trg_vendor_intel_updated_at
            BEFORE UPDATE ON vendor_intel
            FOR EACH ROW
            EXECUTE FUNCTION update_vendor_intel_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_vendor_intel_sources_updated_at'
    ) THEN
        CREATE TRIGGER trg_vendor_intel_sources_updated_at
            BEFORE UPDATE ON vendor_intel_sources
            FOR EACH ROW
            EXECUTE FUNCTION update_vendor_intel_updated_at();
    END IF;
END $$;

