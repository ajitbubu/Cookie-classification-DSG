# Vendor Pattern Matching Guide

Complete guide for managing vendor cookie patterns in the DCS cookie classification system.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Adding Vendor Patterns](#adding-vendor-patterns)
- [Pattern Syntax](#pattern-syntax)
- [API Usage](#api-usage)
- [Common Vendors Reference](#common-vendors-reference)

---

## Overview

The vendor pattern matching system helps automatically classify cookies by detecting known vendor patterns. It uses:

- **Cookie name patterns** (e.g., `_ga`, `_fbp`, `__hstc`)
- **Domain patterns** (e.g., `*.google.com`, `*.facebook.com`)
- **Confidence scores** (0.0-1.0 indicating pattern reliability)
- **Category mapping** (Strictly Necessary, Analytics, Marketing, Functional)

### How It Works

```
Cookie: _ga from .google-analytics.com
    ↓
1. Check vendor_database for pattern match
    ↓
2. Match found: Google LLC → Analytics (0.95 confidence)
    ↓
3. Extract vendor features for ML model
    ↓
4. ML prediction weighted by vendor confidence
    ↓
5. Result: Analytics (High confidence)
```

---

## Quick Start

### Method 1: SQL Migration (Recommended for bulk adds)

```bash
# Run the migration
psql -U scanner -d cookie_scanner -f backend/db/migrations/002_add_vendor_patterns.sql
```

This adds 15 common vendors including:
- HubSpot, IAB TCF, Google Ads, Hotjar, Segment
- Stripe, PayPal, Shopify, Intercom
- Cloudflare, AWS, YouTube, Adobe Analytics

### Method 2: Python Script (Interactive)

```bash
# Interactive vendor management
python3 scripts/add_vendor_patterns.py

# Programmatic usage
python3
>>> from scripts.add_vendor_patterns import VendorManager
>>> manager = VendorManager()
>>> manager.add_vendor(
...     vendor_name='HubSpot',
...     vendor_domain='hubspot.com',
...     typical_category='Marketing',
...     cookie_name_patterns=['__hstc', '__hssc', 'hubspotutk'],
...     domain_patterns=['*.hubspot.com', '*.hs-analytics.net'],
...     confidence_score=0.95
... )
```

### Method 3: Direct SQL

```sql
INSERT INTO vendor_database (
    vendor_name,
    vendor_domain,
    typical_category,
    cookie_name_patterns,
    domain_patterns,
    confidence_score,
    source
) VALUES (
    'Your Vendor',
    'vendor.com',
    'Analytics',
    '["cookie1", "cookie2*", "cookie3"]'::jsonb,
    '["*.vendor.com", "cdn.vendor.com"]'::jsonb,
    0.90,
    'manual'
);
```

---

## Adding Vendor Patterns

### Step-by-Step Process

#### 1. Research the Vendor's Cookies

Identify:
- Cookie names (exact or patterns)
- Associated domains
- Cookie purpose/category
- Reliability of identification

**Example: HubSpot Research**
```
Cookie Names:
  __hstc         - Tracking cookie (main identifier)
  __hssc         - Session cookie
  __hssrc        - Updated on session
  hubspotutk     - Visitor token
  messagesUtk    - Messages widget

Domains:
  *.hubspot.com         - Main platform
  *.hs-analytics.net    - Analytics
  *.hs-scripts.com      - Scripts

Category: Marketing (tracking & analytics)
Confidence: 0.95 (very reliable patterns)
```

#### 2. Choose the Appropriate Category

| Category | Description | Examples |
|----------|-------------|----------|
| **Strictly Necessary** | Essential for website functionality | Session, auth, CSRF, payment, consent management |
| **Analytics** | Traffic analysis & performance | Google Analytics, Hotjar, Adobe Analytics |
| **Marketing** | Advertising & tracking | Facebook Pixel, Google Ads, LinkedIn Ads |
| **Functional** | Enhanced features | Language, preferences, chat widgets |

#### 3. Set Confidence Score

| Score | Meaning | When to Use |
|-------|---------|-------------|
| 0.95-1.0 | Very High | Unique, well-documented vendor patterns |
| 0.85-0.94 | High | Commonly known vendor patterns |
| 0.70-0.84 | Medium | Less unique patterns, shared prefixes |
| 0.50-0.69 | Low | Generic patterns, may match multiple vendors |

#### 4. Add the Vendor

**Using Python Script:**
```python
from scripts.add_vendor_patterns import VendorManager

manager = VendorManager()
manager.add_vendor(
    vendor_name='HubSpot',
    vendor_domain='hubspot.com',
    typical_category='Marketing',
    cookie_name_patterns=[
        '__hstc',
        '__hssc',
        '__hssrc',
        'hubspotutk',
        'messagesUtk'
    ],
    domain_patterns=[
        '*.hubspot.com',
        '*.hs-analytics.net',
        '*.hs-scripts.com'
    ],
    confidence_score=0.95
)
```

**Using SQL:**
```sql
INSERT INTO vendor_database (vendor_name, vendor_domain, typical_category, cookie_name_patterns, domain_patterns, confidence_score, source)
VALUES (
    'HubSpot',
    'hubspot.com',
    'Marketing',
    '["__hstc", "__hssc", "__hssrc", "hubspotutk", "messagesUtk"]'::jsonb,
    '["*.hubspot.com", "*.hs-analytics.net", "*.hs-scripts.com"]'::jsonb,
    0.95,
    'manual'
);
```

---

## Pattern Syntax

### Cookie Name Patterns

Supports **glob-style wildcards**:

```python
# Exact match
"_ga"              # Matches only "_ga"

# Prefix wildcard
"_ga*"             # Matches "_ga", "_ga_123", "_gat_gtag_UA-123"

# Suffix wildcard
"*_session"        # Matches "user_session", "cart_session"

# Contains wildcard
"*analytics*"      # Matches "google_analytics", "analytics_id"

# Multiple patterns
["_ga", "_gid", "_gat*"]  # Matches any of these patterns
```

**Pattern matching is case-insensitive** via SQL `ILIKE`.

### Domain Patterns

Supports **glob-style wildcards**:

```python
# Exact domain
"google.com"                  # Matches only "google.com"

# Subdomain wildcard
"*.google.com"                # Matches "analytics.google.com", "www.google.com"

# Specific subdomain
"analytics.google.com"        # Matches only "analytics.google.com"

# Multiple domains
["*.google.com", "*.googletagmanager.com"]
```

### Best Practices

✅ **DO:**
- Use specific patterns when possible (`_ga` vs `_g*`)
- Include all known cookie variations
- Document unusual patterns
- Test patterns before deploying
- Use high confidence for unique patterns

❌ **DON'T:**
- Use overly broad patterns (`*`, `a*`)
- Mix unrelated cookies in one vendor
- Assign wrong categories
- Use confidence > 0.95 without verification
- Forget to include domain patterns

---

## API Usage

### Find Matching Vendors

**Endpoint:** `GET /api/v1/vendors/search`

```bash
curl "http://localhost:8000/api/v1/vendors/search?cookie_name=_ga&domain=google-analytics.com"
```

**Response:**
```json
{
  "matches": [
    {
      "vendor_name": "Google LLC",
      "typical_category": "Analytics",
      "confidence_score": 0.95
    }
  ]
}
```

### Classify with Vendor Info

**Endpoint:** `POST /api/v1/ml/classify`

```bash
curl -X POST http://localhost:8000/api/v1/ml/classify \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [{
      "name": "_ga",
      "domain": ".google-analytics.com",
      "value": "GA1.2.123",
      "expiry": 63072000
    }]
  }'
```

**Response includes vendor info:**
```json
{
  "classifications": [{
    "cookie_name": "_ga",
    "cookie_domain": ".google-analytics.com",
    "predicted_category": "Analytics",
    "confidence": 0.92,
    "vendor_info": {
      "detected_vendor": "Google LLC",
      "vendor_category": "Analytics",
      "vendor_confidence": 0.95
    }
  }]
}
```

---

## Common Vendors Reference

### Analytics

| Vendor | Cookie Patterns | Domains | Confidence |
|--------|----------------|---------|------------|
| **Google Analytics** | `_ga`, `_gid`, `_gat*` | `*.google-analytics.com` | 0.95 |
| **Hotjar** | `_hjid`, `_hjSession_*` | `*.hotjar.com` | 0.95 |
| **Adobe Analytics** | `s_*`, `AMCV_*` | `*.omtrdc.net` | 0.93 |
| **Segment** | `ajs_*`, `seg_*` | `*.segment.com` | 0.90 |

### Marketing

| Vendor | Cookie Patterns | Domains | Confidence |
|--------|----------------|---------|------------|
| **Facebook** | `_fbp`, `_fbc`, `fr` | `*.facebook.com` | 0.95 |
| **Google Ads** | `IDE`, `__gads`, `DSID` | `*.doubleclick.net` | 0.95 |
| **HubSpot** | `__hstc`, `hubspotutk` | `*.hubspot.com` | 0.95 |
| **Salesforce Pardot** | `visitor_id*`, `pardot` | `*.pardot.com` | 0.92 |

### Strictly Necessary

| Vendor | Cookie Patterns | Domains | Confidence |
|--------|----------------|---------|------------|
| **IAB TCF** | `euconsent-v2`, `IABTCF_*` | `*.cookielaw.org` | 0.98 |
| **Cloudflare** | `__cf_bm`, `cf_clearance` | `*.cloudflare.com` | 0.96 |
| **Stripe** | `__stripe_mid`, `__stripe_sid` | `*.stripe.com` | 0.95 |

### Functional

| Vendor | Cookie Patterns | Domains | Confidence |
|--------|----------------|---------|------------|
| **Shopify** | `_shopify_*`, `cart`, `checkout_token` | `*.shopify.com` | 0.93 |
| **Intercom** | `intercom-*` | `*.intercom.io` | 0.94 |
| **YouTube** | `VISITOR_INFO1_LIVE`, `YSC` | `*.youtube.com` | 0.94 |

---

## Verification & Testing

### 1. Verify Pattern Added

```sql
SELECT * FROM vendor_database WHERE vendor_name = 'HubSpot';
```

### 2. Test Pattern Matching

```python
from scripts.add_vendor_patterns import VendorManager

manager = VendorManager()
matches = manager.search_vendor('__hstc', 'hubspot.com')
print(matches)
# Expected: [{'vendor_name': 'HubSpot', 'typical_category': 'Marketing', 'confidence_score': 0.95}]
```

### 3. Classify Test Cookie

```python
from backend.api.ml_classifier.classifier import CookieClassifier

classifier = CookieClassifier()
result = classifier.classify({
    'name': '__hstc',
    'domain': '.hubspot.com',
    'value': '123',
    'expiry': 2592000
})

print(f"Category: {result.predicted_category}")
print(f"Confidence: {result.confidence:.2%}")
print(f"Vendor detected: {result.vendor_info.detected_vendor if result.vendor_info else 'None'}")
```

---

## Troubleshooting

### Pattern not matching

**Problem:** Added vendor pattern but cookies not being matched

**Solutions:**
1. Check pattern syntax (use glob wildcards correctly)
2. Verify case sensitivity (patterns are case-insensitive)
3. Check domain format (include subdomains with `*`)
4. Review database insertion (check for typos)

```sql
-- Debug query
SELECT
    vendor_name,
    cookie_name_patterns,
    domain_patterns
FROM vendor_database
WHERE vendor_name = 'YourVendor';
```

### Low classification confidence

**Problem:** Vendor matched but ML still gives low confidence

**Causes:**
- Vendor confidence score too low
- Conflicting signals from other features
- Insufficient training data for that vendor

**Solutions:**
- Increase vendor confidence_score if reliable
- Add more training examples with correct labels
- Retrain model with vendor feedback

### Duplicate vendors

**Problem:** Multiple vendors match same cookie

**Solutions:**
- Use more specific patterns
- Adjust confidence scores
- Check domain patterns for overlap
- Primary match wins (highest confidence)

---

## Resources

- **Cookiepedia** - https://cookiepedia.co.uk/ (vendor cookie database)
- **IAB Vendor List** - https://iabeurope.eu/vendor-list-tcf/ (TCF vendors)
- **CookieServe** - https://www.cookieserve.com/ (cookie categorization)
- **OneTrust Cookie Database** - Proprietary but referenced

---

## Maintenance

### Regular Updates

**Quarterly review:**
1. Check for new major vendors
2. Update existing patterns (vendors change cookies)
3. Review confidence scores based on accuracy
4. Remove deprecated cookies

**Monitor:**
- Uncategorized cookies (may be new vendors)
- Low confidence predictions
- User feedback/corrections

### Contribution

Found a vendor pattern? Contribute:

1. Research the vendor thoroughly
2. Test the patterns
3. Add via Python script or SQL
4. Document in this guide
5. Submit PR (if using version control)

---

## Examples

### Example 1: Adding Mailchimp

```python
manager.add_vendor(
    vendor_name='Mailchimp',
    vendor_domain='mailchimp.com',
    typical_category='Marketing',
    cookie_name_patterns=[
        '_AVESTA_ENVIRONMENT',
        'ak_bmsc'
    ],
    domain_patterns=[
        '*.mailchimp.com',
        '*.list-manage.com'
    ],
    confidence_score=0.88
)
```

### Example 2: Adding Zendesk

```python
manager.add_vendor(
    vendor_name='Zendesk',
    vendor_domain='zendesk.com',
    typical_category='Functional',
    cookie_name_patterns=[
        '_zendesk_*',
        '_help_center_session',
        '_zendesk_authenticated'
    ],
    domain_patterns=[
        '*.zendesk.com',
        '*.zdassets.com'
    ],
    confidence_score=0.92
)
```

### Example 3: Custom First-Party Analytics

```python
manager.add_vendor(
    vendor_name='Acme Analytics',
    vendor_domain='acme.com',
    typical_category='Analytics',
    cookie_name_patterns=[
        'acme_*',
        '_acme_analytics'
    ],
    domain_patterns=[
        'analytics.acme.com',
        '*.acme.com'
    ],
    confidence_score=0.85
)
```

---

**Last Updated:** 2025-11-26
**Version:** 1.0.0
