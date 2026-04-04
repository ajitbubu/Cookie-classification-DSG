-- ML Feedback Cleanup
-- Purpose: Align ml_feedback schema with ML classification migration
-- Created: 2026-01-31

-- Preserve existing table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ml_feedback'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ml_feedback_legacy'
    ) THEN
        ALTER TABLE ml_feedback RENAME TO ml_feedback_legacy;
    END IF;
END $$;

-- Create new ml_feedback table with updated schema
CREATE TABLE IF NOT EXISTS ml_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cookie_id UUID NOT NULL REFERENCES cookies(id) ON DELETE CASCADE,
    classification_id UUID REFERENCES ml_classifications(id) ON DELETE SET NULL,

    -- Correction
    predicted_label VARCHAR(50) NOT NULL,
    corrected_label VARCHAR(50) NOT NULL CHECK (corrected_label IN (
        'Strictly Necessary', 'Analytics', 'Marketing', 'Functional', 'Unknown'
    )),
    confidence_score FLOAT NOT NULL,

    -- User context
    user_id UUID,
    feedback_note TEXT,

    -- Bulk application
    applied_to_similar BOOLEAN DEFAULT false,
    similar_cookies_count INTEGER DEFAULT 0,
    similar_cookie_ids JSONB,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    used_in_training BOOLEAN DEFAULT false,

    -- Constraints
    CONSTRAINT chk_different_labels CHECK (predicted_label != corrected_label)
);

-- Backfill scan_jobs for legacy feedback rows (if any)
INSERT INTO scan_jobs (id, scan_id, start_url, status, created_at)
SELECT
    gen_random_uuid(),
    scan_id,
    'legacy_feedback',
    'completed',
    COALESCE(created_at, NOW())
FROM ml_feedback_legacy mf
WHERE NOT EXISTS (
    SELECT 1
    FROM scan_jobs s
    WHERE s.scan_id = mf.scan_id
);

-- Backfill cookies for legacy feedback rows (if any)
INSERT INTO cookies (id, scan_id, name, domain, category, created_at)
SELECT
    gen_random_uuid(),
    scan_id,
    cookie_name,
    cookie_domain,
    corrected_category,
    COALESCE(created_at, NOW())
FROM ml_feedback_legacy mf
WHERE NOT EXISTS (
    SELECT 1
    FROM cookies c
    WHERE c.scan_id = mf.scan_id
      AND c.name = mf.cookie_name
      AND (c.domain = mf.cookie_domain OR (c.domain IS NULL AND mf.cookie_domain IS NULL))
);

-- Migrate legacy feedback into new schema
INSERT INTO ml_feedback (
    cookie_id,
    classification_id,
    predicted_label,
    corrected_label,
    confidence_score,
    user_id,
    feedback_note,
    applied_to_similar,
    similar_cookies_count,
    similar_cookie_ids,
    created_at,
    used_in_training
)
SELECT
    c.id AS cookie_id,
    NULL AS classification_id,
    CASE
        WHEN mf.predicted_category IN ('Strictly Necessary','Analytics','Marketing','Functional','Unknown')
            THEN mf.predicted_category
        WHEN mf.predicted_category = 'Necessary' THEN 'Strictly Necessary'
        WHEN mf.predicted_category IN ('Unclassified','Uncategorized') THEN 'Unknown'
        ELSE COALESCE(mf.predicted_category, mf.corrected_category, 'Unknown')
    END AS predicted_label,
    CASE
        WHEN mf.corrected_category IN ('Strictly Necessary','Analytics','Marketing','Functional','Unknown')
            THEN mf.corrected_category
        WHEN mf.corrected_category = 'Necessary' THEN 'Strictly Necessary'
        WHEN mf.corrected_category IN ('Unclassified','Uncategorized') THEN 'Unknown'
        ELSE COALESCE(mf.corrected_category, 'Unknown')
    END AS corrected_label,
    COALESCE(mf.ml_confidence, 0.0) AS confidence_score,
    CASE
        WHEN mf.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN mf.user_id::uuid
        ELSE NULL
    END AS user_id,
    NULL AS feedback_note,
    false AS applied_to_similar,
    0 AS similar_cookies_count,
    NULL AS similar_cookie_ids,
    COALESCE(mf.created_at, NOW()) AS created_at,
    false AS used_in_training
FROM ml_feedback_legacy mf
JOIN cookies c
  ON c.scan_id = mf.scan_id
 AND c.name = mf.cookie_name
 AND (c.domain = mf.cookie_domain OR (c.domain IS NULL AND mf.cookie_domain IS NULL));

-- Indexes for ml_feedback
CREATE INDEX IF NOT EXISTS idx_ml_feedback_cookie_id ON ml_feedback(cookie_id);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_created_at ON ml_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_used_in_training ON ml_feedback(used_in_training);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_classification_id ON ml_feedback(classification_id);

-- Drop legacy table after successful migration
DROP TABLE IF EXISTS ml_feedback_legacy;
