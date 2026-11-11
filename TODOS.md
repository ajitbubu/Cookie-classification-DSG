# TODOS

## Design

### Sync the UCM Figma file with the redesign review decisions

- **What:** Update the Figma file `Bi6sVvyRvY6UaHrwjCXBZh` (UCM, canvas "COOKIE CLASSIFICATION") frames and
  variables to match plan decisions 11A, 12A, 13A, 19A and 27C in `docs/plans/ucm-figma-redesign.md`.
- **Why:** The build deviates from Figma on purpose (contrast-safe colours, honest AI Insights values,
  review-row evidence, trend chart, URL-first scan launcher). Without a Figma update, the next design
  iteration starts from the old frames and reintroduces the failing colours.
- **Pros:** Design and code share one source of truth; future screens start from accessible components.
- **Cons:** Designer time outside this repo.
- **Context:** Exact changes and hex values: 19A table (green `#0B7A4B`, red `#C42B2B`, navy text on
  yellow chips and on the `#CBDCF6` tab bar); 11A AI Insights labels; 12A "Model confidence" + "Rule engine"
  columns and "Needs manual check" chip; 13A "Unclassified cookies over time" bar chart; 27C launch bar
  from frame `1:189760`.
- **Depends on / blocked by:** Nothing; can run in parallel with implementation.

### Design-review findings (2026-10-20, /design-review on feat/ucm-figma-redesign)

All 12 audit findings and the Web Interface Guidelines review are resolved on this branch
(commits 38ee2c9..f7cfac2), except:

- **007, partly kept as designed:** the red "Unclassified" tag is a design-system pair listed in
  DESIGN.md "Contrast exceptions" (user decision 2026-10-12), so only the chart series changed.
- **011, no change needed:** the sidebar was already full-height (position: fixed); full-page
  screenshots made it look short.
- **Open decision:** 72e1095 changed the Schedule scan pill to navy text, but DESIGN.md lists white on
  #1CC279 as a deliberate exception. Either record the new pair in DESIGN.md or revert the pill text.
- **Follow-up to 001:** `/api/store/scans` returns 4.8 MB (`fullResults` on all 200 scans). Return
  summaries from the list and fetch detail on demand.
- **Follow-up to 003:** the "N in progress" chip counts scheduled jobs, and schedules show next-run
  times that have already passed.
- **Domain Details Version History:** the Figma "Published By" column returns once publishes record who
  published them.

## Backend

### Persist scans, domain versions and schedules (mostly done: MongoDB scan store, 2026-10-12)

- **Done:** Scans (with full results), published versions, scheduled jobs and review approvals live in
  MongoDB (`mongo` service, `backend/db/scan_store.py`, `/api/store/*` in `backend/api/store_routes.py`).
  The app loads them at startup (`src/lib/scanApi.js`), imports each browser's old localStorage copy
  once, and shows "Couldn't load saved scans" with Retry when the store is down. No local copy is kept.
- **Still open:** "Published By" (needs user accounts), and running scheduled jobs on the server:
  timers still run in the open tab, so a schedule only fires while someone has the app open.
- **Watch:** One scan is one Mongo document (16 MB limit); a very large deep scan's `fullResults` could
  exceed it. The API also answers its first requests slowly (2-10 s) right after a restart.

## ML Training

### Usercentrics and TCF readers for the banner collector

- **What:** Add Usercentrics (settings JSON per `settingsId`) and IAB TCF vendor-disclosure readers to
  `backend/scripts/collect_banner_cookies.py`.
- **Why:** v7 is trained on OneTrust + Cookiebot sites only (eng review 2026-11-09, D2), so the data is
  skewed to two CMP vendors.
- **Pros:** Wider site mix; TCF disclosures add purpose data for ad-tech cookies.
- **Cons:** Endpoints unverified; each needs its own Phase 0 spike (about a week of work).
- **Context:** The collector records other CMPs as `detected_but_skipped`; count those first to size the
  gain. Field-mapping approach: `models/training_data/PHASE0_CMP_FINDINGS.md`.
- **Depends on / blocked by:** v7 per-CMP macro-F1 results.

### Review Queue UI for disputed banner labels

- **What:** Show `review_queue.csv` disputes in the app's Review Queue with decisions stored and audited.
- **Why:** Disputed labels are reviewed in a CSV for now (eng review 2026-11-09, D3/D10). No audit trail.
- **Pros:** Reviewers work in the app, with history; reusable for later collection rounds.
- **Cons:** New API and UI work.
- **Context:** The builder writes `review_queue.csv`; families on ≥3 train sites with no label at ≥80% land there.
- **Depends on / blocked by:** A second collection round that needs review.

### Human-labeled sample of all observed holdout cookies

- **What:** Have a reviewer label a random sample (~300) of every cookie observed on holdout sites,
  including undeclared and disputed ones, and score v7 on it.
- **Why:** The external holdout only has banner-declared cookies, so it hides the undeclared tail and has
  almost no Unclassified examples (Codex outside review, 2026-11-09).
- **Pros:** Promotion evidence that matches what real scans see.
- **Cons:** About 2-3 days of reviewer time.
- **Context:** Holdout sites come from the `split` column in `models/training_data/collection_sites.csv`.
- **Depends on / blocked by:** Naming a reviewer.

### Read each site's CMP declaration during customer scans

- **What:** Reuse the collector's OneTrust/Cookiebot readers in `backend/scanner/` so scan results carry the
  site's own declared category (`websiteProvided`, evidence URL) and only undeclared cookies go to the model.
- **Why:** Customers get exact, sourced labels on CMP sites instead of ML guesses (CEO review 2026-11-09, E1).
- **Pros:** Biggest direct accuracy win; every scan can also feed training.
- **Cons:** Changes the production scanner and API; needs the async rules in `.claude/rules/code-style.md`.
- **Context:** `src/App.jsx` sets `websiteProvided: false` today. Readers are built and tested first in
  `backend/scripts/collect_banner_cookies.py` (v7 plan).
- **Depends on / blocked by:** Collector readers proven on the v7 crawl.

### Reviewer approvals as training labels

- **What:** Export Review Queue approvals (MongoDB `approvals`, keyed `<domain>:<cookie name>`) joined to stored
  scan attributes as a builder input with `label_source=human_review`.
- **Why:** Human-checked labels on real customer sites (CEO review 2026-11-09, E2).
- **Pros:** Model mistakes corrected by reviewers flow back into training.
- **Cons:** Uses customer scan data. Customer sites must stay out of the external holdout.
- **Context:** `backend/db/scan_store.py`; never export cookie values.
- **Depends on / blocked by:** A data-use decision for customer scan data (terms, retention, GDPR/DPDP).

### Scheduled holdout re-crawl and drift report

- **What:** Re-crawl the holdout sites monthly, score the served model, report label-share and accuracy drift.
- **Why:** Sites change cookies and banners; accuracy decay should show up before customers notice (CEO review 2026-11-09, E3).
- **Pros:** Reuses the collector, holdout list and `backend/api/ml_classifier/drift_detector.py`.
- **Cons:** A recurring crawl job to run and watch.
- **Context:** Holdout sites are the `split=holdout` rows of `models/training_data/collection_sites.csv`.
- **Depends on / blocked by:** v7 promotion.

## QA (2026-10-12, /qa on feat/ucm-figma-redesign)

### Keep Postgres and Redis running (ISSUE-002, High, infrastructure)

- **What:** Add `restart: unless-stopped` to the `postgres` and `redis` services in `docker-compose.yml`.
- **Why:** Both stopped twice on 2026-10-12 (Docker restarts) while every other service came back. With
  Postgres down, approvals and bulk updates are saved to a file but not published ("Saved, but not
  published: the database is unavailable"), and scanner workers go unhealthy without Redis.
- **Repro:** `docker compose ps -a` shows postgres/redis `Exited (0)`; bulk-update any cookies on
  Domain Details → warning toast; API log "Database unavailable, using file storage fallback".
- **Fix after the change:** `docker compose up -d postgres redis && docker compose restart api-gateway ml-api`.

### Scanner times out on most real sites

- **What:** The backend browser hits `Page.goto: Timeout 60000ms` on vodafone.com, att.com and github.com,
  and queued requests then time out too (even example.com after a while; `/api/scan` returns 503).
- **Why:** Most real scans fail; the app now shows these as failed scans with Retry, but no data is collected.
- **Repro:** Launch New Scan → `https://github.com` → Start Scan; API log shows the 60 s goto timeout.

### Consistent page names (ISSUE-003, Low, content)

- **What:** Breadcrumb says "Websites" while the sidebar says "Website"; the Cookie Inventory page heading
  reads "Cookie inventory".

## QA (2026-11-11, /qa on main)

Report: `.gstack/qa-reports/run-20261111T170950Z/qa-report-localhost-2026-11-11.md`. Fixed: ISSUE-001 (classify
payload missing lifetime and site, critical) and ISSUE-002 (fractional `expiry_days` rejected).

### nginx config mount goes stale after a git checkout (ISSUE-006, Medium, infrastructure)

- **Repro:** switch branches or merge so git rewrites `nginx/nginx.conf`, recreate api-gateway, then
  `docker exec cookie-scanner-nginx nginx -s reload` → `open() "/etc/nginx/nginx.conf" failed`.
- **Workaround:** `docker compose restart nginx` (in the runbook). **Fix option:** mount the `nginx/` directory
  instead of single files.

### ML Model page wording (ISSUE-003, ISSUE-004, Low, content)

- The gate `per_cmp_macro_f1` shows as "Per Cmp Macro F1" (missing from `GATE_LABELS` in
  `src/components/ModelPerformancePage.jsx`).
- The headline "Accuracy — Held-out test websites" (and the dashboard's "Classification accuracy") is the strict
  unseen-cookie-name score (60.8% for v7.0.0); the all-cookies score (85.3%) isn't shown. Label it or show both.

### Review Queue Action column off-screen at 1280 px (ISSUE-005, Low, UX)

- **Repro:** open `/review` at 1280 px wide: the table (1057 px) scrolls inside a 904 px container, so Approve/Edit
  need a horizontal scroll.
