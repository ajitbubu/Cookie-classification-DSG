# Why scheduled scans run on the server

A scheduled scan should run at its time whether or not anyone has the app open. Until
2026-11-22 it didn't: the schedule timers lived in the browser tab, so a "daily at
02:00" scan only ran if a tab happened to be open at 02:00. The `scheduler` service now
runs them, using the app's own code so a scheduled scan is saved exactly like one you
start yourself.

## The problem

- **Schedules needed an open tab.** Close the laptop and nothing ran. Reopen it and
  every overdue daily job ran at once.
- **Times went stale.** A job's `nextRun` was only updated by a tab, so the app showed
  next-run times that had already passed.
- **Two tabs, two runs.** Every open tab ran its own timers.

## The approach

```
  app (browser)                          scheduler (Node, every 30 s)
  ─────────────                          ─────────────────────────────
  create / edit / pause job   ──PUT──►   ┌──────────── MongoDB schedules ───────────┐
  first run of a new job                 │ nextRun, timeZone, paused, lastRun, claim │
  shows lastRun, refreshes 60 s ◄─GET─   └──────────────────────────────────────────┘
                                                   ▲ claim (atomic)   │ finish
                                                   │                  ▼
                                          scan ─► classify ─► scanPipeline.js ─► save scan
```

1. **One pipeline, two callers.** Everything between a scanner's response and the scan
   store (classify call, publish policy, site-declaration rule, statistics, risk,
   stored fields) moved from `App.jsx` into `src/lib/scanPipeline.js`. The app and the
   scheduler both import it, so their records can't drift apart.
2. **Node, not Python.** The scheduler runs the same JavaScript as the app, bundled with
   esbuild into one file for plain Node. A Python port would have meant keeping the risk
   rules and publish policy in two languages.
3. **Claims, not locks in memory.** A job is claimed with one atomic MongoDB
   find-and-update (`nextRun <= now`, not paused, not running). Two schedulers, or a
   restart mid-run, can't run a job twice. A claim older than 45 minutes is taken over.
4. **The server owns `nextRun`.** After a run it moves `nextRun` on, but only if nobody
   rescheduled the job meanwhile. An app save from an older copy can't move it back:
   the store keeps the later time unless the job's timing changed.
5. **Time zones travel with the job.** "02:00" means 02:00 where the schedule was
   created. Jobs store the browser's IANA `timeZone`, and the scheduler computes the next
   run in it. Jobs from before this get the next browser's time zone on load.

## Trade-offs

- **A new service.** One more container (small: Node, no browser). It has a heartbeat
  healthcheck, so `docker compose ps` shows when it stops ticking.
- **No progress bar for server runs.** A scheduled scan running on the server appears
  as "Scanning now" on its card, not as a live progress bar; results arrive with the
  app's next 60-second refresh.
- **A missed run happens once, then moves on.** If the scheduler is down for a day, a
  daily job runs once when it returns, not once per missed day.
- **The first run still happens in the browser.** Creating a schedule starts its first
  scan right away in the tab, so you see it work.

## Alternatives considered

- **Celery beat with the scanner workers.** `celery` is in `requirements.txt` and the
  three workers poll a Redis queue, but nothing enqueues work and the post-scan
  pipeline is JavaScript. Using them meant porting the pipeline to Python.
- **An asyncio task inside the API.** Simplest to deploy, but it would run once per
  gunicorn worker (several schedulers in one container) and still need the Python port.

## Related

- [Scheduler reference](../reference/scheduler.md)
- [How to run scheduled scans](../how-to/run-scheduled-scans.md)
- [Scan store API: schedules](../reference/scan-store-api.md#schedules)
