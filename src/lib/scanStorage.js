/**
 * Browser-local scan state and history limits.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 *
 * Scans, schedules, publishes and approvals live in the scan store
 * (lib/scanApi.js). Only the in-progress scan record stays in this browser,
 * because it describes this tab.
 */
export const MAX_SCAN_HISTORY = 50;
export const MAX_SCANS_PER_DOMAIN = 10;

function saveQuietly(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage unavailable */ }
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
