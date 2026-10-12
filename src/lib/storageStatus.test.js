import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { writeLocalStorage } from './scanStorage';

/**
 * Regression test for the silent scan-history loss (Issue 3 / decision 3A).
 *
 * `writeLocalStorage` degrades through three tiers when the browser quota is
 * exhausted: full write -> strip `fullResults` from older entries -> strip them
 * from everything -> give up. It used to return a bare boolean that no caller
 * checked, so a user could close the tab believing a scan was saved when it was
 * not. App.jsx now wraps it and raises a toast on anything but 'ok'.
 */

const entries = [
  { id: 1, domain: 'a.com', fullResults: { cookies: ['big'] } },
  { id: 2, domain: 'b.com', fullResults: { cookies: ['big'] } },
];

/**
 * jsdom in this project exposes a `localStorage` object with no `setItem`, so a
 * `Storage.prototype` spy never intercepts anything. Install a controllable
 * stub instead — it also lets us simulate quota exhaustion precisely.
 */
function installFakeStorage() {
  const store = new Map();
  const fake = {
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    removeItem: vi.fn((k) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
  };
  vi.stubGlobal('localStorage', fake);
  return fake;
}

function quotaError() {
  return new DOMException('QuotaExceededError', 'QuotaExceededError');
}

describe('scan history storage degradation', () => {
  let setItem;

  beforeEach(() => {
    setItem = installFakeStorage().setItem;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports 'ok' when the write succeeds", () => {
    expect(writeLocalStorage('cookieScanHistory', entries)).toBe('ok');
  });

  it("reports 'pruned' when the first write hits quota but a trimmed one fits", () => {
    setItem.mockImplementationOnce(() => {
      throw quotaError();
    });

    expect(writeLocalStorage('cookieScanHistory', entries)).toBe('pruned');
  });

  it("reports 'failed' when even the minimal write cannot fit", () => {
    setItem.mockImplementation(() => {
      throw quotaError();
    });

    // The original code returned false here and only logged to console —
    // the user was told nothing.
    expect(writeLocalStorage('cookieScanHistory', entries)).toBe('failed');
  });

  it('never reports a bare boolean, which callers silently ignored', () => {
    const status = writeLocalStorage('cookieScanHistory', entries);
    expect(typeof status).toBe('string');
    expect(['ok', 'pruned', 'failed']).toContain(status);
  });

  it('keeps the newest entry intact when pruning', () => {
    setItem.mockImplementationOnce(() => {
      throw quotaError();
    });
    let written;
    setItem.mockImplementationOnce((_k, v) => {
      written = JSON.parse(v);
    });

    writeLocalStorage('cookieScanHistory', entries);

    expect(written[0].fullResults).toBeDefined();
    expect(written[1].fullResults).toBeUndefined();
  });
});
