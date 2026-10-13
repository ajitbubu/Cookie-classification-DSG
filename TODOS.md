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
