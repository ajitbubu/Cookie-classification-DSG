/**
 * Scan list helpers for the Scan Results and Active Scan pages. Framework-free.
 */

// Completed, or Partial with the exact failed-page count (decision 9A).
export function scanStatus(entry) {
  const failed = entry?.failedPages || 0;
  return failed > 0 ? { status: 'partial', failed } : { status: 'completed', failed: 0 };
}

export function scanResultsSummary(history = []) {
  const latest = new Map();
  for (const scan of history) {
    const current = latest.get(scan.domain);
    if (!current || scan.timestamp > current.timestamp) latest.set(scan.domain, scan);
  }
  let cookies = 0;
  for (const scan of latest.values()) cookies += scan.totalCookies || 0;
  return {
    scans: history.length,
    websites: latest.size,
    cookies,
    withFailures: history.filter((scan) => (scan.failedPages || 0) > 0).length,
  };
}

const DAY_MS = 86400000;

// One KPI over a set of scans; each metric returns null when it can't be known.
const METRICS = {
  totalScans: (scans) => scans.length,
  pagesScanned: (scans) => scans.reduce((n, s) => n + (s.pagesScanned || 0), 0),
  avgDurationMs: (scans) => {
    const timed = scans.filter((s) => s.durationMs > 0);
    return timed.length ? timed.reduce((n, s) => n + s.durationMs, 0) / timed.length : null;
  },
  successRate: (scans) => (scans.length ? scans.filter((s) => !(s.failedPages > 0)).length / scans.length : null),
};

/**
 * Figma Scan Result KPIs (12.10.31): Total Scan, Avg. Scan Duration, Success
 * Rate, Pages Scanned. `trend` is the change from the previous 7 days to the
 * last 7 days (0.12 = +12%), or null when either week has no data.
 */
export function scanResultKpis(history = [], now = Date.now()) {
  const inWindow = (from, to) => history.filter((s) => {
    const t = Date.parse(s.timestamp);
    return t > now - from * DAY_MS && t <= now - to * DAY_MS;
  });
  const thisWeek = inWindow(7, 0);
  const lastWeek = inWindow(14, 7);
  const out = {};
  for (const [key, metric] of Object.entries(METRICS)) {
    const current = metric(thisWeek);
    const previous = metric(lastWeek);
    const trend = lastWeek.length && thisWeek.length && current != null && previous ? (current - previous) / previous : null;
    out[key] = { value: metric(history), trend };
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

/** Figma date format: 11-11-2026 05:56:17 (local time). */
export function formatScanDate(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Pages as done/attempted, e.g. 189/200. */
export function pagesLabel(entry) {
  if (entry?.pagesScanned == null) return '—';
  return `${entry.pagesScanned}/${entry.pagesScanned + (entry.failedPages || 0)}`;
}

const cookieId = (c) => `${c.name}|${c.domain}`;

/** Cookies in this scan that the previous scan of the same website did not have. */
export function newCookieCount(entry, history = []) {
  const current = entry?.fullResults?.cookies;
  if (!current) return entry?.totalCookies ?? 0;
  const previous = history
    .filter((s) => s.domain === entry.domain && s.id !== entry.id && s.timestamp < entry.timestamp && s.fullResults?.cookies)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];
  if (!previous) return current.length;
  const seen = new Set(previous.fullResults.cookies.map(cookieId));
  return current.filter((c) => !seen.has(cookieId(c))).length;
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function describeSchedule(job) {
  const time = job.scheduleTime || '09:00';
  switch (job.unit) {
    case 'minutes':
      return job.interval === 1 ? 'Every minute' : `Every ${job.interval} minutes`;
    case 'hourly':
      return job.interval === 1 ? 'Every hour' : `Every ${job.interval} hours`;
    case 'daily':
      return `Daily at ${time}`;
    case 'weekly':
      return `Weekly on ${capitalize(job.scheduleDay || 'sunday')} at ${time}`;
    case 'monthly':
      return `Monthly on day ${job.scheduleDate || 1} at ${time}`;
    default:
      return 'Repeating';
  }
}
