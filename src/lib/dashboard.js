/**
 * Dashboard aggregates from stored scan history (plan 7.1). Framework-free.
 */
const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);
const label = (category) => (UNPUBLISHED.has(category) || !category ? 'Unclassified' : category);

const unclassifiedIn = (scan) =>
  Object.entries(scan.categories || {}).reduce((sum, [cat, n]) => sum + (UNPUBLISHED.has(cat) ? n : 0), 0);

const byNewest = (a, b) => (a.timestamp < b.timestamp ? 1 : -1);

export function latestPerDomain(history = []) {
  const latest = new Map();
  for (const scan of history) {
    const current = latest.get(scan.domain);
    if (!current || scan.timestamp > current.timestamp) latest.set(scan.domain, scan);
  }
  return [...latest.values()];
}

const DAY_MS = 86400000;
const REGULATIONS = ['gdprRisk', 'ccpaRisk', 'dpdpRisk'];
const FLAG = { HIGH: 1, MEDIUM: 0.5 };

/**
 * Figma "Risk Score B (78)": 100 minus the share of regulation risk flags over
 * the given scans (High counts 1, Moderate 1/2, Low or unknown 0), graded
 * A 90+, B 75+, C 60+, D 40+, else F. Null when there is nothing to score.
 */
export function riskScore(scans = []) {
  if (scans.length === 0) return null;
  const flags = scans.reduce((sum, s) => sum + REGULATIONS.reduce((n, r) => n + (FLAG[s[r]] || 0), 0), 0);
  const score = Math.round(100 * (1 - flags / (scans.length * REGULATIONS.length)));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { score, grade };
}

/** Figma cookie risk: a cookie with no known purpose is Critical, the rest Low. */
export function cookieRisk(category) {
  return label(category) === 'Unclassified' ? 'Critical' : 'Low';
}

export function dashboardKpis(history = [], now = Date.now()) {
  const latest = latestPerDomain(history);
  return {
    websites: latest.length,
    activeThisWeek: latest.filter((s) => Date.parse(s.timestamp) > now - 7 * DAY_MS).length,
    cookies: latest.reduce((sum, s) => sum + (s.totalCookies || 0), 0),
    unclassified: latest.reduce((sum, s) => sum + unclassifiedIn(s), 0),
    highRiskWebsites: latest.filter((s) => REGULATIONS.some((r) => s[r] === 'HIGH')).length,
    risk: riskScore(latest),
  };
}

// `days` limits the mix to scans from the last N days (the "This Week" menu).
export function categoryMix(history = [], { days = null, now = Date.now() } = {}) {
  const totals = new Map();
  const inWindow = days ? history.filter((s) => Date.parse(s.timestamp) > now - days * DAY_MS) : history;
  for (const scan of latestPerDomain(inWindow)) {
    for (const [cat, n] of Object.entries(scan.categories || {})) {
      totals.set(label(cat), (totals.get(label(cat)) || 0) + n);
    }
  }
  return [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([l, value]) => ({ label: l, value }));
}

// Decision 13A: unclassified cookies per day for the last `days` days; each
// website counts once per day, using its last scan that day.
export function recentCookies(history = [], limit = 5) {
  const rows = [];
  for (const scan of [...history].sort(byNewest)) {
    for (const cookie of scan.fullResults?.cookies || []) {
      rows.push({
        key: `${scan.domain}|${cookie.name}|${cookie.domain}`,
        name: cookie.name,
        domain: cookie.domain,
        category: label(cookie.category),
        website: scan.domain,
        foundAt: scan.timestamp,
      });
      if (rows.length >= limit) return rows;
    }
  }
  return rows;
}

export function recentActivity(history = [], limit = 5) {
  return [...history].sort(byNewest).slice(0, limit);
}
