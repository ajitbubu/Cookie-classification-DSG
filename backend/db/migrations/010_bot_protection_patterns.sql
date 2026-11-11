-- Bot-protection cookies are Strictly Necessary
-- Purpose: v6.5.0 labelled __cf_bm and _GRECAPTCHA as Marketing with high confidence.
--          Both protect the site from bots and carry no advertising purpose.
-- Created: 2026-11-11

INSERT INTO cookie_patterns (pattern, category, vendor, description, confidence, priority) VALUES
    ('__cf_bm', 'Strictly Necessary', 'Cloudflare', 'Cloudflare Bot Management', 0.99, 100),
    ('_GRECAPTCHA', 'Strictly Necessary', 'Google reCAPTCHA', 'reCAPTCHA bot and spam protection', 0.99, 100)
ON CONFLICT (pattern, match_type) DO UPDATE SET
    category = EXCLUDED.category,
    vendor = EXCLUDED.vendor,
    description = EXCLUDED.description,
    confidence = EXCLUDED.confidence,
    priority = EXCLUDED.priority,
    is_active = TRUE,
    updated_at = NOW();
