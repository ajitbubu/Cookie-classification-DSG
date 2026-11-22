import { describe, it, expect, vi } from 'vitest';
import {
  applyClassifications, buildHistoryEntry, calculateStatistics, classifyCookies, cleanResultsForStorage,
  enrichCookieWithClassification,
} from './scanPipeline';

const cookie = (name, extra = {}) => ({
  name, domain: '.shop.com', category: 'Analytics', type: 'Persistent', size: 10, isThirdParty: false,
  requiresConsent: true, secure: true, httpOnly: false, expires: -1, ...extra,
});
const classification = (category, extra = {}) => ({
  predicted_category: category, suggested_category: category, confidence_score: 0.9, confidence_level: 'High',
  classification_status: 'suggested', source: 'ml_prediction', ...extra,
});
const scan = (extra = {}) => ({
  domain: 'shop.com', scannedUrl: 'https://shop.com', scannedAt: '2026-11-22T10:00:00.000Z', scanType: 'quick',
  totalCount: 2, scanDuration: 1200, _scanId: 'scan-1', cmp: null,
  cookies: [cookie('_ga'), cookie('sid', { category: 'Strictly Necessary', requiresConsent: false, value: 'secret' })],
  statistics: { byCategory: { Analytics: 1, 'Strictly Necessary': 1 }, byType: {}, requiresConsent: 1, thirdParty: 0, totalSize: 20 },
  ...extra,
});

describe('calculateStatistics', () => {
  it('counts categories, types, consent, third parties and size', () => {
    expect(calculateStatistics([cookie('a'), cookie('b', { category: 'Marketing', isThirdParty: true, type: undefined, size: 5 })]))
      .toEqual({ byCategory: { Analytics: 1, Marketing: 1 }, byType: { Persistent: 1, session: 1 }, requiresConsent: 2, thirdParty: 1, totalSize: 15 });
  });
});

describe('enrichCookieWithClassification', () => {
  it('keeps a suggestion unpublished and records where it came from', () => {
    const out = enrichCookieWithClassification(cookie('_ga'), classification('Analytics'));
    expect(out).toMatchObject({ category: 'Unclassified', originalCategory: 'Analytics', mlClassification: 'Analytics',
      mlConfidence: 0.9, classificationStatus: 'suggested', classificationSource: 'ml_prediction', requiresConsent: true });
  });

  it('publishes a classified result with its consent rule', () => {
    const out = enrichCookieWithClassification(cookie('sid'), classification('Strictly Necessary', { classification_status: 'classified' }));
    expect(out).toMatchObject({ category: 'Strictly Necessary', requiresConsent: false, gdprCompliant: true, categorySource: 'ml_prediction' });
  });

  it("falls back to the rules without a result, and applies the site's declaration", () => {
    expect(enrichCookieWithClassification(cookie('_ga'), undefined).classificationSource).toBe('rules_fallback');
    const declared = enrichCookieWithClassification(
      cookie('IDE', { websiteDeclaration: { category: 'Marketing', group: 'Targeting Cookies', cmp: 'OneTrust' } }),
      classification('Marketing'),
    );
    expect(declared).toMatchObject({ classificationSource: 'website_declaration', websiteProvided: true });
  });
});

describe('classifyCookies', () => {
  it('posts the classify payload to baseUrl and returns the classifications', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ classifications: [classification('Analytics')] }) }));
    const out = await classifyCookies([cookie('_ga', { value: 'GA1.2.3' })], 'shop.com', { fetchImpl, baseUrl: 'http://api-gateway:1001' });
    expect(out).toEqual([classification('Analytics')]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api-gateway:1001/api/v1/ml/classify');
    const body = JSON.parse(init.body);
    expect(body.cookies[0]).toMatchObject({ name: '_ga', site_domain: 'shop.com', value_length: 7 });
    expect(JSON.stringify(body)).not.toContain('GA1.2.3'); // the value never leaves
  });

  it('uses the rule fallback when the model errors or is unreachable', async () => {
    const log = { error: vi.fn() };
    const down = await classifyCookies([cookie('_ga')], 'shop.com', { fetchImpl: async () => ({ ok: false, status: 503, statusText: 'x' }), log });
    const gone = await classifyCookies([cookie('_ga')], 'shop.com', { fetchImpl: async () => { throw new Error('ECONNREFUSED'); }, log });
    for (const out of [down, gone]) expect(out[0].source).toBe('rules_fallback');
    expect(log.error).toHaveBeenCalledTimes(2);
  });
});

describe('applyClassifications', () => {
  it('enriches cookies and each page copy, then recounts statistics', () => {
    const withPages = scan({ pageResults: [{ url: 'https://shop.com/', cookies: [cookie('_ga'), cookie('other')] }] });
    const out = applyClassifications(withPages, [classification('Marketing', { classification_status: 'classified' }), classification('Strictly Necessary')]);
    expect(out.cookies.map((c) => c.category)).toEqual(['Marketing', 'Unclassified']);
    expect(out.pageResults[0].cookies[0].category).toBe('Marketing');
    expect(out.pageResults[0].cookies[1]).toEqual(cookie('other')); // not in the scan's cookie list: untouched
    expect(out.statistics.byCategory).toEqual({ Marketing: 1, Unclassified: 1 });
  });

  it('adds no pageResults to a scan without pages', () => {
    expect(applyClassifications(scan(), [classification('Analytics'), classification('Analytics')])).not.toHaveProperty('pageResults');
  });
});

describe('stored record', () => {
  it("keeps each page's scan time", () => {
    const stored = cleanResultsForStorage(scan({ pageResults: [{ url: 'https://shop.com/', durationMs: 1840, cookies: [cookie('_ga')] }] }));
    expect(stored.pageResults[0]).toMatchObject({ url: 'https://shop.com/', durationMs: 1840 });
  });

  it('keeps only the stored fields, never the cookie value', () => {
    const stored = cleanResultsForStorage(scan());
    expect(JSON.stringify(stored)).not.toContain('secret');
    expect(Object.keys(stored.cookies[0])).toContain('websiteDeclaration');
    expect(stored.cookies[0]).not.toHaveProperty('expires');
    expect(stored.pageResults).toBeUndefined();
  });

  it('builds the scan-store entry with summary, risks and the stored results', () => {
    const entry = buildHistoryEntry(scan(), { now: new Date('2026-11-22T10:00:05.000Z') });
    expect(entry).toMatchObject({
      id: 'scan-1', timestamp: '2026-11-22T10:00:05.000Z', domain: 'shop.com', url: 'https://shop.com', totalCookies: 2,
      requiresConsent: 1, thirdParty: 0, categories: { Analytics: 1, 'Strictly Necessary': 1 }, scanType: 'quick',
      pagesScanned: 1, failedPages: 0, durationMs: 1200,
    });
    for (const risk of ['gdprRisk', 'ccpaRisk', 'dpdpRisk']) expect(entry).toHaveProperty(risk);
    expect(entry.fullResults.cookies).toHaveLength(2);
  });
});
