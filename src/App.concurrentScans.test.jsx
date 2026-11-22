// Starting a scan of another website no longer replaces the one already running.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ToastProvider } from './components/Toast';
import { LiveRegionProvider } from './components/ui/LiveRegion';

const result = (domain) => ({
  domain, scannedUrl: `https://${domain}`, scannedAt: '2026-11-22T10:00:00.000Z', totalCount: 1,
  cookies: [{ name: `c_${domain}`, domain, category: 'Analytics', isThirdParty: false, requiresConsent: true }],
  statistics: { byCategory: { Analytics: 1 }, byType: {}, requiresConsent: 1, thirdParty: 0, totalSize: 0 },
  pageResults: [], errorPages: [],
});

/** /api/scan answers only when the test releases that website's scan. */
function controllableApi() {
  const pending = new Map();
  const scanCalls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.startsWith('/api/store/scans?')) return { ok: true, status: 200, json: async () => ({ scans: [] }) };
    if (u.startsWith('/api/store')) return { ok: true, status: 200, json: async () => ({}) };
    if (u === '/api/scan') {
      const { url: target } = JSON.parse(init.body);
      const domain = new URL(target).hostname;
      scanCalls.push(domain);
      return new Promise((resolve) => pending.set(domain, () => resolve({ ok: true, status: 200, json: async () => result(domain) })));
    }
    if (u.includes('/api/v1/ml/classify')) {
      const { cookies } = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ classifications: cookies.map(() => ({ predicted_category: 'Analytics', suggested_category: 'Analytics', confidence_score: 0.9, confidence_level: 'High', classification_status: 'suggested', source: 'ml_prediction' })) }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  return { release: (domain) => pending.get(domain)(), scanCalls };
}

async function startScan(url) {
  await userEvent.click(screen.getByRole('link', { name: 'Launch New Scan' }));
  const field = await screen.findByLabelText('Website URL');
  await userEvent.clear(field);
  await userEvent.type(field, url);
  await userEvent.click(screen.getByRole('button', { name: 'Start Scan' }));
}

const runningCard = (host) => screen.queryByRole('article', { name: new RegExp(host) });

describe('scans of different websites run side by side', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/scanning');
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps both scans, refuses a second scan of the same website, and lets the other finish quietly', async () => {
    const api = controllableApi();
    render(<LiveRegionProvider><ToastProvider><App /></ToastProvider></LiveRegionProvider>);

    await startScan('https://a.com');
    await startScan('https://b.com');
    await waitFor(() => expect(api.scanCalls).toEqual(['a.com', 'b.com']));
    expect(runningCard('a.com')).toBeInTheDocument();
    expect(runningCard('b.com')).toBeInTheDocument();
    expect(screen.getByText('2 in progress')).toBeInTheDocument();

    // Same website again: Start is held while a.com runs, so it can't be restarted or replaced.
    await userEvent.click(screen.getByRole('link', { name: /Launch New Scan/ }));
    const field = await screen.findByLabelText('Website URL');
    await userEvent.clear(field);
    await userEvent.type(field, 'https://www.a.com/other-page');
    expect(screen.getByRole('button', { name: /Scanning/ })).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, 'https://c.com'); // another website: Start is available again
    expect(screen.getByRole('button', { name: 'Start Scan' })).toBeEnabled();
    expect(api.scanCalls).toEqual(['a.com', 'b.com']);
    await userEvent.click(screen.getByRole('link', { name: /Active Scan/ }));

    api.release('b.com'); // finishes while a.com still runs: announced, not opened
    expect((await screen.findAllByText('Scan of b.com finished: 1 cookie. Open it from Active Scan.')).length).toBeGreaterThan(0); // toast + live region
    expect(runningCard('a.com')).toBeInTheDocument();
    expect(screen.getByText('1 in progress')).toBeInTheDocument();
    expect(within(runningCard('b.com')).getByRole('button', { name: /View results|Actions/ })).toBeInTheDocument();

    api.release('a.com'); // the last one opens its results, as a single scan always has
    await waitFor(() => expect(window.location.pathname).toMatch(/results|domains\/a\.com/));
  });
});
