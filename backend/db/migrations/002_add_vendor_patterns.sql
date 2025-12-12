-- ============================================================================
-- Add New Vendor Patterns for Cookie Classification
-- Migration: 002_add_vendor_patterns.sql
-- ============================================================================

-- Add HubSpot
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('HubSpot', 'hubspot.com', 'Marketing',
     '["__hstc", "__hssc", "__hssrc", "hubspotutk", "messagesUtk", "__cf_bm"]'::jsonb,
     '["*.hubspot.com", "*.hs-analytics.net", "*.hs-scripts.com"]'::jsonb,
     0.95,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add IAB Consent Management Platform (CMP)
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('IAB TCF', 'iab.com', 'Strictly Necessary',
     '["euconsent-v2", "IABTCF_*", "usprivacy", "euconsent", "cookieConsent", "OptanonConsent"]'::jsonb,
     '["*.cookielaw.org", "*.onetrust.com", "*.evidon.com"]'::jsonb,
     0.98,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Google Ads/DoubleClick
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Google Ads', 'doubleclick.net', 'Marketing',
     '["IDE", "test_cookie", "__gads", "__gac_*", "DSID", "FLC", "AID", "TAID"]'::jsonb,
     '["*.doubleclick.net", "*.googlesyndication.com", "*.googleadservices.com"]'::jsonb,
     0.95,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Hotjar
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Hotjar', 'hotjar.com', 'Analytics',
     '["_hjid", "_hjSessionUser_*", "_hjSession_*", "_hjIncludedInSessionSample_*", "_hjFirstSeen", "_hjAbsoluteSessionInProgress"]'::jsonb,
     '["*.hotjar.com", "*.hotjar.io"]'::jsonb,
     0.95,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Segment
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Segment', 'segment.com', 'Analytics',
     '["ajs_*", "seg_*", "amplitude_*"]'::jsonb,
     '["*.segment.com", "*.segment.io", "cdn.segment.com"]'::jsonb,
     0.90,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Stripe
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Stripe', 'stripe.com', 'Strictly Necessary',
     '["__stripe_mid", "__stripe_sid", "cid", "session"]'::jsonb,
     '["*.stripe.com", "js.stripe.com"]'::jsonb,
     0.95,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add PayPal
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('PayPal', 'paypal.com', 'Strictly Necessary',
     '["LANG", "cookie_check", "ts_c", "ts", "x-pp-s", "l7_az", "enforce_policy"]'::jsonb,
     '["*.paypal.com", "*.paypalobjects.com"]'::jsonb,
     0.92,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Shopify
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Shopify', 'shopify.com', 'Functional',
     '["_shopify_*", "cart", "cart_currency", "cart_sig", "cart_ts", "cart_ver", "checkout_token", "secure_customer_sig"]'::jsonb,
     '["*.shopify.com", "*.myshopify.com"]'::jsonb,
     0.93,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Intercom
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Intercom', 'intercom.io', 'Functional',
     '["intercom-*", "intercom-session-*", "intercom-id-*", "intercom-device-id-*"]'::jsonb,
     '["*.intercom.io", "*.intercom.com"]'::jsonb,
     0.94,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Salesforce/Pardot
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Salesforce Pardot', 'pardot.com', 'Marketing',
     '["visitor_id*", "pardot", "lpv*", "pi_opt_in"]'::jsonb,
     '["*.pardot.com", "*.salesforce.com", "pi.pardot.com"]'::jsonb,
     0.92,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Cloudflare
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Cloudflare', 'cloudflare.com', 'Strictly Necessary',
     '["__cflb", "__cf_bm", "cf_clearance", "__cfduid"]'::jsonb,
     '["*.cloudflare.com", "*.cloudflareinsights.com"]'::jsonb,
     0.96,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Amazon AWS
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Amazon Web Services', 'aws.amazon.com', 'Functional',
     '["AWSALB", "AWSALBCORS", "aws-waf-token"]'::jsonb,
     '["*.amazonaws.com", "*.cloudfront.net"]'::jsonb,
     0.90,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add YouTube
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('YouTube', 'youtube.com', 'Functional',
     '["VISITOR_INFO1_LIVE", "YSC", "PREF", "CONSENT"]'::jsonb,
     '["*.youtube.com", "*.youtube-nocookie.com"]'::jsonb,
     0.94,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Vimeo
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Vimeo', 'vimeo.com', 'Functional',
     '["vuid", "player"]'::jsonb,
     '["*.vimeo.com", "player.vimeo.com"]'::jsonb,
     0.91,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- Add Adobe Analytics
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Adobe Analytics', 'omniture.com', 'Analytics',
     '["s_*", "AMCV_*", "demdex", "dextp", "mbox"]'::jsonb,
     '["*.omtrdc.net", "*.2o7.net", "*.demdex.net", "*.omniture.com"]'::jsonb,
     0.93,
     'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- Log migration completion
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Vendor Patterns Migration (v2) completed successfully';
    RAISE NOTICE 'Added 15 new vendors: HubSpot, IAB TCF, Google Ads, Hotjar, Segment, Stripe, PayPal, Shopify, Intercom, Salesforce Pardot, Cloudflare, AWS, YouTube, Vimeo, Adobe Analytics';
END $$;
