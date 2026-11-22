# Scheduler

The `scheduler` service runs scheduled scans on the server, whether or not anyone has
the app open. Every 30 seconds it claims the jobs that are due from the
[scan store](scan-store-api.md#schedules), scans each one, builds the record with the
same code the app uses (`src/lib/scanPipeline.js`), saves it, and moves the job on to
its next run.

Code: `scheduler/index.js` (loop, settings, heartbeat) and `scheduler/runner.js`
(one run). Container: `scheduler` in `docker-compose.yml`.

## What one run does (`runDueJobs` → `runJob`)

1. `POST /api/store/schedules/claim` with this worker's id. `null` means nothing is due.
2. Scan:
   - quick: `POST /api/scan` (`{url, scanType: "quick"}`, 120 s timeout);
   - deep: `POST /api/scan-stream` through `DeepScanner`, with the job's `maxPages`
     (default 10), `concurrency` (20), `maxDepth` (3) and `includeSubdomains`.
3. Classify: `POST /api/v1/ml/classify`, with the rule fallback when the model is down.
4. `applyClassifications` + `buildHistoryEntry`: the same publish policy,
   site-declaration rule, statistics and GDPR/CCPA/DPDP risk as a scan run in the app.
   The record gets `scheduledJobId`.
5. `PUT /api/store/scans/{id}`.
6. `POST /api/store/schedules/{id}/finish` with `lastRun` and the next run.
7. Repeat from 1 until nothing is due.

A failed scan records `lastRun: {status: "failed", at, error}` and still moves the
job on, so a broken site doesn't block the queue. The next run is computed **from the
time the run finished**, in the job's `timeZone` (`nextRunIn` switches `TZ` for that
calculation). A job that was overdue for days runs **once**, then continues normally.

## Settings (environment)

| Variable | Default | Effect |
|---|---|---|
| `API_BASE_URL` | `http://api-gateway:1001` | Where the scan, classify and store APIs are |
| `WORKER_ID` | `scheduler-<hostname>` | Claim owner; characters outside `A-Za-z0-9_.:@\|-` become `-` |
| `TICK_SECONDS` | `30` | Pause between checks for due jobs |
| `SCHEDULER_DEFAULT_TIME_ZONE` | `UTC` | Time zone for jobs saved without `timeZone` (the app fills it in on load) |

Claims older than 45 minutes (`staleAfterSeconds: 2700`) are taken over, so a scheduler
that died mid-scan doesn't hold a job forever.

## Container

- Image: the frontend's (`docker/Dockerfile.frontend`, node:22). At start it bundles
  `scheduler/` with `src/lib` using esbuild and runs the bundle with plain Node:

  ```
  npx esbuild scheduler/index.js --bundle --platform=node --format=esm --target=node22 \
    --outfile=/tmp/scheduler.mjs && exec node /tmp/scheduler.mjs
  ```

- Mounts `./src` and `./scheduler` read-only: restart the container to pick up code changes.
- Healthcheck: `/tmp/scheduler-heartbeat` is touched after every tick; the container is
  `unhealthy` if it is older than 2 minutes.
- `depends_on: api-gateway (healthy)`, `restart: unless-stopped`.
- SIGTERM/SIGINT: finishes the current job, then exits.

## Log lines

```
2026-11-22T13:12:44.644Z INFO Scheduler scheduler-b843ea8eb024 started: http://api-gateway:1001, every 30s, default time zone UTC
2026-11-22T13:12:44.694Z INFO Running scheduled quick scan test-okta: https://www.okta.com
2026-11-22T13:12:49.790Z INFO Scheduled scan test-okta saved as 1795353169322-3v6ef00cw (10 cookies)
2026-11-22T13:20:05.728Z ERROR Tick failed: Scan store POST /schedules/claim failed (500)
```

A quiet log is normal: nothing is printed while no job is due.

## In the app

- Creating a schedule runs its **first** scan in the browser, so you see it; the
  scheduler runs every later one. The app doesn't run schedule timers itself.
- New and rescheduled jobs save the browser's `timeZone`.
- Every 60 s the app reloads schedules and adds any scans the scheduler saved, with a
  toast "Scheduled scan of <site> finished: N cookies."
- Schedule cards on Active Scan show "Last run <time> · N cookies",
  "Last run failed <time>: <reason>", or "Scanning now".

## Related

- [How to run scheduled scans](../how-to/run-scheduled-scans.md)
- [Why scheduled scans run on the server](../explanation/server-side-scheduling.md)
- [Scan store API: schedules](scan-store-api.md#schedules)
