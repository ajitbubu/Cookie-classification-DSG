import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pendingReviews, loadApprovals, readApprovals, recordApproval, needsManualCheck, manualCheckPrompt, siteLabelSplit, siteSplitText, knownCookieText } from './reviewQueue';

const history = [
  { id: 'a2', domain: 'a.com', timestamp: '2026-10-11', fullResults: { cookies: [
    { name: '_ga', domain: '.a.com', category: 'Unclassified', mlClassification: 'Analytics', mlConfidence: 0.91 },
    { name: 'sid', domain: 'a.com', category: 'Strictly Necessary' },
    { name: 'odd', domain: 'a.com', category: 'Unclassified', mlConfidence: 0.2 },
  ] } },
  { id: 'a1', domain: 'a.com', timestamp: '2026-10-01', fullResults: { cookies: [{ name: 'old', domain: 'a.com', category: 'Unclassified' }] } },
];

describe('pendingReviews', () => {
  it('lists unpublished cookies from each site\'s latest scan with the model\'s suggestion', () => {
    const items = pendingReviews(history, []);
    expect(items.map((i) => i.name)).toEqual(['_ga', 'odd']);
    expect(items[0]).toMatchObject({ key: 'a.com:_ga', website: 'a.com', suggestion: 'Analytics', confidence: 0.91, rule: 'Analytics', manualCheck: false });
    expect(items[1].suggestion).toBeNull();
  });

  it('drops cookies a reviewer already approved', () => {
    // Keys match the Review Queue's approval log: <website>:<cookie name>
    expect(pendingReviews(history, [{ cookieKey: 'a.com:_ga' }]).map((i) => i.name)).toEqual(['odd']);
  });
});

describe('readApprovals', () => {
  beforeEach(() => loadApprovals([]));

  it('reads the review log loaded from the store and tolerates bad data', () => {
    expect(readApprovals()).toEqual([]);
    loadApprovals('{not a list');
    expect(readApprovals()).toEqual([]);
    loadApprovals([{ cookieKey: 'k' }]);
    expect(readApprovals()).toEqual([{ cookieKey: 'k' }]);
  });
});

describe('manual check (12A)', () => {
  it('flags suggestions made without identity evidence', () => {
    expect(needsManualCheck({ abstainReason: 'insufficient_evidence' })).toBe(true);
    expect(needsManualCheck({ abstainReason: 'low_confidence' })).toBe(false);
    expect(needsManualCheck({})).toBe(false);
  });

  it('marks pending items and words the confirmation', () => {
    const items = pendingReviews([{ id: 's', domain: 'a.com', timestamp: 't', fullResults: { cookies: [
      { name: 'x9', domain: 'a.com', category: 'Unclassified', mlClassification: 'Marketing', abstainReason: 'insufficient_evidence' },
    ] } }]);
    expect(items[0].manualCheck).toBe(true);
    expect(manualCheckPrompt('Marketing')).toBe('The model had no name or vendor signal for this cookie. Approve Marketing?');
  });
});

describe('recordApproval', () => {
  beforeEach(() => loadApprovals([]));
  afterEach(() => vi.restoreAllMocks());

  it('saves to the store, then appends to the review log that pendingReviews reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await recordApproval({ key: 'a.com:_ga', name: '_ga', domain: '.a.com', originalCategory: 'Analytics', approvedCategory: 'Analytics', confidence: 0.9 });
    const log = readApprovals();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ cookieKey: 'a.com:_ga', approvedCategory: 'Analytics', action: 'approved' });
    expect(pendingReviews(history, log).map((i) => i.name)).toEqual(['odd']);
    expect(fetchMock).toHaveBeenCalledWith('/api/store/approvals', expect.objectContaining({ method: 'POST' }));
  });

  it('leaves the log unchanged when the store rejects the save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(recordApproval({ key: 'a.com:_ga', name: '_ga', approvedCategory: 'Analytics' })).rejects.toThrow('503');
    expect(readApprovals()).toEqual([]);
  });
});

describe('site label split', () => {
  it('reports cookies websites label differently, larger side first', () => {
    const split = siteLabelSplit({ siteLabelSplit: { Functional: 7, 'Strictly Necessary': 8 } });
    expect(split).toEqual([['Strictly Necessary', 8], ['Functional', 7]]);
    expect(siteSplitText(split)).toBe('Websites label this cookie differently: Strictly Necessary on 8 sites, Functional on 7 sites.');
    expect(siteSplitText([['Analytics', 3], ['Marketing', 1]])).toContain('Marketing on 1 site.');
  });

  it('is null when sites agree or the model sent nothing', () => {
    expect(siteLabelSplit({ siteLabelSplit: { Analytics: 5 } })).toBeNull();
    expect(siteLabelSplit({ siteLabelSplit: null })).toBeNull();
    expect(siteLabelSplit({})).toBeNull();
  });
});

describe('known cookie source', () => {
  it('names the websites or list the suggestion came from', () => {
    expect(knownCookieText({ knownCookie: { source: 'website_declarations', sites: 41, total_sites: 44 } }))
      .toBe("Declared this way by 41 of 44 websites' consent banners.");
    expect(knownCookieText({ knownCookie: { source: 'open_cookie_database', platform: 'Stripe' } }))
      .toBe('Listed in the Open Cookie Database (Stripe).');
    expect(knownCookieText({ knownCookie: { source: 'open_cookie_database', platform: null } }))
      .toBe('Listed in the Open Cookie Database.');
  });

  it('is null for model predictions', () => {
    expect(knownCookieText({ knownCookie: null })).toBeNull();
    expect(knownCookieText({})).toBeNull();
  });
});
