import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { latestPerDomain, dashboardKpis, categoryMix, recentCookies, recentActivity, riskScore, cookieRisk } from './dashboard';

const scan = (id, domain, timestamp, categories, extra = {}) => ({
  id, domain, timestamp, categories, totalCookies: Object.values(categories).reduce((a, b) => a + b, 0), ...extra,
});

const history = [
  scan('a2', 'a.com', '2026-10-11T10:00:00Z', { Analytics: 3, Unclassified: 2 }, { gdprRisk: 'HIGH',
    fullResults: { cookies: [{ name: '_ga', domain: '.a.com', category: 'Analytics' }, { name: 'x', domain: 'a.com', category: 'Unclassified' }] } }),
  scan('a1', 'a.com', '2026-10-09T10:00:00Z', { Unclassified: 9 }),
  scan('b1', 'b.com', '2026-10-10T10:00:00Z', { Marketing: 4, Unclassified: 1 }, { gdprRisk: 'LOW', ccpaRisk: 'LOW', dpdpRisk: 'LOW', failedPages: 2 }),
];

describe('latestPerDomain', () => {
  it('keeps each website\'s newest scan', () => {
    expect(latestPerDomain(history).map((s) => s.id).sort()).toEqual(['a2', 'b1']);
  });
});

describe('dashboardKpis', () => {
  it('counts websites, cookies and unclassified from each site\'s latest scan, and high-risk websites', () => {
    expect(dashboardKpis(history, Date.parse('2026-10-12T00:00:00Z'))).toMatchObject({ websites: 2, cookies: 10, unclassified: 3, highRiskWebsites: 1 });
  });

  it('counts websites scanned in the last 7 days as active', () => {
    expect(dashboardKpis(history, Date.parse('2026-10-12T00:00:00Z')).activeThisWeek).toBe(2);
    expect(dashboardKpis(history, Date.parse('2026-10-30T00:00:00Z')).activeThisWeek).toBe(0);
  });
});

describe('riskScore (Figma "Risk Score B (78)")', () => {
  it('is 100 minus the share of risk flags, High = 1, Moderate = 1/2, with a letter grade', () => {
    // a: HIGH + 2 unknown (counted as none); b: three LOW -> 1 flag of 6 => 83
    expect(riskScore(latestPerDomain(history))).toEqual({ score: 83, grade: 'B' });
    expect(riskScore([{ gdprRisk: 'MEDIUM', ccpaRisk: 'MEDIUM', dpdpRisk: 'LOW' }])).toEqual({ score: 67, grade: 'C' });
  });

  it('has no score without scans', () => {
    expect(riskScore([])).toBeNull();
  });

  it('stays between 0 and 100', () => {
    fc.assert(fc.property(fc.array(fc.record({
      gdprRisk: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'), ccpaRisk: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'), dpdpRisk: fc.constantFrom('HIGH', 'MEDIUM', 'LOW'),
    }), { minLength: 1 }), (scans) => {
      const { score } = riskScore(scans);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }));
  });
});

describe('cookieRisk', () => {
  it('marks cookies with no known purpose Critical and the rest Low (Figma 12.06.32)', () => {
    expect(cookieRisk('Unclassified')).toBe('Critical');
    expect(cookieRisk('Analytics')).toBe('Low');
  });
});

describe('categoryMix', () => {
  it('can be limited to scans from the last N days', () => {
    const mix = categoryMix(history, { days: 1, now: Date.parse('2026-10-12T00:00:00Z') });
    expect(mix).toEqual([{ label: 'Analytics', value: 3 }, { label: 'Unclassified', value: 2 }]);
  });

  it('sums categories over latest scans, largest first, folding Uncategorized into Unclassified', () => {
    const mix = categoryMix([...history, scan('c1', 'c.com', '2026-10-01', { Uncategorized: 1 })]);
    expect(mix).toEqual([
      { label: 'Marketing', value: 4 }, { label: 'Unclassified', value: 4 }, { label: 'Analytics', value: 3 },
    ]);
  });
});

describe('recent tables', () => {
  it('lists recently discovered cookies from stored scans, newest scan first', () => {
    expect(recentCookies(history, 5)).toEqual([
      { key: 'a.com|_ga|.a.com', name: '_ga', domain: '.a.com', category: 'Analytics', website: 'a.com', foundAt: '2026-10-11T10:00:00Z' },
      { key: 'a.com|x|a.com', name: 'x', domain: 'a.com', category: 'Unclassified', website: 'a.com', foundAt: '2026-10-11T10:00:00Z' },
    ]);
  });

  it('lists recent scans newest first, capped', () => {
    expect(recentActivity(history, 2).map((s) => s.id)).toEqual(['a2', 'b1']);
  });
});
