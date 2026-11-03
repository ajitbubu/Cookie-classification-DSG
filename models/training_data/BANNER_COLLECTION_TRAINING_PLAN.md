# Plan: retrain the cookie classifier on cookie-banner disclosures

Goal: build a reviewed, multi-source training set from the cookie declarations
that consent banners (CMPs) publish, merge it with cookies the browser actually
observes, and train a model that can pass the external-holdout gate
(`acceptance.external_holdout_gate`, currently `false` for v6.1.0).

Builds on `COOKIE_BANNER_EXTRACTION_INSTRUCTIONS.md` (taxonomy, anti-hallucination
rules, 16-column output) and `backend/scripts/train_cookie_model.py` (site-disjoint
split, temperature calibration, per-class auto thresholds, `--external-holdout`).

## Why

Findings from probing v6.1.0 (2026-10-13):

- All 73,001 rows are `label_source = legacy_import_unverified`.
- Some labels are reproduced with full confidence even where they are debatable:
  `OptanonConsent` is `Functional` in all 711 rows → model says Functional at 1.00.
- `cookie_domain` does not hold the browser-observed domain (`_ga` appears under
  `hotjar.com`, `mixpanel.com`), so first-party `_fbp` on a site's own domain is
  predicted `Unclassified` despite 652 Marketing rows.
- No external holdout has ever been evaluated (`external_holdout: null`).

Banner data fixes this: each label comes with the site's own stated category and
purpose text as evidence, and the browser capture supplies real attributes.

## Phase 0 — Spike: confirm CMP data access (2–3 days)

Most CMPs expose their cookie declaration as structured JSON, which is more
reliable than LLM extraction of rendered HTML. The endpoints below are starting
points; confirm each on 5 live sites before building on it.

| CMP | Where the declaration lives (verify) | Native categories |
|---|---|---|
| OneTrust | `window.OneTrust.GetDomainData()`; `cdn.cookielaw.org/consent/<id>/<id>.json` → `Groups[].Cookies[]` | C0001 Strictly Necessary, C0002 Performance, C0003 Functional, C0004 Targeting, C0005 Social Media |
| Cookiebot | `consent.cookiebot.com/<cbid>/cd.js` (cookie declaration) | Necessary, Preferences, Statistics, Marketing, Unclassified |
| Usercentrics | settings JSON per `settingsId`; per-service device-storage disclosure | Essential, Functional, Marketing (+ custom) |
| CookieYes / Complianz / Osano / Termly / iubenda | rendered cookie tables in the preference center or policy page | varies per vendor |
| IAB TCF v2.2 (Didomi, Quantcast, Sourcepoint…) | Global Vendor List → each vendor's `deviceStorageDisclosureUrl` (identifier, maxAgeSeconds, purposes) | TCF Purposes 1–11 |
| No CMP / custom banner | LLM prompt in `COOKIE_BANNER_EXTRACTION_INSTRUCTIONS.md` | free text |

Exit criteria: for each CMP, a captured sample JSON + a written field mapping.
Drop any CMP whose data can't be pulled reliably.

Status (2026-10-21): OneTrust and Cookiebot pass. See `PHASE0_CMP_FINDINGS.md`
and `phase0_samples/`. Usercentrics, the table-based CMPs and TCF are not verified yet.

## Phase 1 — Collector (1–2 weeks)

New script `backend/scripts/collect_banner_cookies.py` (one-off script, so sync
I/O is allowed here per `.claude/rules/code-style.md`), reusing `backend/scanner/browser.py`
for launching Playwright.

Per site:

1. Load the page in a fresh context with a region-appropriate locale/geo.
2. **Pre-consent capture:** `context.cookies()` before any interaction. These
   should be Strictly_Necessary only — a useful independent signal.
3. **CMP detection:** look for known globals/scripts (`OneTrust`, `Cookiebot`,
   `UC_UI`, `__tcfapi`, `CookieYes`…) and run the matching extractor.
4. **Accept-all capture:** click accept, reload, `context.cookies()` again
   (real `domain`, `path`, `expires`, `secure`, `httpOnly`, `sameSite`,
   `partitionKey`, plus the setter from the response/script that set it).
5. Write raw output to `models/training_data/raw/<cmp>/<site>/<date>.json`
   (declaration + both captures + CMP version). Raw files are immutable.

Site list (target ~3,000 sites, balanced, not just top-traffic):

- Spread across CMPs: at least 300 sites each for OneTrust, Cookiebot,
  Usercentrics, TCF CMPs, plus "other/custom".
- Spread across regions that match the compliance product: EU (GDPR),
  US-CA (CCPA/CPRA), India (DPDP), others.
- Spread across verticals (e-commerce, news, SaaS, banking, travel, health…).
- Respect robots.txt and site terms; rate-limit; no logins; store no cookie values.

## Phase 2 — Normalize and merge (1 week)

1. **Map CMP categories → 5-class taxonomy** with a versioned mapping file
   (e.g. OneTrust C0004/C0005 → Marketing_Advertising; Cookiebot Preferences →
   Functional; TCF purposes 2–4, 7 → Marketing_Advertising; purpose 8–9 →
   Analytics_Performance; ambiguous → Unclassified).
2. **Merge** declaration ↔ browser capture on `site_domain + cookie_name +
   cookie_domain` (wildcard/prefix names such as `_ga_*` matched by pattern).
   - Declared and observed → `label_source = website_banner_explicit`.
   - Observed but not declared → kept for unsupervised stats, **not** labeled.
   - Declared but not observed → keep label, attributes `null` (never inferred).
3. Emit the existing 16 columns + an **evidence sidecar**
   (`source_category_raw`, `purpose_text`, `cmp_vendor`, `evidence_url`) keyed by
   `observation_id`. Evidence is never a model feature.

## Phase 3 — Label quality (ongoing)

Sites disagree (e.g. some put `OptanonConsent` in Functional, others in Strictly
Necessary). Resolve at the cookie level, not row level:

- **Aggregate** each `cookie_name` (+ vendor) across sites: majority label,
  agreement rate, number of distinct sites/CMPs.
- **Auto-accept** when ≥ 5 sites across ≥ 2 CMPs agree ≥ 80%.
- **Human review queue** (reuse the Review Queue UI) for: disagreement, < 5
  sites, all Marketing_Advertising/Unclassified per existing rules, and a 5%
  random audit of auto-accepted labels to measure label error.
- Keep a **policy override list** for cookies whose correct category is a
  compliance decision, not a vote (consent-state cookies → Strictly_Necessary).
- Record `label_source` per row so training can weight or filter by quality.

## Phase 4 — Train and evaluate (1 week)

1. Build the dataset with `build_production_dataset.py` (add the new input),
   keeping `legacy_import_unverified` rows only if an ablation shows they help.
2. **External holdout first:** before training, set aside ~15% of collected
   *sites* (and every cookie whose vendor domain only appears there), from a
   collection run on a different date. Pass it via `--external-holdout`.
3. Train: `python backend/scripts/train_cookie_model.py --input <new.csv>
   --external-holdout <holdout.csv> --external-provenance "banner-collect YYYY-MM-DD"
   --version 7.0.0 --output-dir models/v7.0.0`.
4. Review feature coverage: `IDENTITY_EVIDENCE_FEATURES` in `config.py` is narrow
   (AWSALB, csrftoken, `__stripe_mid` get capped at 0.5). Consider adding a
   known-name/vendor-pattern feature learned from the new data; re-run the guard.
5. Promotion gates (all must pass):
   - existing internal gates (macro F1, Marketing recall, Unclassified precision,
     auto precision);
   - `external_holdout_gate = true`;
   - per-CMP and per-region macro F1 within 5 points of overall;
   - regression suite (below) passes.

## Phase 5 — Regression tests

`tests/backend/test_ml_classifier_regression.py` (hypothesis where useful):

- Known cookies → expected category: `_ga`, `_gid`, `_fbp` (first-party),
  `_gcl_au`, `IDE`, `PHPSESSID`, `AWSALB`, `csrftoken`, `OptanonConsent`,
  `CookieConsent`, `__stripe_mid`, `lang`.
- Nonsense names on unknown domains → `insufficient_evidence` and confidence ≤ 0.5.
- No prediction with confidence ≥ the auto threshold whose label disagrees with
  the policy override list.

## Deliverables and checks

| Step | Deliverable | Verify |
|---|---|---|
| 0 | CMP field mappings + samples | 5 sites per CMP extract cleanly |
| 1 | `collect_banner_cookies.py`, raw JSON | rerun on same site is stable; no cookie values stored |
| 2 | category mapping file, merged CSV + sidecar | 16 columns; manifest checksums; zero inferred attributes |
| 3 | aggregated labels, review queue | random audit label error < 3% |
| 4 | `models/v7.0.0` | all promotion gates pass |
| 5 | regression tests | `pytest tests/backend/ -v` green |

## Open questions

- Which regions/markets matter most for customers (sets the site mix)?
- Who reviews labels, and how much reviewer time per week?
- Is LLM extraction acceptable for custom banners, or structured CMPs only?
- Licensing/terms: confirm collecting public cookie declarations is acceptable
  for each source, and whether the Open Cookie Database (Apache-2.0) may be used
  as an extra external check.
