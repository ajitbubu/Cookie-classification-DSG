// Regression: ISSUE-001 — scanned cookies reached the classifier without expiry_days or site_domain
// Found by /qa on 2026-11-11
// Report: .gstack/qa-reports/run-20261111T170950Z/qa-report-localhost-2026-11-11.md
import { describe, it, expect } from 'vitest';
import { toClassifyCookie } from './cookieClassifyPayload';

// Scan results carry `expires` (epoch seconds, -1 for session cookies) and the
// scanned host lives on the scan result, not on each cookie. The model was
// trained on expiry in whole days (session = 0, persistent >= 1) and on the
// site the cookie was seen on, so both must be derived before classifying.
const NOW_MS = Date.UTC(2026, 10, 11, 12, 0, 0);
const NOW_S = NOW_MS / 1000;
const scanned = (overrides = {}) => ({
  name: 'IDE', domain: '.doubleclick.net', path: '/', value: 'abc',
  httpOnly: true, secure: true, sameSite: 'None', type: 'Persistent',
  expires: NOW_S + 390 * 86400,
  ...overrides,
});

describe('toClassifyCookie', () => {
  it('sends the lifetime in days and the scanned site', () => {
    const body = toClassifyCookie(scanned(), 'www.example.com', NOW_MS);
    expect(body.expiry_days).toBe(390);
    expect(body.site_domain).toBe('www.example.com');
  });

  it('treats session cookies as 0 days and short-lived persistent cookies as at least 1', () => {
    expect(toClassifyCookie(scanned({ expires: -1, type: 'Session' }), 'example.com', NOW_MS).expiry_days).toBe(0);
    expect(toClassifyCookie(scanned({ expires: undefined }), 'example.com', NOW_MS).expiry_days).toBe(0);
    expect(toClassifyCookie(scanned({ expires: NOW_S + 600 }), 'example.com', NOW_MS).expiry_days).toBe(1);
    expect(toClassifyCookie(scanned({ expires: NOW_S - 600 }), 'example.com', NOW_MS).expiry_days).toBe(1);
  });

  it('keeps an explicit expiry_days and site_domain when the cookie already has them', () => {
    const body = toClassifyCookie(scanned({ expiry_days: 30, siteDomain: 'shop.example.com' }), 'example.com', NOW_MS);
    expect(body.expiry_days).toBe(30);
    expect(body.site_domain).toBe('shop.example.com');
  });

  it('never sends the raw cookie value', () => {
    expect(JSON.stringify(toClassifyCookie(scanned({ value: 'secret-token-123' }), 'example.com', NOW_MS)))
      .not.toContain('secret-token-123');
  });
});
