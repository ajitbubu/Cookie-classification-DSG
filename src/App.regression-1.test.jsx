// Regression: ISSUE-001 — a failed Quick scan vanished (alert() only, no failure card)
// Regression: ISSUE-004 — a Quick scan with cookies was saved twice (raw + ML-corrected)
// Found by /qa on 2026-10-12
// Report: .gstack/qa-reports/run-20261012T225654Z/qa-report-localhost-2026-10-12.md
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ToastProvider } from './components/Toast';
import { LiveRegionProvider } from './components/ui/LiveRegion';

const scanResponse = {
  domain: 'shop.com',
  scannedUrl: 'https://shop.com',
  scannedAt: '2026-10-12T10:00:00.000Z',
  totalCount: 2,
  cookies: [
    { name: '_ga', domain: '.shop.com', category: 'Analytics', isThirdParty: false, requiresConsent: true },
    { name: 'sid', domain: 'shop.com', category: 'Strictly Necessary', isThirdParty: false, requiresConsent: false },
  ],
  statistics: { byCategory: { Analytics: 1, 'Strictly Necessary': 1 }, byType: {}, requiresConsent: 1, thirdParty: 0, totalSize: 0 },
  pageResults: [],
  errorPages: [],
};

const classifications = scanResponse.cookies.map((c) => ({
  id: `${c.name}-${c.domain}`, predicted_category: c.category, suggested_category: c.category,
  confidence: 0.9, confidence_level: 'High', classification_status: 'review', source: 'ml_prediction',
}));

function routeFetch({ scanStatus = 200 } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/api/scan')) {
      return scanStatus === 200
        ? { ok: true, status: 200, statusText: 'OK', json: async () => scanResponse }
        : { ok: false, status: scanStatus, statusText: 'Service Unavailable', json: async () => ({}) };
    }
    if (u.includes('/api/v1/ml/classify')) return { ok: true, status: 200, json: async () => ({ classifications }) };
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const renderApp = () => render(<LiveRegionProvider><ToastProvider><App /></ToastProvider></LiveRegionProvider>);

async function startQuickScan(url) {
  const field = await screen.findByLabelText('Website URL');
  await userEvent.type(field, url);
  await userEvent.click(screen.getByRole('button', { name: 'Start Scan' }));
}

describe('Quick scan from Launch New Scan (App wiring)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/scanning');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('ISSUE-001: shows the failed scan on Active Scan instead of a browser alert', async () => {
    routeFetch({ scanStatus: 503 });
    renderApp();
    await startQuickScan('https://shop.com');
    const card = await screen.findByRole('article', { name: 'https://shop.com' });
    expect(within(card).getByText(/Scan failed/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Retry scan' })).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('ISSUE-004: saves one history entry per scan, updated with the model results', async () => {
    routeFetch();
    renderApp();
    await startQuickScan('https://shop.com');
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/ml/classify', expect.anything()));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cookieScanHistory') || '[]').length).toBeGreaterThan(0));
    // let the ML-corrected save land
    await new Promise((r) => setTimeout(r, 50));
    const history = JSON.parse(localStorage.getItem('cookieScanHistory'));
    expect(history).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('domainScanHistory'))['shop.com']).toHaveLength(1);
  });
});
