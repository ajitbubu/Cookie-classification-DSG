-- ============================================================================
-- Add Extended Vendor Patterns (50 Additional Vendors)
-- Migration: 003_add_extended_vendor_patterns.sql
-- Version: 2.0.0
-- ============================================================================

-- ==========================
-- ANALYTICS PLATFORMS (13)
-- ==========================

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Amplitude', 'amplitude.com', 'Analytics',
     '["amplitude_*", "amp_*", "AMP_*"]'::jsonb,
     '["*.amplitude.com", "api.amplitude.com", "cdn.amplitude.com"]'::jsonb,
     0.94, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Mixpanel', 'mixpanel.com', 'Analytics',
     '["mp_*", "mixpanel_*"]'::jsonb,
     '["*.mixpanel.com", "api.mixpanel.com", "cdn.mxpnl.com"]'::jsonb,
     0.93, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Heap Analytics', 'heap.io', 'Analytics',
     '["_hp2_*", "heap_*"]'::jsonb,
     '["*.heap.io", "*.heapanalytics.com", "cdn.heapanalytics.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('New Relic', 'newrelic.com', 'Analytics',
     '["NREUM", "JSESSIONID"]'::jsonb,
     '["*.newrelic.com", "*.nr-data.net", "bam.nr-data.net"]'::jsonb,
     0.88, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Matomo', 'matomo.org', 'Analytics',
     '["_pk_*", "mtm_*", "matomo_*"]'::jsonb,
     '["*.matomo.cloud", "*.piwik.pro"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Crazy Egg', 'crazyegg.com', 'Analytics',
     '["_ce.s", "_ce.clock*", "ceg.s", "ceg.u"]'::jsonb,
     '["*.crazyegg.com", "script.crazyegg.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Fullstory', 'fullstory.com', 'Analytics',
     '["fs_uid", "fs_*"]'::jsonb,
     '["*.fullstory.com", "rs.fullstory.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Lucky Orange', 'luckyorange.com', 'Analytics',
     '["_lo_*", "luckyorange_*"]'::jsonb,
     '["*.luckyorange.com", "*.luckyorange.net"]'::jsonb,
     0.88, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Sentry', 'sentry.io', 'Analytics',
     '["sentry-*", "sentrysid"]'::jsonb,
     '["*.sentry.io", "*.ingest.sentry.io"]'::jsonb,
     0.89, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Datadog', 'datadoghq.com', 'Analytics',
     '["dd_*", "datadog*"]'::jsonb,
     '["*.datadoghq.com", "*.datadoghq.eu"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Google Tag Manager', 'googletagmanager.com', 'Analytics',
     '["_gtm*", "_gcl_*"]'::jsonb,
     '["*.googletagmanager.com", "www.googletagmanager.com"]'::jsonb,
     0.95, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- ==========================
-- MARKETING & ADVERTISING (16)
-- ==========================

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Criteo', 'criteo.com', 'Marketing',
     '["cto_*", "uid", "opt", "dis"]'::jsonb,
     '["*.criteo.com", "*.criteo.net", "gum.criteo.com"]'::jsonb,
     0.94, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Taboola', 'taboola.com', 'Marketing',
     '["t_gid", "taboola_*", "trc_*"]'::jsonb,
     '["*.taboola.com", "cdn.taboola.com", "trc.taboola.com"]'::jsonb,
     0.93, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Outbrain', 'outbrain.com', 'Marketing',
     '["obuid", "outbrain_*"]'::jsonb,
     '["*.outbrain.com", "widgets.outbrain.com", "amplify.outbrain.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Quantcast', 'quantcast.com', 'Marketing',
     '["__qca", "mc", "d"]'::jsonb,
     '["*.quantcast.com", "pixel.quantserve.com", "rules.quantcount.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('AppNexus', 'appnexus.com', 'Marketing',
     '["uuid2", "anj", "sess", "icu"]'::jsonb,
     '["*.adnxs.com", "*.appnexus.com", "ib.adnxs.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('The Trade Desk', 'thetradedesk.com', 'Marketing',
     '["TDID", "TDCPM"]'::jsonb,
     '["*.adsrvr.org", "*.thetradedesk.com", "insight.adsrvr.org"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Pinterest', 'pinterest.com', 'Marketing',
     '["_pinterest_*", "_pin_*", "_auth", "_routing_id"]'::jsonb,
     '["*.pinterest.com", "*.pinimg.com", "ct.pinterest.com"]'::jsonb,
     0.93, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Reddit', 'reddit.com', 'Marketing',
     '["_rdt_uuid", "reddaid", "token_v2", "loid"]'::jsonb,
     '["*.reddit.com", "*.redditmedia.com", "alb.reddit.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('TikTok', 'tiktok.com', 'Marketing',
     '["_ttp", "tt_*", "ttwid"]'::jsonb,
     '["*.tiktok.com", "*.tiktokv.com", "*.byteoversea.com"]'::jsonb,
     0.93, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Snapchat', 'snapchat.com', 'Marketing',
     '["sc_at", "_scid", "_sctr"]'::jsonb,
     '["*.snapchat.com", "*.sc-cdn.net", "tr.snapchat.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Mailchimp', 'mailchimp.com', 'Marketing',
     '["_AVESTA_ENVIRONMENT", "ak_bmsc", "mc_*"]'::jsonb,
     '["*.mailchimp.com", "*.list-manage.com", "chimpstatic.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Constant Contact', 'constantcontact.com', 'Marketing',
     '["ctct_*", "JSESSIONID"]'::jsonb,
     '["*.constantcontact.com", "*.ctctcdn.com"]'::jsonb,
     0.88, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Bing Ads', 'bing.com', 'Marketing',
     '["_uetsid", "_uetvid", "MUID", "_EDGE_*"]'::jsonb,
     '["*.bing.com", "bat.bing.com", "*.ads.microsoft.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Yahoo Advertising', 'yahoo.com', 'Marketing',
     '["B", "A3", "GUC"]'::jsonb,
     '["*.yahoo.com", "*.yimg.com", "sp.analytics.yahoo.com"]'::jsonb,
     0.89, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Amazon Advertising', 'amazon.com', 'Marketing',
     '["ad-id", "ad-privacy", "aam_uuid"]'::jsonb,
     '["*.amazon-adsystem.com", "*.adsystem.amazon.com", "aax.amazon-adsystem.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- ==========================
-- FUNCTIONAL (14)
-- ==========================

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Optimizely', 'optimizely.com', 'Functional',
     '["optimizelyEndUserId", "optimizelyBuckets", "optimizely_*"]'::jsonb,
     '["*.optimizely.com", "cdn.optimizely.com", "logx.optimizely.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('VWO', 'vwo.com', 'Functional',
     '["_vis_*", "_vwo_*", "v.gif"]'::jsonb,
     '["*.vwo.com", "dev.visualwebsiteoptimizer.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Zendesk', 'zendesk.com', 'Functional',
     '["_zendesk_*", "_help_center_session", "_zendesk_authenticated", "_zendesk_shared_session"]'::jsonb,
     '["*.zendesk.com", "*.zdassets.com", "static.zdassets.com"]'::jsonb,
     0.94, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Drift', 'drift.com', 'Functional',
     '["driftt_*", "drift_*"]'::jsonb,
     '["*.drift.com", "*.driftt.com", "js.driftt.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('SendGrid', 'sendgrid.com', 'Functional',
     '["sendgrid_*", "sg_*"]'::jsonb,
     '["*.sendgrid.com", "*.sendgrid.net"]'::jsonb,
     0.89, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Twilio', 'twilio.com', 'Functional',
     '["twilio_*", "__twilio*"]'::jsonb,
     '["*.twilio.com", "*.twiliocdn.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('WordPress', 'wordpress.com', 'Functional',
     '["wordpress_*", "wp-*", "comment_author_*"]'::jsonb,
     '["*.wordpress.com", "*.wp.com", "public-api.wordpress.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Wix', 'wix.com', 'Functional',
     '["svSession", "hs", "wixClient*", "XSRF-TOKEN"]'::jsonb,
     '["*.wix.com", "*.wixsite.com", "*.parastorage.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Squarespace', 'squarespace.com', 'Functional',
     '["SS_*", "crumb", "squarespace-*"]'::jsonb,
     '["*.squarespace.com", "*.sqspcdn.com", "static1.squarespace.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Typeform', 'typeform.com', 'Functional',
     '["_tf_*", "typeform_*"]'::jsonb,
     '["*.typeform.com", "embed.typeform.com"]'::jsonb,
     0.89, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('SurveyMonkey', 'surveymonkey.com', 'Functional',
     '["sm_*", "ep*", "SMCHK"]'::jsonb,
     '["*.surveymonkey.com", "*.surveymonkey.net"]'::jsonb,
     0.88, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Qualtrics', 'qualtrics.com', 'Functional',
     '["Q_*", "QSI*", "qualtrics_*"]'::jsonb,
     '["*.qualtrics.com", "*.siteintercept.qualtrics.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Freshdesk', 'freshdesk.com', 'Functional',
     '["_freshdesk_*", "__fw*"]'::jsonb,
     '["*.freshdesk.com", "*.freshworks.com"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('LiveChat', 'livechat.com', 'Functional',
     '["__lc*", "lc_*", "main_window_timestamp*"]'::jsonb,
     '["*.livechat.com", "*.livechatinc.com", "cdn.livechatinc.com"]'::jsonb,
     0.91, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Tawk.to', 'tawk.to', 'Functional',
     '["TawkConnectionTime", "tawk_*"]'::jsonb,
     '["*.tawk.to", "embed.tawk.to"]'::jsonb,
     0.89, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Cloudinary', 'cloudinary.com', 'Functional',
     '["cloudinary_*", "_cloudinary_session"]'::jsonb,
     '["*.cloudinary.com", "res.cloudinary.com"]'::jsonb,
     0.88, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

-- ==========================
-- STRICTLY NECESSARY (7)
-- ==========================

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Cookiebot', 'cookiebot.com', 'Strictly Necessary',
     '["CookieConsent", "CookieConsentBulkTicket"]'::jsonb,
     '["*.cookiebot.com", "consent.cookiebot.com"]'::jsonb,
     0.96, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('OneTrust', 'onetrust.com', 'Strictly Necessary',
     '["OptanonConsent", "OptanonAlertBoxClosed", "eupubconsent-v2"]'::jsonb,
     '["*.onetrust.com", "cdn.cookielaw.org", "*.cookielaw.org"]'::jsonb,
     0.97, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Osano', 'osano.com', 'Strictly Necessary',
     '["osano_*", "osano_consent*"]'::jsonb,
     '["*.osano.com", "cmp.osano.com"]'::jsonb,
     0.94, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Termly', 'termly.io', 'Strictly Necessary',
     '["termly_*", "consent_preferences"]'::jsonb,
     '["*.termly.io", "app.termly.io"]'::jsonb,
     0.93, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Akamai', 'akamai.com', 'Strictly Necessary',
     '["ak_bmsc", "bm_*", "AKA_*"]'::jsonb,
     '["*.akamai.com", "*.akamaihd.net", "*.akamaitechnologies.com"]'::jsonb,
     0.92, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Fastly', 'fastly.com', 'Strictly Necessary',
     '["fastly_*", "_fastly_*"]'::jsonb,
     '["*.fastly.com", "*.fastly.net"]'::jsonb,
     0.90, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Auth0', 'auth0.com', 'Strictly Necessary',
     '["auth0*", "_legacy_auth0*", "did", "did_compat"]'::jsonb,
     '["*.auth0.com", "cdn.auth0.com"]'::jsonb,
     0.94, 'manual')
ON CONFLICT (vendor_name) DO UPDATE SET
    cookie_name_patterns = EXCLUDED.cookie_name_patterns,
    domain_patterns = EXCLUDED.domain_patterns,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source) VALUES
    ('Okta', 'okta.com', 'Strictly Necessary',
     '["JSESSIONID", "DT", "sid", "t"]'::jsonb,
     '["*.okta.com", "*.oktacdn.com"]'::jsonb,
     0.93, 'manual')
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
    RAISE NOTICE 'Extended Vendor Patterns Migration (v3) completed successfully';
    RAISE NOTICE 'Added 50 additional vendors across all categories';
    RAISE NOTICE 'Analytics (13): Amplitude, Mixpanel, Heap, New Relic, Matomo, Crazy Egg, Fullstory, Lucky Orange, Sentry, Datadog, Google Tag Manager';
    RAISE NOTICE 'Marketing (16): Criteo, Taboola, Outbrain, Quantcast, AppNexus, The Trade Desk, Pinterest, Reddit, TikTok, Snapchat, Mailchimp, Constant Contact, Bing Ads, Yahoo, Amazon Ads';
    RAISE NOTICE 'Functional (14): Optimizely, VWO, Zendesk, Drift, SendGrid, Twilio, WordPress, Wix, Squarespace, Typeform, SurveyMonkey, Qualtrics, Freshdesk, LiveChat, Tawk.to, Cloudinary';
    RAISE NOTICE 'Strictly Necessary (7): Cookiebot, OneTrust, Osano, Termly, Akamai, Fastly, Auth0, Okta';
END $$;
