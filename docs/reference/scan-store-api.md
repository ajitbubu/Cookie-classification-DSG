# Scan store API

The app's saved data in MongoDB: scans, published versions, scheduled scans and
Review Queue approvals. Routes are under `/api/store` (`backend/api/store_routes.py`,
data access in `backend/db/scan_store.py`, collections in the `MONGODB_DB` database).

The store is the only copy: the app keeps nothing in browser storage. When MongoDB
is unreachable **every route answers 503** `Scan store (MongoDB) is unavailable`;
the API retries the connection at most every 10 s, so the store comes back on its
own once MongoDB does.

Ids in paths and bodies must match `^[A-Za-z0-9_.:@|-]{1,200}$` (422 otherwise).

## Scans

A scan record is the history entry the app builds with `buildHistoryEntry`
(`src/lib/scanPipeline.js`): summary fields at the top, the stored results in
`fullResults`.

| Field | Notes |
|---|---|
| `id` | Required. e.g. `1795364638166-7ffdcimo2` |
| `domain` | Required, 1-253 chars |
| `timestamp` | Required, ISO time |
| `url`, `scanType`, `totalCookies`, `requiresConsent`, `thirdParty`, `categories`, `types`, `pagesScanned`, `failedPages`, `durationMs` | Summary |
| `gdprRisk`, `ccpaRisk`, `dpdpRisk` | `LOW` / `MEDIUM` / `HIGH` from `src/lib/riskCalculator.js` |
| `scheduledJobId` | Set when the [scheduler](scheduler.md) ran the scan |
| `fullResults.cookies` | Classified cookies (stored fields only: `cleanResultsForStorage`) |
| `fullResults.pageResults` | Per page: `url`, `durationMs`, `cookies`. **Left out of the list**; see `GET /scans/{id}` |
| `fullResults.cmp` | The site's banner declaration summary |

Any other fields are stored as sent. **Cookie values are dropped on every save**
(`strip_cookie_values`), wherever they appear.

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /scans` | `?limit=` 1-500 (default 200), `?domain=` | `{"scans": [...]}`, newest first, **without** `fullResults.pageResults` | |
| `GET /scans/{id}` | | The full scan, pages included | 404 |
| `PUT /scans/{id}` | Scan record; `id` must equal the path | `{"id": ...}` | 400 id mismatch, 422 |
| `DELETE /scans/{id}` | | `{"deleted": true}` | 404 |
| `DELETE /scans` | | `{"deleted": <count>}` (all scans) | |

`PUT` replaces the record with the same id (the app saves a scan twice: as soon as
it finishes, then again with the model's results). If the body has
`fullResults` but no `pageResults`, the stored pages are **kept**, so saving a copy
taken from the list can't erase them.

Why pages are left out of the list: the app loads the newest 500 scans at startup,
and per-page copies of cookies were over half the payload (13.9 MB for 500 scans).
Without them the list is about 5.9 MB, about 0.4 MB on the wire through nginx's
gzip. The app fetches `GET /scans/{id}` when a scan is opened.

## Published versions

Which stored scan is the published cookie list for a website.

| Route | Request | Response |
|---|---|---|
| `GET /published` | | `{"published": {"<domain>": {"id": ..., "publishedAt": ...}}}` |
| `PUT /published/{domain}` | `{"id": "<scan id>", "publishedAt": "<ISO>"}` | `{"domain": ..., "id": ...}` |

One version per domain; a new `PUT` replaces it.

## Schedules

Scheduled scans. The app creates and edits them; the [scheduler](scheduler.md)
runs them.

| Field | Owner | Notes |
|---|---|---|
| `id`, `url`, `unit` | app | Required. `unit`: `minutes`, `hourly`, `daily`, `weekly`, `monthly` |
| `scanType`, `interval`, `scheduleTime`, `scheduleDay`, `scheduleDate`, `startDate` | app | When it runs (`scheduleTime` is local to `timeZone`) |
| `timeZone` | app | The creator's IANA time zone, e.g. `America/New_York` |
| `maxPages`, `maxDepth`, `concurrency`, `includeSubdomains` | app | Deep-scan settings |
| `paused`, `createdAt` | app | A paused job is never claimed |
| `nextRun` | both | UTC ISO time. The app sets it on create/reschedule; the scheduler moves it on after each run |
| `lastRun` | scheduler | `{status: "ok", at, scanId, totalCookies, durationMs}` or `{status: "failed", at, error}` |
| `runningSince`, `runningBy` | scheduler | The current claim; absent when idle |

| Route | Request | Response | Errors |
|---|---|---|---|
| `GET /schedules` | | `{"schedules": [...]}` (oldest first) | |
| `PUT /schedules/{id}` | Schedule; `id` must equal the path | `{"id": ...}` | 400, 422 |
| `DELETE /schedules/{id}` | | `{"deleted": true}` | 404 |
| `POST /schedules/claim` | `{"workerId": "...", "staleAfterSeconds": 2700}` (60-86400) | `{"schedule": <job> \| null}` | |
| `POST /schedules/{id}/finish` | `{"workerId", "claimedNextRun", "nextRun", "lastRun"}` | `{"released": true}` | 409 no longer held by this worker |

**`PUT` merges with what the scheduler wrote.** A save from an older copy keeps the
stored `lastRun`, `runningSince` and `runningBy` when the body doesn't send them,
and keeps a later stored `nextRun` unless the job's timing changed (`unit`,
`interval`, `scheduleTime`, `scheduleDay`, `scheduleDate`, `startDate`, `timeZone`).
Changing the timing is a reschedule, so the app's `nextRun` wins.

**`POST /schedules/claim`** atomically picks the most overdue job with
`nextRun <= now`, not paused, and not running (or whose claim is older than
`staleAfterSeconds`, a scheduler that died mid-run), and sets `runningSince` and
`runningBy`. Two schedulers can't get the same job.

**`POST /schedules/{id}/finish`** records `lastRun` and releases the claim, only if
`workerId` still holds it. `nextRun` moves on only if the stored `nextRun` still
equals `claimedNextRun`; a job rescheduled while it ran keeps its new time.

## Approvals

Review Queue decisions, keyed `cookieKey = "<website>:<cookie name>"` (one decision
per cookie name on a website, published for every domain that sets that name).

| Route | Request | Response |
|---|---|---|
| `GET /approvals` | | `{"approvals": [...]}` |
| `POST /approvals` | `{"cookieKey", "name", "domain", "originalCategory", "approvedCategory", "confidence", "action", "timestamp"}` (`cookieKey` required, 1-600 chars) | `{"cookieKey": ...}` |

A second approval for the same `cookieKey` replaces the first.

## Import

`POST /import` with `{"scans": [], "published": {}, "schedules": [], "approvals": []}`
returns counts per collection. The app calls it once per browser to move data saved
before the store existed; repeating it doesn't create duplicates.

## Related

- [Scheduler](scheduler.md)
- [Scan API](scan-api.md)
- [Architecture](../architecture.md)
