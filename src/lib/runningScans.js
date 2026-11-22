/**
 * Several scans can run at once, one per website. A scan's key is its host
 * without "www.", so https://www.att.com/deals and att.com are the same website
 * (a second scan of it is refused while the first runs) and xfinity.com is not.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 */
export function scanKey(url) {
  let host = String(url || '').trim();
  try {
    host = new URL(host.includes('://') ? host : `https://${host}`).hostname;
  } catch {
    // keep the raw text
  }
  return host.toLowerCase().replace(/^www\./, '');
}

/** Recently finished scans for the Active Scan cards: newest first, one per website. */
export function withCompleted(list, entry, max = 5) {
  return [entry, ...list.filter((s) => scanKey(s.url || s.domain) !== scanKey(entry.url || entry.domain))].slice(0, max);
}
