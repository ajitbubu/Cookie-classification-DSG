-- Database initialization script

CREATE TABLE IF NOT EXISTS scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) UNIQUE NOT NULL,
    start_url TEXT NOT NULL,
    max_pages INTEGER DEFAULT 100,
    concurrency INTEGER DEFAULT 20,
    max_depth INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    worker_id VARCHAR(100),
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255),
    total_cookies INTEGER,
    total_pages INTEGER,
    result_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cookies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    value TEXT,
    category VARCHAR(100),
    type VARCHAR(50),
    requires_consent BOOLEAN DEFAULT false,
    is_third_party BOOLEAN DEFAULT false,
    size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    cookie_count INTEGER DEFAULT 0,
    scan_duration FLOAT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scan_id) REFERENCES scan_jobs(scan_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_created_at ON scan_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookies_scan_id ON cookies(scan_id);
CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain);
CREATE INDEX IF NOT EXISTS idx_page_results_scan_id ON page_results(scan_id);

-- Create function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_scans()
RETURNS void AS $$
BEGIN
    DELETE FROM scan_jobs 
    WHERE created_at < NOW() - INTERVAL '7 days'
    AND status IN ('complete', 'error');
END;
$$ LANGUAGE plpgsql;
