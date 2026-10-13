import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { scanStatus, scanResultsSummary, describeSchedule, scanResultKpis, formatScanDate, pagesLabel, newCookieCount } from './scanResults';

const entry = (domain, timestamp, totalCookies, extra = {}) => ({ id: `${domain}-${timestamp}`, domain, timestamp, totalCookies, ...extra });

describe('scanStatus', () => {
  it('is Completed when every page scanned', () => {
    expect(scanStatus(entry('a.com', 't', 3))).toEqual({ status: 'completed', failed: 0 });
    expect(scanStatus(entry('a.com', 't', 3, { failedPages: 0 }))).toEqual({ status: 'completed', failed: 0 });
  });

  it('is Partial with the exact failed count (9A)', () => {
    expect(scanStatus(entry('a.com', 't', 3, { failedPages: 38 }))).toEqual({ status: 'partial', failed: 38 });
  });
});

describe('scanResultsSummary', () => {
  it('counts scans, websites, cookies in each site\'s latest scan, and scans with failures', () => {
    const history = [
      entry('a.com', '2026-10-11T10:00:00Z', 12),
      entry('a.com', '2026-10-01T10:00:00Z', 40, { failedPages: 2 }),
      entry('b.com', '2026-10-05T10:00:00Z', 5),
    ];
    expect(scanResultsSummary(history)).toEqual({ scans: 3, websites: 2, cookies: 17, withFailures: 1 });
  });

  it('is all zero for no history', () => {
    expect(scanResultsSummary([])).toEqual({ scans: 0, websites: 0, cookies: 0, withFailures: 0 });
  });

  it('never counts more websites than scans', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ domain: fc.constantFrom('a', 'b', 'c'), timestamp: fc.integer({ min: 0, max: 9 }).map(String), totalCookies: fc.nat(50) })),
      (history) => {
        const s = scanResultsSummary(history);
        expect(s.websites).toBeLessThanOrEqual(s.scans);
        expect(s.cookies).toBeGreaterThanOrEqual(0);
      }
    ));
  });
});

describe('describeSchedule', () => {
  it('describes each repeat unit in plain words', () => {
    expect(describeSchedule({ unit: 'minutes', interval: 30 })).toBe('Every 30 minutes');
    expect(describeSchedule({ unit: 'hourly', interval: 1 })).toBe('Every hour');
    expect(describeSchedule({ unit: 'hourly', interval: 6 })).toBe('Every 6 hours');
    expect(describeSchedule({ unit: 'daily', scheduleTime: '09:00' })).toBe('Daily at 09:00');
    expect(describeSchedule({ unit: 'weekly', scheduleDay: 'friday', scheduleTime: '07:30' })).toBe('Weekly on Friday at 07:30');
    expect(describeSchedule({ unit: 'monthly', scheduleDate: 5, scheduleTime: '09:00' })).toBe('Monthly on day 5 at 09:00');
  });
});

describe('Figma Scan Result KPIs (12.10.31)', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const day = 86400000;
  const at = (daysAgo) => new Date(now - daysAgo * day).toISOString();
  const scan = (daysAgo, over = {}) => ({ domain: 'a.com', timestamp: at(daysAgo), pagesScanned: 10, failedPages: 0, ...over });

  it('totals scans and pages, averages recorded durations and counts scans without failed pages as successful', () => {
    const k = scanResultKpis([
      scan(1, { durationMs: 60000 }), scan(2, { durationMs: 180000, failedPages: 2 }), scan(3, { pagesScanned: 5 }),
    ], now);
    expect(k.totalScans.value).toBe(3);
    expect(k.pagesScanned.value).toBe(25);
    expect(k.avgDurationMs.value).toBe(120000);
    expect(k.successRate.value).toBeCloseTo(2 / 3);
  });

  it('has no average duration when no scan recorded one', () => {
    expect(scanResultKpis([scan(1)], now).avgDurationMs.value).toBeNull();
  });

  it('gives a week-on-week trend only when the previous week has scans', () => {
    const k = scanResultKpis([scan(1), scan(2), scan(9)], now);
    expect(k.totalScans.trend).toBeCloseTo(1); // 2 this week vs 1 last week: +100%
    expect(scanResultKpis([scan(1)], now).totalScans.trend).toBeNull();
  });

  it('is empty-safe', () => {
    const k = scanResultKpis([], now);
    expect(k.totalScans.value).toBe(0);
    expect(k.successRate.value).toBeNull();
  });
});

describe('Figma Scan Result row formats', () => {
  it('formats dates as dd-mm-yyyy HH:MM:SS in local time', () => {
    const d = new Date(2026, 10, 11, 5, 56, 17);
    expect(formatScanDate(d.toISOString())).toBe('11-11-2026 05:56:17');
  });

  it('shows pages as done/attempted', () => {
    expect(pagesLabel({ pagesScanned: 189, failedPages: 11 })).toBe('189/200');
    expect(pagesLabel({ pagesScanned: 1 })).toBe('1/1');
    expect(pagesLabel({})).toBe('—');
  });

  it('counts cookies new since the previous scan of the same website', () => {
    const older = { id: 'o', domain: 'a.com', timestamp: '2026-10-01', fullResults: { cookies: [{ name: 'x', domain: 'a.com' }] } };
    const newer = { id: 'n', domain: 'a.com', timestamp: '2026-10-05', fullResults: { cookies: [{ name: 'x', domain: 'a.com' }, { name: 'y', domain: 'a.com' }] } };
    expect(newCookieCount(newer, [newer, older])).toBe(1);
    expect(newCookieCount(older, [newer, older])).toBe(1); // first scan: every cookie is new
    expect(newCookieCount({ id: 'z', domain: 'b.com', timestamp: '1', totalCookies: 4 }, [])).toBe(4);
  });
});
