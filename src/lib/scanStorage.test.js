import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { readScanHistory, readDomainHistory, readScheduledJobs, MAX_SCAN_HISTORY, MAX_SCANS_PER_DOMAIN, markScanStarted, clearActiveScan, readInterruptedScan } from './scanStorage';

const put = (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
const scan = (i, extra = {}) => ({ id: `s${i}`, domain: 'a.com', timestamp: `2026-10-${String(10 + (i % 18)).padStart(2, '0')}`, fullResults: { cookies: [] }, ...extra });

describe('scan storage readers (plan 7.1 sources, E2)', () => {
  beforeEach(() => ['cookieScanHistory', 'domainScanHistory', 'scheduledJobs'].forEach((k) => localStorage.removeItem(k)));

  it('reads scan history, caps the list, keeps every entry\'s details and saves the capped copy back', () => {
    put('cookieScanHistory', Array.from({ length: 60 }, (_, i) => scan(i)));
    const history = readScanHistory();
    expect(history).toHaveLength(MAX_SCAN_HISTORY);
    // Details are only shed by writeLocalStorage when the quota is hit, never on load.
    expect(history.every((e) => e.fullResults !== undefined)).toBe(true);
    const saved = JSON.parse(localStorage.getItem('cookieScanHistory'));
    expect(saved).toHaveLength(MAX_SCAN_HISTORY);
    expect(saved.every((e) => e.fullResults !== undefined)).toBe(true);
  });

  it('resets malformed scan history instead of crashing', () => {
    put('cookieScanHistory', '{oops');
    expect(readScanHistory()).toEqual([]);
    put('cookieScanHistory', { not: 'an array' });
    expect(readScanHistory()).toEqual([]);
    expect(localStorage.getItem('cookieScanHistory')).toBeNull();
  });

  it('reads domain history per domain with the same cap, keeping details, skipping bad entries', () => {
    put('domainScanHistory', { 'a.com': Array.from({ length: 12 }, (_, i) => scan(i)), 'b.com': 'nope' });
    const domains = readDomainHistory();
    expect(Object.keys(domains)).toEqual(['a.com']);
    expect(domains['a.com']).toHaveLength(MAX_SCANS_PER_DOMAIN);
    expect(domains['a.com'].every((e) => e.fullResults !== undefined)).toBe(true);
    put('domainScanHistory', [1, 2]);
    expect(readDomainHistory()).toEqual({});
  });

  it('reads scheduled jobs with timer fields cleared', () => {
    put('scheduledJobs', [{ id: 'j1', url: 'https://a.com', timerId: 7, countdownId: 8, timeLeft: 99 }]);
    expect(readScheduledJobs()).toEqual([{ id: 'j1', url: 'https://a.com', timerId: null, countdownId: null, timeLeft: null }]);
    put('scheduledJobs', 'garbage');
    expect(readScheduledJobs()).toEqual([]);
  });

  it('never throws on arbitrary stored strings', () => {
    fc.assert(fc.property(fc.string(), (raw) => {
      for (const [key, read] of [['cookieScanHistory', readScanHistory], ['domainScanHistory', readDomainHistory], ['scheduledJobs', readScheduledJobs]]) {
        localStorage.setItem(key, raw);
        expect(() => read()).not.toThrow();
      }
    }));
  });
});

describe('active scan record (E5, eng R5)', () => {
  beforeEach(() => localStorage.removeItem('activeScan'));

  it('writes the scan start and reads it back as interrupted on the next load', () => {
    markScanStarted({ url: 'https://a.com', type: 'deep', settings: { maxPages: 5 } }, '2026-10-12T05:00:00.000Z');
    expect(readInterruptedScan()).toEqual({ url: 'https://a.com', domain: 'a.com', type: 'deep', settings: { maxPages: 5 }, startedAt: '2026-10-12T05:00:00.000Z' });
  });

  it('clears the record when the scan ends', () => {
    markScanStarted({ url: 'https://a.com', type: 'quick' });
    clearActiveScan();
    expect(readInterruptedScan()).toBeNull();
  });

  it('ignores malformed records', () => {
    localStorage.setItem('activeScan', '{nope');
    expect(readInterruptedScan()).toBeNull();
    localStorage.setItem('activeScan', JSON.stringify({ type: 'quick' }));
    expect(readInterruptedScan()).toBeNull();
  });
});
