-- ML Classification Schema Migration
-- Version: 1.0.0
-- Description: Add tables for ML-based cookie classification system

-- ============================================================================
-- Table: ml_classifications
-- Purpose: Store ML classification results with confidence scores and explanations
-- ============================================================================
CREATE TABLE IF NOT EXISTS ml_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cookie_id UUID NOT NULL REFERENCES cookies(id) ON DELETE CASCADE,
    scan_id VARCHAR(255) NOT NULL,
    
    -- Prediction
    predicted_category VARCHAR(50) NOT NULL CHECK (predicted_category IN (
        'Strictly Necessary', 'Analytics', 'Marketing', 'Functional', 'Unknown'
    )),
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('High', 'Medium', 'Low')),
    
    -- Alternatives
    alternative_predictions JSONB, -- [{category: str, probability: float}, ...]
    
    -- Explanation
    shap_values JSONB, -- {feature_name: contribution_value, ...}
    top_features JSONB, -- [{feature: str, contribution: float, value: any}, ...]
    explanation_summary TEXT,
    
    -- Metadata
    model_version VARCHAR(20) NOT NULL,
    auto_classified BOOLEAN NOT NULL DEFAULT false,
    requires_review BOOLEAN NOT NULL DEFAULT true,
    classified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT fk_scan_id FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE
);

-- Indexes for ml_classifications
CREATE INDEX IF NOT EXISTS idx_ml_classifications_cookie_id ON ml_classifications(cookie_id);
CREATE INDEX IF NOT EXISTS idx_ml_classifications_scan_id ON ml_classifications(scan_id);
CREATE INDEX IF NOT EXISTS idx_ml_classifications_confidence ON ml_classifications(confidence_score);
CREATE INDEX IF NOT EXISTS idx_ml_classifications_requires_review ON ml_classifications(requires_review);
CREATE INDEX IF NOT EXISTS idx_ml_classifications_classified_at ON ml_classifications(classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_classifications_model_version ON ml_classifications(model_version);

-- ============================================================================
-- Table: ml_feedback
-- Purpose: Store user corrections for continuous learning
-- ============================================================================
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
    similar_cookie_ids JSONB, -- [uuid, uuid, ...]
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    used_in_training BOOLEAN DEFAULT false,
    
    -- Constraints
    CONSTRAINT chk_different_labels CHECK (predicted_label != corrected_label)
);

-- Indexes for ml_feedback
CREATE INDEX IF NOT EXISTS idx_ml_feedback_cookie_id ON ml_feedback(cookie_id);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_created_at ON ml_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_used_in_training ON ml_feedback(used_in_training);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_classification_id ON ml_feedback(classification_id);

-- ============================================================================
-- Table: ml_metrics
-- Purpose: Track model performance metrics over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS ml_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time window
    metric_date DATE NOT NULL,
    metric_hour INTEGER CHECK (metric_hour IS NULL OR (metric_hour >= 0 AND metric_hour < 24)),
    
    -- Model info
    model_version VARCHAR(20) NOT NULL,
    
    -- Performance metrics
    total_predictions INTEGER NOT NULL DEFAULT 0,
    auto_classified_count INTEGER NOT NULL DEFAULT 0,
    requires_review_count INTEGER NOT NULL DEFAULT 0,
    
    -- Confidence distribution
    high_confidence_count INTEGER NOT NULL DEFAULT 0,
    medium_confidence_count INTEGER NOT NULL DEFAULT 0,
    low_confidence_count INTEGER NOT NULL DEFAULT 0,
    avg_confidence_score FLOAT,
    
    -- Category distribution
    strictly_necessary_count INTEGER NOT NULL DEFAULT 0,
    analytics_count INTEGER NOT NULL DEFAULT 0,
    marketing_count INTEGER NOT NULL DEFAULT 0,
    functional_count INTEGER NOT NULL DEFAULT 0,
    unknown_count INTEGER NOT NULL DEFAULT 0,
    
    -- User feedback
    correction_count INTEGER NOT NULL DEFAULT 0,
    correction_rate FLOAT,
    
    -- Performance
    avg_classification_latency_ms FLOAT,
    p95_classification_latency_ms FLOAT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for time window
    CONSTRAINT uq_ml_metrics_time_model UNIQUE (metric_date, metric_hour, model_version)
);

-- Indexes for ml_metrics
CREATE INDEX IF NOT EXISTS idx_ml_metrics_date ON ml_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ml_metrics_model_version ON ml_metrics(model_version);
CREATE INDEX IF NOT EXISTS idx_ml_metrics_created_at ON ml_metrics(created_at DESC);

-- ============================================================================
-- Table: vendor_database
-- Purpose: Store known vendor information for cookie classification
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_database (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Vendor info
    vendor_name VARCHAR(255) NOT NULL UNIQUE,
    vendor_domain VARCHAR(255),
    typical_category VARCHAR(50) NOT NULL CHECK (typical_category IN (
        'Strictly Necessary', 'Analytics', 'Marketing', 'Functional'
    )),
    
    -- Patterns
    cookie_name_patterns JSONB, -- ["_ga*", "_gid", "_gat*"]
    domain_patterns JSONB, -- ["*.google-analytics.com", "*.googletagmanager.com"]
    
    -- Metadata
    confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(100), -- "manual", "cookiepedia", "customer_data"
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for vendor_database
CREATE INDEX IF NOT EXISTS idx_vendor_database_name ON vendor_database(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendor_database_domain ON vendor_database(vendor_domain);
CREATE INDEX IF NOT EXISTS idx_vendor_database_category ON vendor_database(typical_category);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update vendor_database updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for vendor_database
CREATE TRIGGER trg_vendor_database_updated_at
    BEFORE UPDATE ON vendor_database
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_updated_at();

-- Function to calculate correction rate
CREATE OR REPLACE FUNCTION calculate_correction_rate(
    p_total_predictions INTEGER,
    p_correction_count INTEGER
)
RETURNS FLOAT AS $$
BEGIN
    IF p_total_predictions = 0 THEN
        RETURN 0.0;
    END IF;
    RETURN (p_correction_count::FLOAT / p_total_predictions::FLOAT);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get classification statistics for a time period
CREATE OR REPLACE FUNCTION get_classification_stats(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP,
    p_model_version VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_classifications BIGINT,
    auto_classified BIGINT,
    requires_review BIGINT,
    avg_confidence FLOAT,
    correction_count BIGINT,
    correction_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_classifications,
        COUNT(*) FILTER (WHERE auto_classified = true)::BIGINT as auto_classified,
        COUNT(*) FILTER (WHERE requires_review = true)::BIGINT as requires_review,
        AVG(confidence_score)::FLOAT as avg_confidence,
        (SELECT COUNT(*)::BIGINT FROM ml_feedback 
         WHERE created_at BETWEEN p_start_date AND p_end_date) as correction_count,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (SELECT COUNT(*)::FLOAT FROM ml_feedback 
                 WHERE created_at BETWEEN p_start_date AND p_end_date) / COUNT(*)::FLOAT
            ELSE 0.0
        END as correction_rate
    FROM ml_classifications
    WHERE classified_at BETWEEN p_start_date AND p_end_date
        AND (p_model_version IS NULL OR model_version = p_model_version);
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old ML data (retain 12 months)
CREATE OR REPLACE FUNCTION cleanup_old_ml_data()
RETURNS void AS $$
BEGIN
    -- Archive old classifications (keep 12 months)
    DELETE FROM ml_classifications 
    WHERE classified_at < NOW() - INTERVAL '12 months';
    
    -- Archive old metrics (keep 12 months)
    DELETE FROM ml_metrics 
    WHERE metric_date < CURRENT_DATE - INTERVAL '12 months';
    
    -- Keep all feedback for training (don't delete)
    
    RAISE NOTICE 'ML data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Initial Data: Seed Common Vendors
-- ============================================================================

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, source) VALUES
    ('Google LLC', 'google.com', 'Analytics', 
     '["_ga", "_gid", "_gat", "_gat_gtag_*", "_ga_*"]'::jsonb,
     '["*.google-analytics.com", "*.googletagmanager.com", "*.google.com"]'::jsonb,
     'manual'),
    
    ('Facebook', 'facebook.com', 'Marketing',
     '["_fbp", "_fbc", "fr", "sb", "datr"]'::jsonb,
     '["*.facebook.com", "*.facebook.net"]'::jsonb,
     'manual'),
    
    ('LinkedIn Corporation', 'linkedin.com', 'Analytics',
     '["li_*", "AnalyticsSyncHistory", "lms_analytics", "UserMatchHistory"]'::jsonb,
     '["*.linkedin.com"]'::jsonb,
     'manual'),
    
    ('Microsoft Corporation', 'microsoft.com', 'Analytics',
     '["_uetsid", "_uetvid", "MUID", "MSPTC"]'::jsonb,
     '["*.bing.com", "*.microsoft.com"]'::jsonb,
     'manual'),
    
    ('Twitter', 'twitter.com', 'Marketing',
     '["personalization_id", "guest_id", "ct0"]'::jsonb,
     '["*.twitter.com", "*.twimg.com"]'::jsonb,
     'manual')
ON CONFLICT (vendor_name) DO NOTHING;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE ml_classifications IS 'Stores ML classification results with confidence scores and SHAP-based explanations';
COMMENT ON TABLE ml_feedback IS 'Stores user corrections for continuous learning and model improvement';
COMMENT ON TABLE ml_metrics IS 'Tracks model performance metrics aggregated by time windows';
COMMENT ON TABLE vendor_database IS 'Known vendor information for improved classification accuracy';

COMMENT ON COLUMN ml_classifications.confidence_score IS 'Calibrated confidence score between 0.0 and 1.0';
COMMENT ON COLUMN ml_classifications.shap_values IS 'SHAP values showing feature contributions to prediction';
COMMENT ON COLUMN ml_feedback.used_in_training IS 'Flag indicating if feedback has been incorporated into model training';
COMMENT ON COLUMN vendor_database.cookie_name_patterns IS 'Glob patterns for matching cookie names (e.g., "_ga*")';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'ML Classification Schema Migration (v1.0.0) completed successfully';
    RAISE NOTICE 'Created tables: ml_classifications, ml_feedback, ml_metrics, vendor_database';
    RAISE NOTICE 'Created indexes for performance optimization';
    RAISE NOTICE 'Created helper functions for statistics and cleanup';
    RAISE NOTICE 'Seeded 5 common vendors';
END $$;
