import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  BULK_CATEGORIES, cookieKey, versionsForDomain, compareVersions, categoryBreakdown, vendorsFromCookies, pagesFromScan, applyCategoryChanges, resolveDomainScan,
} from './domainDetails';

const c = (name, domain, category = 'Analytics', extra = {}) => ({ name, domain, category, ...extra });
const scan = (id, timestamp, cookies, extra = {}) => ({
  id, timestamp, totalCookies: cookies ? cookies.length : extra.totalCookies, fullResults: cookies ? { cookies } : undefined, ...extra,
});

describe('versionsForDomain', () => {
  it('numbers versions oldest-first and lists newest first', () => {
    const versions = versionsForDomain([scan('b', '2026-10-02', []), scan('a', '2026-10-01', []), scan('c', '2026-10-03', [])]);
    expect(versions.map((v) => [v.id, v.version])).toEqual([['c', 3], ['b', 2], ['a', 1]]);
  });

  it('counts cookies added and removed against the previous version when both are stored', () => {
    const versions = versionsForDomain([
      scan('new', '2026-10-02', [c('_ga', '.a.com'), c('sid', 'a.com'), c('fbp', '.a.com')]),
      scan('old', '2026-10-01', [c('_ga', '.a.com'), c('gone', 'a.com')]),
    ]);
    expect(versions[0].diff).toEqual({ added: 2, removed: 1 });
    expect(versions[1].diff).toBeNull();
  });

  it('gives no diff when either version lost its details to storage pruning', () => {
    const versions = versionsForDomain([scan('new', '2026-10-02', [c('_ga', 'a')]), scan('old', '2026-10-01', null, { totalCookies: 4 })]);
    expect(versions[0].diff).toBeNull();
  });
});

describe('compareVersions', () => {
  const names = (list) => list.map((k) => k.name).sort();

  it('lists cookies added, removed and recategorised between any two versions', () => {
    const v1 = scan('v1', '2026-10-01', [c('_ga', '.a.com', 'Analytics'), c('gone', 'a.com'), c('sid', 'a.com', 'Strictly Necessary')]);
    const v3 = scan('v3', '2026-10-03', [c('_ga', '.a.com', 'Marketing'), c('sid', 'a.com', 'Strictly Necessary'), c('_fbp', '.a.com', 'Marketing')]);
    const diff = compareVersions(v1, v3);
    expect(names(diff.added)).toEqual(['_fbp']);
    expect(names(diff.removed)).toEqual(['gone']);
    expect(diff.recategorised).toEqual([{ cookie: v3.fullResults.cookies[0], from: 'Analytics', to: 'Marketing' }]);
  });

  it('treats a missing category as Unclassified, so no change is reported for it', () => {
    const diff = compareVersions(scan('a', '1', [c('x', 'a', null)]), scan('b', '2', [c('x', 'a', 'Unclassified')]));
    expect(diff.recategorised).toEqual([]);
  });

  it('is null when either version lost its cookie details to storage pruning', () => {
    expect(compareVersions(scan('a', '1', null, { totalCookies: 3 }), scan('b', '2', []))).toBeNull();
    expect(compareVersions(scan('a', '1', []), undefined)).toBeNull();
  });

  it('is symmetric: swapping the versions swaps added and removed, and reverses each category change', () => {
    const cookie = fc.record({ name: fc.constantFrom('a', 'b', 'c', 'd', 'e'), domain: fc.constantFrom('x', 'y'), category: fc.constantFrom(...BULK_CATEGORIES) });
    const cookies = fc.uniqueArray(cookie, { selector: cookieKey });
    fc.assert(fc.property(cookies, cookies, (before, after) => {
      const forward = compareVersions(scan('1', '1', before), scan('2', '2', after));
      const back = compareVersions(scan('2', '2', after), scan('1', '1', before));
      expect(forward.added.map(cookieKey).sort()).toEqual(back.removed.map(cookieKey).sort());
      expect(forward.removed.map(cookieKey).sort()).toEqual(back.added.map(cookieKey).sort());
      const flip = (r) => `${cookieKey(r.cookie)}:${r.to}->${r.from}`;
      expect(forward.recategorised.map((r) => `${cookieKey(r.cookie)}:${r.from}->${r.to}`).sort()).toEqual(back.recategorised.map(flip).sort());
      const self = compareVersions(scan('1', '1', before), scan('1', '1', before));
      expect([self.added, self.removed, self.recategorised]).toEqual([[], [], []]);
    }));
  });
});

describe('categoryBreakdown', () => {
  it('counts and orders categories, with percentages that sum to ~100', () => {
    const rows = categoryBreakdown([c('a', 'x', 'Marketing'), c('b', 'x', 'Marketing'), c('c', 'x', 'Analytics'), c('d', 'x', null)]);
    expect(rows.map((r) => [r.category, r.count])).toEqual([['Marketing', 2], ['Analytics', 1], ['Unclassified', 1]]);
    expect(rows[0].percent).toBe(50);
  });

  it('counts cookies needing consent and third-party cookies per category (Figma 12.13.22)', () => {
    const rows = categoryBreakdown([
      c('a', 'x', 'Marketing', { requiresConsent: true, isThirdParty: true }),
      c('b', 'x', 'Marketing', { requiresConsent: true }),
      c('c', 'x', 'Analytics'),
    ]);
    expect(rows[0]).toMatchObject({ category: 'Marketing', count: 2, requireConsent: 2, thirdParty: 1 });
    expect(rows[1]).toMatchObject({ category: 'Analytics', requireConsent: 0, thirdParty: 0 });
  });
});

describe('vendorsFromCookies', () => {
  it('groups by cookie domain without the leading dot', () => {
    const vendors = vendorsFromCookies([
      c('_ga', '.google-analytics.com', 'Analytics', { isThirdParty: true }),
      c('_gid', 'google-analytics.com', 'Analytics', { isThirdParty: true }),
      c('sid', 'shop.com', 'Strictly Necessary'),
    ]);
    expect(vendors[0]).toEqual({ domain: 'google-analytics.com', cookies: 2, categories: ['Analytics'], category: 'Analytics', thirdParty: true });
    expect(vendors[1].domain).toBe('shop.com');
  });

  it('names the most common category as the vendor category', () => {
    const [v] = vendorsFromCookies([c('a', 'x.com', 'Marketing'), c('b', 'x.com', 'Marketing'), c('c', 'x.com', 'Analytics')]);
    expect(v.category).toBe('Marketing');
  });
});

describe('pagesFromScan', () => {
  it('lists scanned pages with cookie counts and failed pages with their status', () => {
    const pages = pagesFromScan({
      pageResults: [{ url: 'https://a.com/', cookies: [c('x', 'a')] }, { url: 'https://a.com/b', cookies: [] }],
      errorPages: ['https://a.com/broken'],
    });
    expect(pages.map(({ url, cookies, failed }) => ({ url, cookies, failed }))).toEqual([
      { url: 'https://a.com/', cookies: 1, failed: false },
      { url: 'https://a.com/b', cookies: 0, failed: false },
      { url: 'https://a.com/broken', cookies: 0, failed: true },
    ]);
  });

  it('counts cookie domains and Secure / HttpOnly cookies per page (Figma 12.13.30)', () => {
    const [page] = pagesFromScan({
      pageResults: [{ url: 'https://a.com/', cookies: [c('x', '.a.com', 'Analytics', { secure: true, httpOnly: true }), c('y', 'b.com', 'Analytics', { secure: true }), c('z', 'a.com')] }],
    });
    expect(page).toMatchObject({ domains: 2, secure: 2, httpOnly: 1 });
  });

  it("passes each page's scan time through; older scans have none", () => {
    const [timed, untimed] = pagesFromScan({ pageResults: [{ url: 'https://a.com/', durationMs: 2350, cookies: [] }, { url: 'https://a.com/b', cookies: [] }] });
    expect(timed.durationMs).toBe(2350);
    expect(untimed.durationMs).toBeNull();
  });

  it('is empty when the scan stored no pages', () => {
    expect(pagesFromScan({})).toEqual([]);
  });
});

describe('applyCategoryChanges', () => {
  it('applies changes and returns what to restore for Undo', () => {
    const cookies = [c('_ga', '.a.com', 'Unclassified'), c('sid', 'a.com', 'Functional')];
    const { cookies: next, previous } = applyCategoryChanges(cookies, { [cookieKey(cookies[0])]: 'Analytics' });
    expect(next[0].category).toBe('Analytics');
    expect(next[1]).toBe(cookies[1]);
    expect(previous).toEqual({ [cookieKey(cookies[0])]: 'Unclassified' });
  });

  it('round-trips: applying the Undo map restores the original categories', () => {
    const arb = fc.uniqueArray(fc.record({ name: fc.constantFrom('a', 'b', 'c', 'd'), domain: fc.constantFrom('x', 'y'), category: fc.constantFrom(...BULK_CATEGORIES) }),
      { selector: (k) => `${k.name}|${k.domain}` });
    fc.assert(fc.property(arb, fc.constantFrom(...BULK_CATEGORIES), (cookies, target) => {
      const changes = Object.fromEntries(cookies.map((k) => [cookieKey(k), target]));
      const applied = applyCategoryChanges(cookies, changes);
      const undone = applyCategoryChanges(applied.cookies, applied.previous);
      expect(undone.cookies.map((k) => k.category)).toEqual(cookies.map((k) => k.category));
    }));
  });

  it('only offers categories the backend accepts', () => {
    expect(BULK_CATEGORIES).toEqual(['Strictly Necessary', 'Functional', 'Analytics', 'Marketing', 'Unclassified']);
  });
});

describe('resolveDomainScan (E3 loader)', () => {
  const full = (id, t) => ({ id, domain: 'a.com', timestamp: t, fullResults: { cookies: [] } });
  const bare = (id, t) => ({ id, domain: 'a.com', timestamp: t });

  it('finds the latest stored scan for the domain', () => {
    const r = resolveDomainScan({ scanHistory: [], domainHistory: { 'a.com': [full('s2', '2026-10-02'), bare('s1', '2026-10-01')] }, domain: 'a.com' });
    expect(r).toMatchObject({ status: 'found', entry: { id: 's2' } });
  });

  it('pins a version with scanId, and reports pruned when its details are gone', () => {
    const domainHistory = { 'a.com': [full('s2', '2026-10-02'), bare('s1', '2026-10-01')] };
    expect(resolveDomainScan({ scanHistory: [], domainHistory, domain: 'a.com', scanId: 's1' })).toMatchObject({ status: 'pruned', entry: { id: 's1' } });
  });

  it('prefers whichever copy of a scan still has its details', () => {
    const r = resolveDomainScan({ scanHistory: [full('s1', '2026-10-01')], domainHistory: { 'a.com': [bare('s1', '2026-10-01')] }, domain: 'a.com', scanId: 's1' });
    expect(r.status).toBe('found');
  });

  it('falls back to the latest scan when the pinned version no longer exists', () => {
    const r = resolveDomainScan({ scanHistory: [], domainHistory: { 'a.com': [full('s2', '2026-10-02')] }, domain: 'a.com', scanId: 'gone' });
    expect(r).toMatchObject({ status: 'found', entry: { id: 's2' } });
  });

  it('reports unknown domains', () => {
    expect(resolveDomainScan({ scanHistory: [], domainHistory: {}, domain: 'nope.com' })).toEqual({ status: 'unknown' });
  });
});
