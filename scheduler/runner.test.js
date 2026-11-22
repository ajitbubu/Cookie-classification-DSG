// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureScanApi } from '../src/lib/scanApi';
import { nextRunIn, runDueJobs } from './runner';

const BASE = 'http://api-gateway:1001';
const NOW = new Date('2026-11-22T06:30:00.000Z');
const quietLog = { info: vi.fn(), error: vi.fn() };

const job = (extra = {}) => ({ id: 'j1', url: 'https://shop.com', scanType: 'quick', unit: 'minutes', interval: 30,
  nextRun: '2026-11-22T06:00:00.000Z', timeZone: 'America/New_York', ...extra });
const scanResult = {
  scanType: 'quick', domain: 'shop.com', scannedUrl: 'https://shop.com', scannedAt: NOW.toISOString(), totalCount: 2,
  cookies: [
    { name: '_ga', domain: '.shop.com', category: 'Analytics', size: 30, value_length: 30, isThirdParty: false, expires: -1 },
    { name: 'IDE', domain: '.doubleclick.net', category: 'Marketing', size: 20, value_length: 20, isThirdParty: true, expires: -1,
      websiteDeclaration: { category: 'Marketing', group: 'Targeting Cookies', cmp: 'OneTrust' } },
  ],
  statistics: { byCategory: {}, byType: {}, requiresConsent: 2, thirdParty: 1, totalSize: 50 },
  pageResults: [{ url: 'https://shop.com/', cookies: [] }], cmp: { vendor: 'OneTrust', declared: 1, matched: 1 },
};
const classify = (cookies) => cookies.map((c) => ({ predicted_category: c.category, suggested_category: c.category,
  confidence_score: 0.9, confidence_level: 'High', classification_status: 'suggested', source: 'ml_prediction' }));

const json = (body, status = 200) => ({ ok: status < 300, status, statusText: status < 300 ? 'OK' : 'Service Unavailable', json: async () => body });
const sse = (events) => ({
  ok: true, status: 200,
  body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''))); c.close(); } }),
});

/** A fake API: hands out `due` jobs one by one, records saves and finishes. */
function fakeApi({ due = [job()], scan = () => json(scanResult), stream = null } = {}) {
  const queue = [...due];
  const calls = { saved: [], finished: [], scans: [] };
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url === `${BASE}/api/store/schedules/claim`) return json({ schedule: queue.shift() || null });
    if (url.startsWith(`${BASE}/api/store/scans/`)) { calls.saved.push(body); return json({ id: body.id }); }
    if (url.match(/\/api\/store\/schedules\/[^/]+\/finish$/)) { calls.finished.push({ url, body }); return json({ released: true }); }
    if (url === `${BASE}/api/scan`) { calls.scans.push(body); return scan(body); }
    if (url === `${BASE}/api/scan-stream`) { calls.scans.push(body); return stream(body); }
    if (url === `${BASE}/api/v1/ml/classify`) return json({ classifications: classify(body.cookies) });
    throw new Error(`unexpected ${url}`);
  });
  return { fetchImpl, calls };
}

const run = (api) => runDueJobs({ workerId: 'w1', baseUrl: BASE, fetchImpl: api.fetchImpl, log: quietLog, now: () => NOW });

describe('nextRunIn', () => {
  it("reads schedule times in the job's own time zone", () => {
    const daily = { unit: 'daily', scheduleTime: '02:00' };
    expect(nextRunIn({ ...daily, timeZone: 'America/New_York' }, NOW).toISOString()).toBe('2026-11-22T07:00:00.000Z'); // 01:30 in New York now
    expect(nextRunIn({ ...daily, timeZone: 'Asia/Kolkata' }, NOW).toISOString()).toBe('2026-11-22T20:30:00.000Z');
    expect(nextRunIn(daily, NOW, 'UTC').toISOString()).toBe('2026-11-23T02:00:00.000Z'); // older jobs: the default
  });

  it('leaves the process time zone as it was', () => {
    const before = process.env.TZ;
    nextRunIn({ unit: 'daily', scheduleTime: '02:00', timeZone: 'Asia/Tokyo' }, NOW);
    expect(process.env.TZ).toBe(before);
  });
});

describe('runDueJobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scans, classifies and saves a record like the app, then moves the job on', async () => {
    const api = fakeApi();
    configureScanApi({ baseUrl: BASE, fetchImpl: api.fetchImpl });
    expect(await run(api)).toBe(1);

    expect(api.calls.scans[0]).toMatchObject({ url: 'https://shop.com', scanType: 'quick' });
    const saved = api.calls.saved[0];
    expect(saved).toMatchObject({ domain: 'shop.com', scanType: 'quick', totalCookies: 2, scheduledJobId: 'j1', timestamp: NOW.toISOString() });
    for (const risk of ['gdprRisk', 'ccpaRisk', 'dpdpRisk']) expect(saved).toHaveProperty(risk);
    const ide = saved.fullResults.cookies.find((c) => c.name === 'IDE');
    expect(ide).toMatchObject({ classificationSource: 'website_declaration', category: 'Unclassified' }); // same rules as the app
    expect(saved.fullResults.cmp.vendor).toBe('OneTrust');

    const { url, body } = api.calls.finished[0];
    expect(url).toBe(`${BASE}/api/store/schedules/j1/finish`);
    expect(body).toMatchObject({ workerId: 'w1', claimedNextRun: '2026-11-22T06:00:00.000Z', nextRun: '2026-11-22T07:00:00.000Z',
      lastRun: { status: 'ok', at: NOW.toISOString(), scanId: saved.id, totalCookies: 2 } }); // durationMs: null for a 0 ms fake scan
  });

  it('records a failed run, still moves the job on, and keeps going', async () => {
    const api = fakeApi({ due: [job(), job({ id: 'j2' })], scan: () => json({ detail: "Scanning is unavailable: the scan egress proxy can't be reached." }, 503) });
    configureScanApi({ baseUrl: BASE, fetchImpl: api.fetchImpl });
    expect(await run(api)).toBe(2);
    expect(api.calls.saved).toHaveLength(0);
    expect(api.calls.finished.map((f) => f.body.lastRun)).toEqual([
      { status: 'failed', at: NOW.toISOString(), error: "Scanning is unavailable: the scan egress proxy can't be reached." },
      { status: 'failed', at: NOW.toISOString(), error: "Scanning is unavailable: the scan egress proxy can't be reached." },
    ]);
    expect(api.calls.finished[0].body.nextRun).toBe('2026-11-22T07:00:00.000Z');
  });

  it("runs a deep job through the scan stream with the job's crawl settings", async () => {
    const api = fakeApi({
      due: [job({ scanType: 'deep', maxPages: 5, maxDepth: 2, concurrency: 3 })],
      stream: () => sse([{ type: 'progress', current: 1, total: 5 }, { type: 'complete', result: { ...scanResult, scanType: 'deep', totalPagesScanned: 5 } }]),
    });
    configureScanApi({ baseUrl: BASE, fetchImpl: api.fetchImpl });
    vi.spyOn(globalThis, 'fetch').mockImplementation(api.fetchImpl); // DeepScanner uses the global fetch
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(api);
    expect(api.calls.scans[0]).toMatchObject({ url: 'https://shop.com', scanType: 'deep', maxPages: 5, maxDepth: 2, concurrency: 3 });
    expect(api.calls.saved[0]).toMatchObject({ scanType: 'deep', domain: 'shop.com', pagesScanned: 5, scheduledJobId: 'j1' });
    vi.restoreAllMocks();
  });

  it('does nothing when no job is due', async () => {
    const api = fakeApi({ due: [] });
    configureScanApi({ baseUrl: BASE, fetchImpl: api.fetchImpl });
    expect(await run(api)).toBe(0);
    expect(api.calls.scans).toHaveLength(0);
  });
});
