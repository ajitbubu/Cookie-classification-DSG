/**
 * Cookie inventory: every distinct cookie (name + domain) seen across stored
 * scans, with its most recent category and the sites it was found on.
 * Framework-free; only scans that still carry fullResults contribute.
 */
export function buildInventory(scanHistory = []) {
  const byKey = new Map();
  for (const scan of scanHistory) {
    const cookies = scan?.fullResults?.cookies;
    if (!Array.isArray(cookies)) continue;
    for (const cookie of cookies) {
      const key = `${cookie.name}|${cookie.domain}`;
      const entry = byKey.get(key) || {
        name: cookie.name, domain: cookie.domain, category: cookie.category, lastSeen: scan.timestamp,
        sourceFailedPages: scan.failedPages || 0, sites: new Set(),
      };
      entry.sites.add(scan.domain);
      if (scan.timestamp >= entry.lastSeen) {
        entry.lastSeen = scan.timestamp;
        entry.category = cookie.category;
        entry.sourceFailedPages = scan.failedPages || 0;
      }
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((entry) => ({ ...entry, sites: [...entry.sites].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
