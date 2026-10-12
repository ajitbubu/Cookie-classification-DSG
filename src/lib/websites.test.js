import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { websitesFromHistory, RISK_ORDER } from './websites';

const scan = (id, domain, timestamp, extra = {}) => ({ id, domain, url: `https://${domain}`, timestamp, totalCookies: 4, categories: {}, ...extra });

describe('websitesFromHistory', () => {
  const scanHistory = [scan('a2', 'a.com', '2026-10-11', { totalCookies: 9, categories: { Unclassified: 3, Analytics: 6 }, gdprRisk: 'HIGH', failedPages: 2 })];
  const domainHistory = { 'a.com': [scan('a2', 'a.com', '2026-10-11'), scan('a1', 'a.com', '2026-10-01')], 'b.com': [scan('b1', 'b.com', '2026-10-05', { ccpaRisk: 'MEDIUM' })] };

  it('builds one row per website from its newest scan, counting scans once', () => {
    const sites = websitesFromHistory(scanHistory, domainHistory);
    const a = sites.find((s) => s.domain === 'a.com');
    expect(a).toMatchObject({ scans: 2, cookies: 9, unclassified: 3, risk: 'HIGH', status: { status: 'partial', failed: 2 } });
    expect(a.latest.id).toBe('a2');
    expect(sites.find((s) => s.domain === 'b.com')).toMatchObject({ scans: 1, risk: 'MEDIUM' });
  });

  it('is empty without history', () => {
    expect(websitesFromHistory([], {})).toEqual([]);
    expect(websitesFromHistory(undefined, undefined)).toEqual([]);
  });

  it('never invents websites or loses one', () => {
    fc.assert(fc.property(fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.integer({ min: 1, max: 9 }))), (pairs) => {
      const history = pairs.map(([d, t], i) => scan(`${d}${i}`, d, `2026-10-0${t}`));
      const sites = websitesFromHistory(history, {});
      expect(sites.map((s) => s.domain).sort()).toEqual([...new Set(pairs.map(([d]) => d))].sort());
      expect(sites.reduce((n, s) => n + s.scans, 0)).toBe(history.length);
    }));
  });

  it('orders risk levels highest first', () => {
    expect(RISK_ORDER.HIGH).toBeLessThan(RISK_ORDER.MEDIUM);
    expect(RISK_ORDER.MEDIUM).toBeLessThan(RISK_ORDER.LOW);
  });
});
