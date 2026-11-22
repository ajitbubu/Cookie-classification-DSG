# Scan API

The endpoints that check a website for cookies, and the health check that says
whether scanning can work right now. All routes are under `/api` on the
api-gateway (`backend/api/routes.py`): `http://localhost:1001/api/...` directly, or
`http://localhost/api/...` through nginx (basic-auth login).

Scans load real pages in a headless Firefox. Every page goes through the egress
proxy, and cookie **values are never returned** (only names, attributes and three
value features the model uses).

## `GET /api/health`

Whether the API is up and scanning can work.

| Field | Type | Meaning |
|---|---|---|
| `status` | `"healthy"` \| `"degraded"` | `degraded` when any check fails |
| `timestamp` | ISO time | Server time of the check |
| `version` | string | `"1.0.0"` |
| `checks.egress_proxy` | string | `"ok"`, `"not_configured"` (no `SCAN_EGRESS_PROXY`, local runs) or the reason it is unreachable |

HTTP **200** when healthy, **503** when degraded. Docker's healthcheck for
`api-gateway` calls this endpoint, so a down egress proxy shows the gateway as
`unhealthy` in `docker compose ps`.

```bash
curl -s http://localhost:1001/api/health
# {"status":"healthy","timestamp":"2026-11-22T17:07:53.630906","version":"1.0.0","checks":{"egress_proxy":"ok"}}
```

Degraded example (egress proxy stopped):

```json
{"status": "degraded", "checks": {"egress_proxy": "egress-proxy:3128 unreachable (gaierror: [Errno -2] Name or service not known)"}}
```

## `POST /api/scan`

Runs a scan and returns the whole result when it finishes. Use it for quick scans
and scripts; the app uses `/api/scan-stream` for deep scans so it can show progress.

### Request body (`ScanRequest`, `backend/models.py`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `url` | string | required | `http://` or `https://` only; a non-public IP literal is rejected (422). The host is resolved before the scan and refused if it points at a private address (400). |
| `scanType` | `"quick"` \| `"deep"` | `"quick"` | Quick: one page. Deep: follows links. |
| `maxPages` | int | `20000` | Deep only. The app sends 10 by default. |
| `concurrency` | int | `50` | Deep only: pages loaded at once. The app sends 20. |
| `maxDepth` | int | `500` | Deep only: link depth. The app sends 3. |
| `includeSubdomains` | bool | `false` | Deep only: also follow links to subdomains of the site. |

### Response (quick scan)

| Field | Notes |
|---|---|
| `scanType`, `domain`, `scannedUrl`, `scannedAt` | `domain` is the URL's host |
| `cookies` | One entry per cookie: see [Cookie fields](#cookie-fields) |
| `totalCount` | Number of cookies |
| `statistics` | Counts by category and type, consent and third-party totals |
| `pageResults` | `[page]`: see [Page fields](#page-fields) |
| `totalPagesScanned` | `1` |
| `dataSource` | `"browser_scan"` |
| `cmp` | The site's OneTrust/Cookiebot declaration summary, or `null`: `{vendor, declared, matched, url}` |

A deep scan also returns `errorPages` (URLs that failed even after the retry),
`maxDepthReached`, and `pageResults` for every page.

### Errors

| Status | When |
|---|---|
| 400 | `Scan target not allowed: ...`: the host resolves to a private or internal address |
| 422 | Body fails validation (bad scheme, IP literal, wrong types) |
| 503 | `Scanning is unavailable: the scan egress proxy can't be reached. Other features still work.` |
| 503 | `Browser scanning unavailable: <reason>`: the page or browser failed |

```bash
curl -s -X POST http://localhost:1001/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://www.okta.com", "scanType": "quick"}'
```

## `POST /api/scan-stream`

Same request body as `/api/scan`. Returns Server-Sent Events (`text/event-stream`),
one JSON object per `data:` line:

| `type` | Fields | When |
|---|---|---|
| `progress` | `current`, `total`, `status`, `currentUrl`, `message` (varies) | While scanning |
| `complete` | `result` (same shape as `/api/scan`) | Once, at the end |
| `error` | `status: "error"`, `message` | The scan failed after it started |

Deep-scan `status` values, in order: `starting`, `scanning` (per batch),
`extracting`, `retrying` ("Retrying failed page N of M", see below), `aggregating`.

The egress-proxy check, the target check and a browser launch happen **before**
the stream opens, so those failures come back as normal HTTP errors (400/503), not
as an `error` event.

```bash
curl -s -N -X POST http://localhost:1001/api/scan-stream \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://www.verizon.com", "scanType": "deep", "maxPages": 5, "concurrency": 3, "maxDepth": 2}'
```

### Failed pages are retried

After the parallel crawl, a deep scan re-scans each failed page once, one at a time
(`retry_failed_pages` in `backend/scanner/parallel.py`, up to `MAX_PAGE_RETRIES`).
A page that loads on retry replaces its failed entry and leaves `errorPages`. Some
sites cancel page loads when many of their pages load at once (Firefox
`NS_ERROR_ABORT`); see [how to diagnose failing scans](../how-to/diagnose-failing-scans.md).

## Cookie fields

Each cookie in `cookies` (built by `CookieClassifier.classify` in
`backend/scanner/classifier.py`):

| Field | Notes |
|---|---|
| `name`, `domain`, `path`, `expires`, `httpOnly`, `secure`, `sameSite` | From the browser (`expires` is epoch seconds, `-1` for session cookies) |
| `category`, `type`, `purpose`, `isThirdParty`, `requiresConsent` | The rule engine's first guess (the app replaces `category` after `/api/v1/ml/classify`) |
| `size` | Length of the value in characters |
| `value_length`, `value_is_uuid`, `value_is_base64` | The model's value features, from the first 50 characters (`backend/scanner/cookie_values.py`) |
| `websiteDeclaration` | Present when the site's banner declares this cookie: `{category, group, cmp, provider, declaredDuration}`. `category` is `null` when the site's group maps to none of ours. See [site declarations](../explanation/site-declarations.md). |

There is **no `value` field**. The browser reads values, the scanner drops them.

## Page fields

Each entry in `pageResults`:

| Field | Notes |
|---|---|
| `url`, `domain`, `scannedAt` | |
| `cookies`, `cookieCount` | Cookies in the browser after this page loaded. In a deep scan the browser's cookie jar is shared, so later pages also include earlier pages' cookies. |
| `durationMs` | Time to open the page, load it, wait for cookies and read them (failed pages too) |
| `error` | `null`, or why the page failed |
| `cmp` | Only on the page that read the declaration (quick scan page, deep scan start page) |

## Settings

Typed fields in `backend/config.py` (environment variables of the same name):

| Setting | Default | Effect |
|---|---|---|
| `SCAN_EGRESS_PROXY` | `""` | Proxy every scanning browser uses; docker-compose sets `http://egress-proxy:3128`. Empty = no proxy and no health check. |
| `PAGE_TIMEOUT` | `60000` | Page load timeout (ms) |
| `COOKIE_WAIT_TIME` | `0.5` | Seconds to wait after load before reading cookies |
| `CMP_DECLARATION_WAIT_MS` | `4000` | Longest wait for a detected OneTrust/Cookiebot banner to expose its declaration; pages without one aren't delayed |
| `MAX_PAGE_RETRIES` | `50` | Failed deep-scan pages retried one at a time; `0` turns retries off |

## Related

- [Scan store API](scan-store-api.md): where the app saves scans
- [How to diagnose failing scans](../how-to/diagnose-failing-scans.md)
- [Site declarations](../explanation/site-declarations.md)
- [How a cookie gets its category](../cookie-classification-flow.md)
