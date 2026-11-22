/**
 * Server-side scheduled scans: claim due jobs from the scan store, run them, and
 * save the result exactly as the app would.
 *
 * The record is built by src/lib/scanPipeline.js, the same code the browser uses,
 * so a scheduled scan and a scan started in the app are stored identically. Jobs are
 * claimed atomically (POST /api/store/schedules/claim), so two schedulers or a
 * restart never run one job twice; a missed run happens once, then the schedule
 * continues from now.
 */
import { applyClassifications, buildHistoryEntry, classifyCookies, fetchWithTimeout, newScanId } from '../src/lib/scanPipeline';
import { claimSchedule, finishScheduleRun, saveScan } from '../src/lib/scanApi';
import { responseErrorMessage } from '../src/lib/apiError';
import { nextRunTime } from '../src/lib/schedule';
import { DeepScanner } from '../src/lib/DeepScanner';

const hostOf = (url) => {
  try { return new URL(url).hostname; } catch { return url; }
};

/**
 * nextRunTime in the job's own time zone. Schedule times ("02:00", "every Monday")
 * are the creator's local time, and nextRunTime works in the process's local time,
 * so TZ is switched for the (synchronous) computation.
 */
export function nextRunIn(job, now, defaultTimeZone = 'UTC') {
  const previous = process.env.TZ;
  process.env.TZ = job.timeZone || defaultTimeZone;
  try {
    return nextRunTime(job, now);
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
}

/** The scanner's result for a job: /api/scan for quick, /api/scan-stream for deep. */
export async function scanSite(job, { baseUrl, fetchImpl = fetch }) {
  if (job.scanType === 'deep') {
    // The app's deep-scan defaults when a job has no crawl settings (App.jsx).
    const deep = new DeepScanner({
      maxPages: job.maxPages ?? 10, concurrency: job.concurrency ?? 20, maxDepth: job.maxDepth ?? 3,
      includeSubdomains: Boolean(job.includeSubdomains), backendUrl: baseUrl,
    });
    const results = await deep.deepScan(job.url, null, () => {});
    return { ...results, domain: hostOf(job.url), scannedUrl: job.url, scanType: 'deep' };
  }
  const response = await fetchWithTimeout(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: job.url, scanType: 'quick', maxPages: 1, concurrency: 1, maxDepth: 1 }),
  }, 120000, fetchImpl);
  if (!response.ok) throw new Error(await responseErrorMessage(response, 'HTTP '));
  return response.json();
}

/** Scan, classify, build the store record and save it; returns the job's lastRun. */
export async function runJob(job, { baseUrl, fetchImpl = fetch, log = console, now = () => new Date() }) {
  const started = Date.now();
  const results = await scanSite(job, { baseUrl, fetchImpl });
  const scanned = { ...results, scanDuration: Date.now() - started, _scanId: newScanId() };
  const cookies = scanned.cookies || [];
  const classified = cookies.length
    ? applyClassifications(scanned, await classifyCookies(cookies, scanned.domain, { fetchImpl, baseUrl, log }))
    : scanned;
  const entry = { ...buildHistoryEntry(classified, { now: now() }), scheduledJobId: job.id };
  await saveScan(entry);
  return { status: 'ok', at: entry.timestamp, scanId: entry.id, totalCookies: entry.totalCookies, durationMs: entry.durationMs };
}

/** Run every job that is due right now, one at a time; returns how many ran. */
export async function runDueJobs({ workerId, baseUrl, fetchImpl = fetch, log = console, now = () => new Date(), defaultTimeZone = 'UTC' }) {
  let ran = 0;
  for (let job = await claimSchedule(workerId); job; job = await claimSchedule(workerId)) {
    log.info(`Running scheduled ${job.scanType || 'quick'} scan ${job.id}: ${job.url}`);
    let lastRun;
    try {
      lastRun = await runJob(job, { baseUrl, fetchImpl, log, now });
      log.info(`Scheduled scan ${job.id} saved as ${lastRun.scanId} (${lastRun.totalCookies} cookies)`);
    } catch (error) {
      lastRun = { status: 'failed', at: now().toISOString(), error: String(error?.message || error).slice(0, 300) };
      log.error(`Scheduled scan ${job.id} failed: ${lastRun.error}`);
    }
    const nextRun = nextRunIn(job, now(), defaultTimeZone).toISOString();
    await finishScheduleRun(job.id, { workerId, claimedNextRun: job.nextRun, nextRun, lastRun });
    ran += 1;
  }
  return ran;
}
