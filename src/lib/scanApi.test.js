import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listScans, getScan, saveScan, deleteScan, addNewScans, configureScanApi, claimSchedule, finishScheduleRun, saveSchedule, readLegacyBrowserData, loadStore, historyFromScans,
} from './scanApi';
import { MAX_SCAN_HISTORY, MAX_SCANS_PER_DOMAIN } from './scanStorage';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const scan = (id, extra = {}) => ({ id, domain: 'shop.com', timestamp: '2026-10-12T10:00:00.000Z', ...extra });

describe('scanApi', () => {
  let fetchMock;
  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists scans from the store', async () => {
    fetchMock.mockResolvedValue(ok({ scans: [scan('a')] }));
    expect(await listScans()).toEqual([scan('a')]);
    expect(fetchMock).toHaveBeenCalledWith('/api/store/scans?limit=500', { method: 'GET' });
  });

  it('gets one full scan by id', async () => {
    fetchMock.mockResolvedValue(ok(scan('a b', { fullResults: { pageResults: [] } })));
    expect((await getScan('a b')).fullResults.pageResults).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/store/scans/a%20b', { method: 'GET' });
  });

  it('saves a scan with PUT to its id', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'a' }));
    await saveScan(scan('a', { fullResults: { cookies: [] } }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/store/scans/a');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).fullResults).toEqual({ cookies: [] });
  });

  it('throws when the store answers with an error, so callers can tell the user', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(deleteScan('a')).rejects.toThrow('503');
  });

  it('does not store timer handles with a schedule', async () => {
    fetchMock.mockResolvedValue(ok({ id: '1' }));
    await saveSchedule({ id: '1', url: 'https://shop.com', unit: 'daily', timerId: 3, countdownId: 4, timeLeft: 9 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ id: '1', url: 'https://shop.com', unit: 'daily' });
  });
});

describe('one-time import of browser data', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns null when the browser saved nothing', () => {
    expect(readLegacyBrowserData()).toBeNull();
  });

  it('merges both histories by id, keeping the copy with detail, and drops records the store would reject', () => {
    localStorage.setItem('cookieScanHistory', JSON.stringify([scan('a'), scan('bad id/with slash')]));
    localStorage.setItem('domainScanHistory', JSON.stringify({ 'shop.com': [scan('a', { fullResults: { cookies: [] } }), scan('b')] }));
    localStorage.setItem('scheduledJobs', JSON.stringify([{ id: 17, url: 'https://shop.com', unit: 'daily', timerId: 5 }, { id: 18 }]));
    localStorage.setItem('reviewQueueApprovals', JSON.stringify([
      { cookieKey: 'shop.com:_ga', approvedCategory: 'Analytics' },
      { cookieKey: 'shop.com:_ga', approvedCategory: 'Marketing' },
    ]));
    const data = readLegacyBrowserData();
    expect(data.scans.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(data.scans.find((s) => s.id === 'a').fullResults).toEqual({ cookies: [] });
    expect(data.schedules).toEqual([{ id: '17', url: 'https://shop.com', unit: 'daily' }]);
    expect(data.approvals).toEqual([{ cookieKey: 'shop.com:_ga', approvedCategory: 'Marketing' }]);
  });

  it('uploads once, then clears the browser copy', async () => {
    localStorage.setItem('cookieScanHistory', JSON.stringify([scan('a')]));
    localStorage.setItem('activeScan', '{"url":"https://shop.com"}');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.endsWith('/import')) return ok({ scans: 1 });
      if (url.includes('/scans')) return ok({ scans: [scan('a')] });
      return ok({});
    });
    const loaded = await loadStore();
    expect(loaded.imported).toEqual({ scans: 1 });
    expect(loaded.scans).toEqual([scan('a')]);
    expect(localStorage.getItem('cookieScanHistory')).toBeNull();
    expect(localStorage.getItem('activeScan')).not.toBeNull(); // interrupted-scan record stays local
    expect(fetchMock.mock.calls.filter(([u]) => u.endsWith('/import'))).toHaveLength(1);
  });

  it('keeps the browser copy and still loads when the import fails', async () => {
    localStorage.setItem('cookieScanHistory', JSON.stringify([scan('a')]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => (url.endsWith('/import')
      ? { ok: false, status: 422, json: async () => ({}) }
      : ok({ scans: [] })));
    const loaded = await loadStore();
    expect(loaded.imported).toEqual({ failed: true });
    expect(localStorage.getItem('cookieScanHistory')).not.toBeNull();
  });

  it('fails the load when the store is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(loadStore()).rejects.toThrow('503');
  });
});

describe('historyFromScans', () => {
  it('keeps the newest scans overall and per domain, without dropping detail', () => {
    const scans = Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, domain: i % 2 ? 'a.com' : 'b.com', fullResults: { n: i } }));
    const { scanHistory, domainHistory } = historyFromScans(scans);
    expect(scanHistory).toHaveLength(MAX_SCAN_HISTORY);
    expect(scanHistory[0].id).toBe('s0');
    expect(domainHistory['a.com']).toHaveLength(MAX_SCANS_PER_DOMAIN);
    expect(domainHistory['a.com'][0]).toEqual({ id: 's1', domain: 'a.com', fullResults: { n: 1 } });
  });

  it('talks to an absolute base URL when configured (the server-side scheduler)', async () => {
    const fetchImpl = vi.fn(async () => ok({ schedule: { id: 'j1' } }));
    const globalFetch = vi.spyOn(globalThis, 'fetch');
    configureScanApi({ baseUrl: 'http://api-gateway:1001', fetchImpl });
    try {
      expect(await claimSchedule('w1')).toEqual({ id: 'j1' });
      await finishScheduleRun('j 1', { workerId: 'w1', claimedNextRun: 'a', nextRun: 'b', lastRun: { status: 'ok' } });
      expect(fetchImpl.mock.calls.map(([u]) => u)).toEqual([
        'http://api-gateway:1001/api/store/schedules/claim', 'http://api-gateway:1001/api/store/schedules/j%201/finish']);
      expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ workerId: 'w1', claimedNextRun: 'a', nextRun: 'b', lastRun: { status: 'ok' } });
      expect(globalFetch).not.toHaveBeenCalled();
    } finally {
      configureScanApi(); // back to same-origin fetch for the other tests
      globalFetch.mockRestore();
    }
  });
});

describe('addNewScans', () => {
  const s = (id, timestamp, domain = 'shop.com', extra = {}) => ({ id, domain, timestamp, ...extra });

  it("adds only scans the app doesn't have, newest first, per domain too", () => {
    const local = s('a', '2026-11-22T05:00:00Z', 'shop.com', { totalCookies: 9 }); // newer local copy wins
    const history = { scanHistory: [local], domainHistory: { 'shop.com': [local] } };
    const out = addNewScans(history, [s('a', '2026-11-22T05:00:00Z'), s('b', '2026-11-22T06:00:00Z'), s('c', '2026-11-22T04:00:00Z', 'x.com')]);
    expect(out.added.map((x) => x.id)).toEqual(['b', 'c']);
    expect(out.scanHistory.map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(out.scanHistory[1].totalCookies).toBe(9);
    expect(out.domainHistory['shop.com'].map((x) => x.id)).toEqual(['b', 'a']);
    expect(out.domainHistory['x.com'].map((x) => x.id)).toEqual(['c']);
  });

  it('returns the same objects when nothing is new', () => {
    const history = { scanHistory: [s('a', '1')], domainHistory: { 'shop.com': [s('a', '1')] } };
    const out = addNewScans(history, [s('a', '1')]);
    expect(out.scanHistory).toBe(history.scanHistory);
    expect(out.added).toEqual([]);
  });
});

