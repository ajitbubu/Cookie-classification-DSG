# How to run scheduled scans

Set up a website to be scanned on a schedule, check that the server runs it, and
pause or stop it.

## Prerequisites

- The full stack is running: `docker compose up -d` (12 services, including
  `scheduler`).
- `docker compose ps` shows `scheduler` and `api-gateway` as `healthy`.

## Steps

1. **Create the schedule.** In the app, open **Scanning → New Scan → Schedule Scan**.
   Enter the URL, choose Quick or Deep, and the repeat (every N minutes, hourly,
   daily, weekly or monthly). Times are in your browser's time zone.

   The first scan starts right away in your browser. The card on **Active Scan** shows
   "Next run <time>".

2. **Watch the server run the next one.**

   ```bash
   docker logs -f cookie-scanner-scheduler
   ```

   At the next run time (within 30 s) you'll see:

   ```
   INFO Running scheduled quick scan 1785173843614: https://att.com
   INFO Scheduled scan 1785173843614 saved as 1795353169322-3v6ef00cw (32 cookies)
   ```

3. **See the result in the app.** Within a minute the app shows a toast
   "Scheduled scan of att.com finished: 32 cookies." and the schedule card shows
   "Last run <time> · 32 cookies". The scan is in **Scan Results** like any other.

4. **Pause, reschedule or stop it** from the schedule card on **Active Scan**:
   **Pause** (kept, never run until Resumed), **Reschedule**, or **Cancel Scan**
   (deletes the schedule; its past scans stay).

## Verification

- The app doesn't need to be open: close every tab, wait one interval, and the
  scheduler log still shows the run. Reopen the app and the scan is in Scan Results.
- From the command line:

  ```bash
  curl -s http://localhost:1001/api/store/schedules | python3 -m json.tool
  ```

  Each job shows `nextRun` (UTC) in the future and, after a run, `lastRun`.

## Turn server-side scheduling off and on

```bash
docker compose stop scheduler      # schedules stop running (the app doesn't run them either)
docker compose up -d scheduler     # back on; overdue jobs run once, then continue
```

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Card says "Last run failed <time>: Scanning is unavailable: the scan egress proxy can't be reached." | Egress proxy down | `docker compose up -d egress-proxy`; see [diagnose failing scans](diagnose-failing-scans.md) |
| Log: `Tick failed: Scan store POST /schedules/claim failed (500)` | MongoDB not reachable (often an overloaded Docker or a sleep) | `docker compose ps`; bring Mongo back with `docker compose up -d mongo` |
| Log: `Tick failed: fetch failed` once at start | The gateway was restarting | Nothing; the next tick works |
| `scheduler` is `unhealthy` | No tick in 2 minutes | `docker logs cookie-scanner-scheduler`; `docker compose restart scheduler` |
| Next run shows the wrong hour | Job saved without a time zone, scheduler used `UTC` | Open the app once (it fills in your time zone), or reschedule the job |
| Nothing runs at all | Scheduler stopped, or the job is paused | `docker compose up -d scheduler`; Resume the job |

## Related

- [Scheduler reference](../reference/scheduler.md)
- [Why scheduled scans run on the server](../explanation/server-side-scheduling.md)
