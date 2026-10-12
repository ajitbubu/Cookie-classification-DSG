# Cookie banner extraction and classification instructions

Use these instructions to extract a website's disclosed cookie catalog and map
it into the v6 cookie-classification taxonomy. A browser scanner should capture
the cookies actually created by the website; the LLM should extract and
normalize the banner and policy disclosures. Merge those sources by cookie name
and domain before human review.

## Reusable LLM prompt

```text
You are a privacy-data extraction and cookie-classification agent.

Target website:
{{TARGET_URL}}

Captured cookie-banner text/HTML:
{{COOKIE_BANNER_CONTENT}}

Cookie-policy page content:
{{COOKIE_POLICY_CONTENT}}

Your task:
1. Inspect the cookie banner, preference center, cookie tables, vendor panels,
   expandable sections, and linked cookie-policy content.
2. Extract every explicitly disclosed cookie.
3. Map each cookie to exactly one category from this taxonomy:
   - Strictly_Necessary
   - Functional
   - Analytics_Performance
   - Marketing_Advertising
   - Unclassified
4. Return strict JSON matching the output structure below.
5. Do not return Markdown or explanatory text outside the JSON.

CATEGORY DEFINITIONS

Strictly_Necessary:
Cookies essential for authentication, security, fraud prevention, consent
storage, shopping carts, load balancing, network operation, or another service
explicitly requested by the user.

Functional:
Cookies used for preferences, language, interface customization, remembered
settings, support chat, media functionality, or nonessential personalization.

Analytics_Performance:
Cookies used for audience measurement, statistics, diagnostics, application
performance, or understanding site usage without advertising or retargeting as
the primary purpose.

Marketing_Advertising:
Cookies used for advertising, retargeting, cross-site tracking, advertising
profiles, ad conversion attribution, campaign targeting, or social-media
tracking.

Unclassified:
Use when the purpose is missing, vague, contradictory, or insufficient to
support another category.

ANTI-HALLUCINATION RULES

- Extract only cookies explicitly present in the provided website material.
- Never invent cookie names, domains, durations, purposes, vendors, or categories.
- Preserve the banner's original category and purpose as evidence.
- If a value is unavailable, return null. Do not guess.
- Do not infer secure, http_only, same_site, host_only, partitioned, path, or
  setter_domain from a cookie name or purpose.
- Only populate those browser attributes if directly captured from the browser
  or explicitly disclosed.
- A well-known cookie name is supporting evidence, not sufficient evidence by itself.
- If evidence supports multiple categories, return Unclassified and require review.
- Do not classify a cookie from its vendor name alone.
- Do not use vendor_type or tracker_category as model features.
- Do not treat the website's own category as guaranteed ground truth.
- Marketing_Advertising and Unclassified records must be marked for human review
  unless the banner provides explicit and unambiguous category or purpose evidence.
- Do not include the cookie value because it may contain identifiers or personal data.

NORMALIZATION RULES

- site_domain and cookie_domain must be lowercase without protocols or paths.
- Normalize SameSite only to Lax, Strict, None, or null.
- Convert explicit durations to expiry_days:
  session = 0
  24 hours = 1
  7 days = 7
  1 month = 30
  1 year = 365
  If conversion is ambiguous, return null.
- Normalize booleans to true, false, or null.
- label_source must be one of:
  website_banner_explicit
  website_policy_explicit
  llm_purpose_mapping
  insufficient_evidence
- classification_confidence must be between 0 and 1.
- Confidence above 0.90 is allowed only when the banner or policy explicitly
  identifies the cookie and provides an unambiguous category or purpose.

OUTPUT FORMAT

{
  "source": {
    "site_domain": "example.com",
    "source_url": "https://example.com",
    "captured_at_utc": "ISO-8601 timestamp",
    "cmp_vendor": null
  },
  "records": [
    {
      "production_record": {
        "observation_id": null,
        "observed_at": "ISO-8601 timestamp",
        "site_domain": "example.com",
        "cookie_name": "cookie_name",
        "cookie_domain": "example.com",
        "path": null,
        "expiry_days": 30,
        "secure": null,
        "http_only": null,
        "same_site": null,
        "host_only": null,
        "partitioned": null,
        "setter_domain": null,
        "label_category": "Functional",
        "label_source": "website_banner_explicit",
        "dataset_source": "cookie_banner:example.com:YYYY-MM-DD"
      },
      "evidence": {
        "source_category_raw": "Preferences",
        "purpose_text": "Remembers the selected language",
        "duration_raw": "30 days",
        "provider_raw": "Example Inc.",
        "evidence_url": "https://example.com/cookie-policy",
        "evidence_quote": "Short exact supporting excerpt",
        "classification_reason": "Language preference is nonessential functionality.",
        "classification_confidence": 0.96,
        "needs_human_review": false
      }
    }
  ],
  "unresolved_items": [],
  "extraction_warnings": []
}
```

## Collection workflow

```text
Playwright browser capture
        ↓
Actual cookies and browser attributes
        ↓
Banner/policy extraction with the LLM
        ↓
Merge using site_domain + cookie_name + cookie_domain
        ↓
Human review of labels
        ↓
Export the approved 16-column production dataset
```

## Training safeguards

- Keep evidence fields in an audit sidecar, not as model features.
- Only approved records should enter the training dataset.
- Treat banner-derived labels as weak labels until reviewed.
- Prioritize human review for Marketing_Advertising and Unclassified.
- Deduplicate before splitting.
- Split by unseen site_domain and cookie/vendor domain.
- Reserve cookies from a genuinely new website collection as the external holdout.
- Never use purpose text, raw banner category, vendor type, or tracker category as
  features unless the production classifier receives the same independently
  collected information.
