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

### Persist scans, domain versions and schedules (replace the redesign's mock data)

- **What:** Postgres tables + API for scan history, domain versions (diffs, published-by, Publish), scheduled
  jobs (cancel / reschedule) and per-domain pages / failed pages; then remove each mock source marked
  `gstack-shortcut(dec-e124b922)` and its "Sample data" chip.
- **Why:** Scan data lives only in one browser's localStorage, so teams cannot share results, and the
  redesign's Version History, Publish, Cancel/Reschedule and Pages panels show sample data (decision 24C).
- **Pros:** Real multi-user data; Publish and versions become real; every "Sample data" chip goes away.
- **Cons:** Weeks of backend work plus SQL migrations (human ~3-4 wks / CC ~3-4 days).
- **Context:** `docs/plans/ucm-figma-redesign.md` sections 7 and 7.1 list every mocked panel and its
  current source. The backend exposes only `/api/scan` and `/api/scan-stream` for scans today. The
  2026-08-05 CEO review blocked three items pending the same persistence investigation.
- **Depends on / blocked by:** Nothing; unblocks removing the 24C mocks.
