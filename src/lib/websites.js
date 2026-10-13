/**
 * Website portfolio from stored scans (plan 7.1: scan + domain history).
 * Each website is described by its newest scan. Framework-free.
 */
import { scanStatus } from './scanResults';

export const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);

const highestRisk = (scan) => {
  const levels = [scan.gdprRisk, scan.ccpaRisk, scan.dpdpRisk].filter((l) => l in RISK_ORDER);
  if (levels.length === 0) return null;
  return levels.sort((a, b) => RISK_ORDER[a] - RISK_ORDER[b])[0];
};

export function websitesFromHistory(scanHistory = [], domainHistory = {}) {
  const byDomain = new Map();
  const add = (scan) => {
    if (!scan?.domain) return;
    const site = byDomain.get(scan.domain) || new Map();
    const key = scan.id || `${scan.timestamp}`;
    // The scan list carries more detail than the per-domain copy; keep it when both exist.
    if (!site.has(key) || (scanHistory || []).includes(scan)) site.set(key, scan);
    byDomain.set(scan.domain, site);
  };
  Object.values(domainHistory || {}).forEach((scans) => (Array.isArray(scans) ? scans : []).forEach(add));
  (scanHistory || []).forEach(add);

  return [...byDomain.entries()].map(([domain, scans]) => {
    const all = [...scans.values()];
    const latest = all.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    return {
      domain,
      url: latest.url || `https://${domain}`,
      latest,
      scans: all.length,
      cookies: latest.totalCookies || 0,
      unclassified: Object.entries(latest.categories || {}).reduce((n, [cat, c]) => n + (UNPUBLISHED.has(cat) ? c : 0), 0),
      risk: highestRisk(latest),
      status: scanStatus(latest),
    };
  });
}
