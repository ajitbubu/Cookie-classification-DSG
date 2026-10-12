import { describe, it, expect, beforeEach } from 'vitest';
import { pendingReviews, readApprovals, recordApproval, needsManualCheck, manualCheckPrompt } from './reviewQueue';

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
  beforeEach(() => localStorage.removeItem('reviewQueueApprovals'));

  it('reads the review log and tolerates bad data', () => {
    expect(readApprovals()).toEqual([]);
    localStorage.setItem('reviewQueueApprovals', '{not json');
    expect(readApprovals()).toEqual([]);
    localStorage.setItem('reviewQueueApprovals', JSON.stringify([{ cookieKey: 'k' }]));
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
  beforeEach(() => localStorage.removeItem('reviewQueueApprovals'));

  it('appends to the review log that pendingReviews reads', () => {
    recordApproval({ key: 'a.com:_ga', name: '_ga', domain: '.a.com', originalCategory: 'Analytics', approvedCategory: 'Analytics', confidence: 0.9 });
    const log = readApprovals();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ cookieKey: 'a.com:_ga', approvedCategory: 'Analytics', action: 'approved' });
    expect(pendingReviews(history, log).map((i) => i.name)).toEqual(['odd']);
  });
});
