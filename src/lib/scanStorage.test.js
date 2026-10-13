import { describe, it, expect, beforeEach } from 'vitest';
import { markScanStarted, clearActiveScan, readInterruptedScan } from './scanStorage';


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
