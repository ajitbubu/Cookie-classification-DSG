-- Cookie Knowledge Base Migration
-- Purpose: Store globally correct cookie categories for reuse across scans
-- Created: 2026-01-29

-- Cookie knowledge base table
-- Stores all known cookies with their correct categories
CREATE TABLE IF NOT EXISTS cookie_knowledge_base (
    id SERIAL PRIMARY KEY,
    cookie_name VARCHAR(255) NOT NULL,
    cookie_domain VARCHAR(255),
    category VARCHAR(50) NOT NULL,
    confidence_score FLOAT DEFAULT 1.0,
    source VARCHAR(50) DEFAULT 'user_override', -- 'ml_prediction', 'user_override', 'manual', 'pattern_match'
    times_seen INTEGER DEFAULT 1,
    times_corrected INTEGER DEFAULT 0,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_cookie_entry UNIQUE(cookie_name, cookie_domain)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cookie_lookup ON cookie_knowledge_base(cookie_name, cookie_domain);
CREATE INDEX IF NOT EXISTS idx_cookie_name ON cookie_knowledge_base(cookie_name);
CREATE INDEX IF NOT EXISTS idx_cookie_domain ON cookie_knowledge_base(cookie_domain);
CREATE INDEX IF NOT EXISTS idx_cookie_category ON cookie_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_cookie_last_seen ON cookie_knowledge_base(last_seen DESC);

-- ML feedback table
-- Records user corrections for model improvement
CREATE TABLE IF NOT EXISTS ml_feedback (
    id SERIAL PRIMARY KEY,
    cookie_name VARCHAR(255) NOT NULL,
    cookie_domain VARCHAR(255),
    scan_id VARCHAR(255),
    predicted_category VARCHAR(50),
    corrected_category VARCHAR(50),
    ml_confidence FLOAT,
    user_id VARCHAR(255),
    feedback_type VARCHAR(50) DEFAULT 'correction', -- 'correction', 'confirmation', 'rejection'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for feedback analysis
CREATE INDEX IF NOT EXISTS idx_feedback_cookie ON ml_feedback(cookie_name, cookie_domain);
CREATE INDEX IF NOT EXISTS idx_feedback_scan ON ml_feedback(scan_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON ml_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON ml_feedback(created_at DESC);

-- Cookie patterns table
-- Stores regex patterns for automatic categorization
CREATE TABLE IF NOT EXISTS cookie_patterns (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    vendor VARCHAR(255),
    description TEXT,
    confidence FLOAT DEFAULT 0.9,
    priority INTEGER DEFAULT 0, -- Higher priority patterns checked first
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for pattern matching
CREATE INDEX IF NOT EXISTS idx_pattern_active ON cookie_patterns(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_category ON cookie_patterns(category);

-- Insert common cookie patterns
INSERT INTO cookie_patterns (pattern, category, vendor, description, confidence, priority) VALUES
    ('_ga', 'Analytics', 'Google Analytics', 'Google Analytics tracking cookie', 0.99, 100),
    ('_gid', 'Analytics', 'Google Analytics', 'Google Analytics session cookie', 0.99, 100),
    ('_gat', 'Analytics', 'Google Analytics', 'Google Analytics throttling cookie', 0.99, 100),
    ('_fbp', 'Marketing', 'Facebook', 'Facebook Pixel tracking', 0.99, 100),
    ('_fbc', 'Marketing', 'Facebook', 'Facebook click identifier', 0.99, 100),
    ('IDE', 'Marketing', 'Google DoubleClick', 'DoubleClick advertising', 0.99, 100),
    ('test_cookie', 'Marketing', 'Google DoubleClick', 'DoubleClick test cookie', 0.99, 100),
    ('DSID', 'Marketing', 'Google DoubleClick', 'DoubleClick identifier', 0.99, 100),
    ('NID', 'Functional', 'Google', 'Google preferences', 0.95, 90),
    ('CONSENT', 'Strictly Necessary', 'Google', 'Google consent cookie', 0.99, 100),
    ('PHPSESSID', 'Strictly Necessary', 'PHP', 'PHP session identifier', 0.95, 90),
    ('JSESSIONID', 'Strictly Necessary', 'Java', 'Java session identifier', 0.95, 90),
    ('session', 'Strictly Necessary', 'Generic', 'Generic session cookie', 0.85, 80),
    ('csrf', 'Strictly Necessary', 'Generic', 'CSRF protection token', 0.95, 90),
    ('_hjid', 'Analytics', 'Hotjar', 'Hotjar user identifier', 0.99, 100),
    ('_hjIncludedInPageviewSample', 'Analytics', 'Hotjar', 'Hotjar sampling', 0.99, 100),
    ('_hjIncludedInSessionSample', 'Analytics', 'Hotjar', 'Hotjar session sampling', 0.99, 100),
    ('_gcl_au', 'Marketing', 'Google Ads', 'Google Ads conversion tracking', 0.99, 100),
    ('_ttp', 'Marketing', 'TikTok', 'TikTok Pixel tracking', 0.99, 100),
    ('OptanonConsent', 'Strictly Necessary', 'OneTrust', 'Cookie consent preferences', 0.99, 100),
    ('OptanonAlertBoxClosed', 'Strictly Necessary', 'OneTrust', 'Cookie banner closed', 0.99, 100)
ON CONFLICT (pattern) DO NOTHING;

-- Function to get cookie category from knowledge base or patterns
CREATE OR REPLACE FUNCTION get_cookie_category(
    p_cookie_name VARCHAR(255),
    p_cookie_domain VARCHAR(255)
) RETURNS TABLE (
    category VARCHAR(50),
    confidence FLOAT,
    source VARCHAR(50)
) AS $$
BEGIN
    -- First, check exact match in knowledge base
    RETURN QUERY
    SELECT 
        ckb.category,
        ckb.confidence_score,
        'knowledge_base'::VARCHAR(50) as source
    FROM cookie_knowledge_base ckb
    WHERE ckb.cookie_name = p_cookie_name 
      AND (ckb.cookie_domain = p_cookie_domain OR ckb.cookie_domain IS NULL)
    ORDER BY ckb.updated_at DESC
    LIMIT 1;
    
    -- If not found, check pattern match
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            cp.category,
            cp.confidence,
            'pattern_match'::VARCHAR(50) as source
        FROM cookie_patterns cp
        WHERE cp.is_active = TRUE
          AND p_cookie_name LIKE cp.pattern
        ORDER BY cp.priority DESC, cp.confidence DESC
        LIMIT 1;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to update cookie knowledge base
CREATE OR REPLACE FUNCTION upsert_cookie_knowledge(
    p_cookie_name VARCHAR(255),
    p_cookie_domain VARCHAR(255),
    p_category VARCHAR(50),
    p_source VARCHAR(50) DEFAULT 'user_override'
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO cookie_knowledge_base (
        cookie_name, 
        cookie_domain, 
        category, 
        source,
        times_seen,
        last_seen,
        created_at,
        updated_at
    ) VALUES (
        p_cookie_name,
        p_cookie_domain,
        p_category,
        p_source,
        1,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (cookie_name, cookie_domain) 
    DO UPDATE SET 
        category = p_category,
        times_seen = cookie_knowledge_base.times_seen + 1,
        times_corrected = CASE 
            WHEN cookie_knowledge_base.category != p_category 
            THEN cookie_knowledge_base.times_corrected + 1 
            ELSE cookie_knowledge_base.times_corrected 
        END,
        last_seen = NOW(),
        updated_at = NOW(),
        source = p_source
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE cookie_knowledge_base IS 'Global knowledge base of cookies with their correct categories';
COMMENT ON TABLE ml_feedback IS 'User feedback on ML predictions for model improvement';
COMMENT ON TABLE cookie_patterns IS 'Regex patterns for automatic cookie categorization';
COMMENT ON FUNCTION get_cookie_category IS 'Get cookie category from knowledge base or pattern match';
COMMENT ON FUNCTION upsert_cookie_knowledge IS 'Insert or update cookie in knowledge base';

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON cookie_knowledge_base TO scanner;
-- GRANT SELECT, INSERT ON ml_feedback TO scanner;
-- GRANT SELECT ON cookie_patterns TO scanner;
