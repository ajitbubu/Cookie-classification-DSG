/**
 * Domain Details helpers: versions, category/vendor/page breakdowns and
 * reversible bulk category changes. Framework-free.
 */

// Categories the backend's update endpoints accept (category_routes.VALID_CATEGORIES).
export const BULK_CATEGORIES = ['Strictly Necessary', 'Functional', 'Analytics', 'Marketing', 'Unclassified'];

export const cookieKey = (cookie) => `${cookie.name}|${cookie.domain}`;

const cookiesOf = (scan) => scan?.fullResults?.cookies;

// A domain's stored scans as versions: v1 is the oldest; newest is listed first.
export function versionsForDomain(scans = []) {
  const oldestFirst = [...scans].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const versions = oldestFirst.map((scan, i) => {
    const prev = oldestFirst[i - 1];
    let diff = null;
    if (prev && cookiesOf(scan) && cookiesOf(prev)) {
      const now = new Set(cookiesOf(scan).map(cookieKey));
      const before = new Set(cookiesOf(prev).map(cookieKey));
      diff = {
        added: [...now].filter((k) => !before.has(k)).length,
        removed: [...before].filter((k) => !now.has(k)).length,
      };
    }
    return { ...scan, version: i + 1, diff };
  });
  return versions.reverse();
}

export function categoryBreakdown(cookies = []) {
  const rows = new Map();
  for (const cookie of cookies) {
    const category = cookie.category || 'Unclassified';
    const row = rows.get(category) || { category, count: 0, requireConsent: 0, thirdParty: 0 };
    row.count += 1;
    if (cookie.requiresConsent) row.requireConsent += 1;
    if (cookie.isThirdParty) row.thirdParty += 1;
    rows.set(category, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, percent: cookies.length ? Math.round((row.count / cookies.length) * 100) : 0 }));
}

export function vendorsFromCookies(cookies = []) {
  const byDomain = new Map();
  for (const cookie of cookies) {
    const domain = (cookie.domain || 'unknown').replace(/^\./, '');
    const entry = byDomain.get(domain) || { domain, cookies: 0, counts: new Map(), thirdParty: false };
    const category = cookie.category || 'Unclassified';
    entry.cookies += 1;
    entry.counts.set(category, (entry.counts.get(category) || 0) + 1);
    entry.thirdParty = entry.thirdParty || Boolean(cookie.isThirdParty);
    byDomain.set(domain, entry);
  }
  return [...byDomain.values()]
    .sort((a, b) => b.cookies - a.cookies || a.domain.localeCompare(b.domain))
    .map(({ counts, ...v }) => ({
      ...v,
      categories: [...counts.keys()].sort(),
      // Figma shows one category per vendor: the one most of its cookies have.
      category: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }));
}

export function pagesFromScan(scan = {}) {
  const pages = (scan.pageResults || []).map((page) => {
    const cookies = page.cookies || [];
    return {
      url: page.url,
      cookies: cookies.length,
      domains: new Set(cookies.map((c) => (c.domain || '').replace(/^\./, ''))).size,
      secure: cookies.filter((c) => c.secure).length,
      httpOnly: cookies.filter((c) => c.httpOnly).length,
      failed: false,
    };
  });
  for (const url of scan.errorPages || []) pages.push({ url, cookies: 0, domains: 0, secure: 0, httpOnly: 0, failed: true });
  return pages;
}

// Apply { key: newCategory }; return the new list and { key: oldCategory } for Undo.
export function applyCategoryChanges(cookies, changes) {
  const previous = {};
  const next = cookies.map((cookie) => {
    const key = cookieKey(cookie);
    if (!(key in changes) || changes[key] === cookie.category) return cookie;
    previous[key] = cookie.category;
    return { ...cookie, category: changes[key] };
  });
  return { cookies: next, previous };
}

// E3 loader: which stored scan a /domains/:domain[?scan=] link opens.
// found: details stored; pruned: only the summary survives; unknown: none.
// A pinned scan that no longer exists falls back to the latest one.
export function resolveDomainScan({ scanHistory = [], domainHistory = {}, domain, scanId = null }) {
  const byId = new Map();
  for (const entry of [...(domainHistory[domain] || []), ...scanHistory.filter((s) => s.domain === domain)]) {
    const key = entry.id || entry.timestamp;
    const current = byId.get(key);
    if (!current || (!current.fullResults && entry.fullResults)) byId.set(key, entry);
  }
  const scans = [...byId.values()];
  if (scans.length === 0) return { status: 'unknown' };
  const pinned = scanId ? scans.find((s) => s.id === scanId) : null;
  const entry = pinned || scans.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  return { status: entry.fullResults ? 'found' : 'pruned', entry };
}
