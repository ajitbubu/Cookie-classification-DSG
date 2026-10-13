/**
 * Client for the MongoDB scan store (`/api/store`, backend/api/store_routes.py).
 *
 * The store is the single source of truth for scans, published versions,
 * scheduled jobs and review approvals. Nothing is kept in localStorage: a
 * failed call throws, and the caller tells the user.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 */
import { MAX_SCAN_HISTORY, MAX_SCANS_PER_DOMAIN } from './scanStorage';

const BASE = '/api/store';

/** Newest scans loaded at startup (the backend caps a list call at 500). */
export const STORE_SCAN_LIMIT = 500;

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`Scan store ${method} ${path} failed (${res.status})`);
  return res.json();
}

const enc = encodeURIComponent;

/**
 * App history state from stored scans (newest first): the newest
 * MAX_SCAN_HISTORY overall, and up to MAX_SCANS_PER_DOMAIN per domain.
 */
export function historyFromScans(scans) {
  const domainHistory = {};
  for (const scan of scans) {
    const list = (domainHistory[scan.domain] ||= []);
    if (list.length < MAX_SCANS_PER_DOMAIN) list.push(scan);
  }
  return { scanHistory: scans.slice(0, MAX_SCAN_HISTORY), domainHistory };
}

export const listScans = async (limit = STORE_SCAN_LIMIT) => (await request(`/scans?limit=${limit}`)).scans || [];
export const saveScan = (scan) => request(`/scans/${enc(scan.id)}`, { method: 'PUT', body: scan });
export const deleteScan = (id) => request(`/scans/${enc(id)}`, { method: 'DELETE' });
export const clearScans = () => request('/scans', { method: 'DELETE' });

export const listPublished = async () => (await request('/published')).published || {};
export const savePublished = (domain, record) => request(`/published/${enc(domain)}`, { method: 'PUT', body: record });

// Timer handles are runtime state, not part of the job.
const storedJob = ({ timerId, countdownId, timeLeft, ...job }) => job;
export const listSchedules = async () => (await request('/schedules')).schedules || [];
export const saveSchedule = (job) => request(`/schedules/${enc(job.id)}`, { method: 'PUT', body: storedJob(job) });
export const deleteSchedule = (id) => request(`/schedules/${enc(id)}`, { method: 'DELETE' });

export const listApprovals = async () => (await request('/approvals')).approvals || [];
export const saveApproval = (approval) => request('/approvals', { method: 'POST', body: approval });

/*
 * One-time import of what this browser saved before the store existed. The
 * first load uploads it, then removes the keys so the store stays the only copy.
 */
const LEGACY_KEYS = ['cookieScanHistory', 'domainScanHistory', 'scheduledJobs', 'publishedVersions', 'reviewQueueApprovals'];

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

// Same rule as STORE_ID_PATTERN in backend/models.py: one bad record would fail the whole import.
const STORE_ID = /^[A-Za-z0-9_.:@|-]{1,200}$/;
const isScan = (s) => s && STORE_ID.test(s.id) && typeof s.domain === 'string' && s.domain && s.domain.length <= 253
  && typeof s.timestamp === 'string' && s.timestamp.length <= 40;

/** The browser's saved data in import shape, or null when there is none. */
export function readLegacyBrowserData() {
  const history = readJson('cookieScanHistory', []);
  const byDomain = readJson('domainScanHistory', {});
  const scans = new Map();
  for (const scan of [
    ...(Array.isArray(history) ? history : []),
    ...(byDomain && typeof byDomain === 'object' ? Object.values(byDomain).flat() : []),
  ]) {
    // Keep the copy that still has its detail.
    if (isScan(scan) && (!scans.has(scan.id) || (!scans.get(scan.id).fullResults && scan.fullResults))) scans.set(scan.id, scan);
  }

  const jobs = readJson('scheduledJobs', []);
  const schedules = (Array.isArray(jobs) ? jobs : [])
    .filter((j) => j && STORE_ID.test(String(j.id)) && typeof j.url === 'string' && j.url && typeof j.unit === 'string')
    .map((j) => storedJob({ ...j, id: String(j.id) }));

  const publishedRaw = readJson('publishedVersions', {});
  const published = Object.fromEntries(Object.entries(publishedRaw && typeof publishedRaw === 'object' ? publishedRaw : {})
    .filter(([domain, rec]) => STORE_ID.test(domain) && rec && STORE_ID.test(rec.id)));

  const log = readJson('reviewQueueApprovals', []);
  // One approval per cookie: the latest wins, as in the store.
  const approvals = [...new Map((Array.isArray(log) ? log : []).filter((a) => typeof a?.cookieKey === 'string' && a.cookieKey && a.cookieKey.length <= 600).map((a) => [a.cookieKey, a])).values()];

  const data = { scans: [...scans.values()], published, schedules, approvals };
  const empty = !data.scans.length && !schedules.length && !approvals.length && !Object.keys(published).length;
  return empty ? null : data;
}

export function clearLegacyBrowserData() {
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
}

/** Upload this browser's saved data once. Keeps it if the upload fails, so the next load retries. */
export async function importLegacyBrowserData() {
  const data = readLegacyBrowserData();
  if (!data) return null;
  const counts = await request('/import', { method: 'POST', body: data });
  clearLegacyBrowserData();
  return counts;
}

/**
 * Everything the app needs at startup, after the one-time import. A failed
 * import does not block the app (`imported.failed`); it is retried next load.
 */
export async function loadStore() {
  let imported;
  try {
    imported = await importLegacyBrowserData();
  } catch (e) {
    console.error('Import of browser-saved scans failed:', e);
    imported = { failed: true };
  }
  const [scans, published, schedules, approvals] = await Promise.all([listScans(), listPublished(), listSchedules(), listApprovals()]);
  return { scans, published, schedules, approvals, imported };
}
