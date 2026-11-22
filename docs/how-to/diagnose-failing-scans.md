# How to diagnose failing or slow scans

Find out why a scan failed, timed out or reported failed pages, and fix it. Most
failures this project has seen were the environment (a stopped proxy, an overloaded
Docker), not the scanner, so check those first.

## Prerequisites

- A terminal in the repo root, with Docker running.

## Steps

1. **Ask the API whether scanning can work.**

   ```bash
   curl -s http://localhost:1001/api/health
   ```

   - `"status":"healthy"` and `"egress_proxy":"ok"`: the scanner can reach the web.
     Go to step 3.
   - HTTP 503 `"status":"degraded"`: the egress proxy is down. Go to step 2.
   - No answer: the gateway is down. Go to step 2.

2. **See what's running and bring the stack back.**

   ```bash
   docker compose ps -a
   docker compose up -d
   ```

   The whole stack has been stopped from outside (clean `Exited (0)`) several times;
   `restart: unless-stopped` doesn't undo a deliberate stop. `up -d` restarts only
   what's down.

3. **Check that Docker isn't starved.**

   ```bash
   docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | sort -t$'\t' -k2 -rn | head
   uptime
   ```

   If another project's container is using several hundred percent CPU (one was seen
   at over 500%), scans time out and MongoDB stops answering. Stop it while scanning:
   `docker stop <name>`.

4. **Read the scanner's reason for each failed page.**

   ```bash
   docker logs --since 1h cookie-scanner-api 2>&1 | grep "Error scanning" | sed 's/.*Page.goto: //' | cut -c1-60 | sort | uniq -c
   ```

   Then match the error below.

## Errors and fixes

| Error | Meaning | Fix |
|---|---|---|
| `503 Scanning is unavailable: the scan egress proxy can't be reached` | Egress proxy container stopped | `docker compose up -d egress-proxy` |
| `NS_ERROR_UNKNOWN_PROXY_HOST` | Same, from inside the browser (older builds) | Same |
| `NS_ERROR_ABORT` on many pages of one site | The site cancels page loads when many of its pages load at once | Deep scans retry failed pages one at a time (`MAX_PAGE_RETRIES`). If pages still fail, scan through the API with a lower `concurrency` (the Deep Scan dialog has no concurrency setting; the app always sends 20) |
| `Page.goto: Timeout 60000ms exceeded` | The page didn't load in 60 s: heavy site, or a starved Docker | Step 3; raise `PAGE_TIMEOUT` only for genuinely slow sites |
| `400 Scan target not allowed` | The host resolves to a private or internal address | Scan the public URL; internal targets are blocked on purpose |
| `Scan store ... failed (500)` / `503 Scan store (MongoDB) is unavailable` | MongoDB unreachable or starved | Steps 2-3; the API reconnects by itself within 10 s once Mongo is back |

### Example: "18 of 38 pages failed" on exlservice.com

Every failure was `NS_ERROR_ABORT`. Each failing URL scanned fine alone (4-6 s), and a
12-page deep scan failed 0 pages at concurrency 1 but 9 at concurrency 8. With the
retry, the same scan at concurrency 8 recovered all 9 pages (12/12 in 24 s).

## Verification

Re-run the scan. The Domain Details **Pages** tab lists each page with its
**Duration**; failed pages show **Failed**. The scan banner disappears when no pages
failed.

## Related

- [Scan API](../reference/scan-api.md): errors, settings, retry
- [How to run scheduled scans](run-scheduled-scans.md)
- [Architecture: known gaps](../architecture.md#known-gaps)
