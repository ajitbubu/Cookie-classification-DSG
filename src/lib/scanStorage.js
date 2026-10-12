/**
 * Scan-history persistence helpers.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 *
 * Scan history is kept in localStorage, which has a hard quota. When a write
 * exceeds it we progressively drop the heaviest field (`fullResults`) rather
 * than losing the history entirely. The caller needs to know which tier was
 * reached so it can tell the user: this used to return a bare boolean that
 * nothing checked, so quota loss was invisible outside the console.
 */

/** @typedef {'ok' | 'pruned' | 'failed'} WriteStatus */

/** Strip `fullResults` from entries, keeping the newest when `keepFirst`. */
function stripFullResults(data, keepFirst) {
  const strip = (entry, i) =>
    keepFirst && i === 0 ? entry : { ...entry, fullResults: undefined };

  return Array.isArray(data)
    ? data.map(strip)
    : Object.fromEntries(
        Object.entries(data).map(([domain, scans]) => [domain, scans.map(strip)])
      );
}

/**
 * Write to localStorage, shedding detail as needed to fit the quota.
 *
 * @param {string} key
 * @param {unknown} data
 * @returns {WriteStatus} `ok` full write, `pruned` saved without some detail,
 *   `failed` nothing was saved.
 */
export function writeLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return 'ok';
  } catch {
    // Quota exceeded — keep the newest entry whole, strip detail from the rest.
    try {
      localStorage.setItem(key, JSON.stringify(stripFullResults(data, true)));
      return 'pruned';
    } catch {
      // Still too big — drop detail from everything.
      try {
        localStorage.setItem(key, JSON.stringify(stripFullResults(data, false)));
        return 'pruned';
      } catch (e) {
        console.error(`Cannot save "${key}" even after pruning:`, e);
        return 'failed';
      }
    }
  }
}

/*
 * Readers for the browser-stored data the redesigned screens use (plan 7.1,
 * E2). Entries are capped and the capped copy is saved back. Every entry
 * keeps its `fullResults`; detail is only shed by writeLocalStorage when the
 * quota is actually hit. Malformed data resets to empty instead of crashing.
 */
export const MAX_SCAN_HISTORY = 50;
export const MAX_SCANS_PER_DOMAIN = 10;

function saveQuietly(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota: writeLocalStorage handles real writes */ }
}

export function readScanHistory() {
  try {
    const saved = localStorage.getItem('cookieScanHistory');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem('cookieScanHistory');
      return [];
    }
    const pruned = parsed.slice(0, MAX_SCAN_HISTORY);
    saveQuietly('cookieScanHistory', pruned);
    return pruned;
  } catch (e) {
    console.error('Failed to load scan history:', e);
    try { localStorage.removeItem('cookieScanHistory'); } catch { /* storage unavailable */ }
    return [];
  }
}

export function readDomainHistory() {
  try {
    const saved = localStorage.getItem('domainScanHistory');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const pruned = {};
    for (const [domain, scans] of Object.entries(parsed)) {
      if (!Array.isArray(scans)) continue;
      pruned[domain] = scans.slice(0, MAX_SCANS_PER_DOMAIN);
    }
    saveQuietly('domainScanHistory', pruned);
    return pruned;
  } catch {
    return {};
  }
}

export function readScheduledJobs() {
  try {
    const saved = localStorage.getItem('scheduledJobs');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.map((j) => ({ ...j, timerId: null, countdownId: null, timeLeft: null }))
      : [];
  } catch {
    return [];
  }
}

/*
 * Active scan record (E5, eng R5). Written when a scan starts and cleared when
 * it ends; a leftover record on the next load means the tab was refreshed or
 * closed mid-scan, so Active Scan can offer to rescan.
 */
const ACTIVE_SCAN_KEY = 'activeScan';

const hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return url; }
};

export function markScanStarted({ url, type, settings }, startedAt = new Date().toISOString()) {
  const record = { url, domain: hostOf(url), type, startedAt, ...(settings ? { settings } : {}) };
  saveQuietly(ACTIVE_SCAN_KEY, record);
  return record;
}

export function clearActiveScan() {
  try { localStorage.removeItem(ACTIVE_SCAN_KEY); } catch { /* storage unavailable */ }
}

export function readInterruptedScan() {
  try {
    const record = JSON.parse(localStorage.getItem(ACTIVE_SCAN_KEY) || 'null');
    if (!record || typeof record.url !== 'string' || !record.url) return null;
    return {
      url: record.url, domain: record.domain || hostOf(record.url), type: record.type, startedAt: record.startedAt,
      ...(record.settings ? { settings: record.settings } : {}),
    };
  } catch {
    return null;
  }
}
