import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './DashboardPage';
import { readApprovals } from '../lib/reviewQueue';
import { ToastProvider } from './Toast';
import { LiveRegionProvider } from './ui/LiveRegion';

const MODEL_INFO = {
  model_version: '6.1.0',
  metrics: { internal_site_holdout: { accuracy: 0.9461 } },
  acceptance: { auto_classification_enabled: false },
};

const history = [
  { id: 's1', domain: 'shop.com', url: 'https://shop.com', timestamp: new Date().toISOString(), scanType: 'deep', totalCookies: 3,
    categories: { Marketing: 1, Unclassified: 2 }, gdprRisk: 'HIGH', failedPages: 1,
    fullResults: { cookies: [
      { name: '_fbp', domain: '.facebook.com', category: 'Marketing' },
      { name: '_ga', domain: '.shop.com', category: 'Unclassified', mlClassification: 'Analytics', mlConfidence: 0.82 },
      { name: 'odd', domain: 'shop.com', category: 'Unclassified', mlClassification: 'Marketing', abstainReason: 'insufficient_evidence' },
    ] } },
];

const mockFetch = (impl) => vi.spyOn(globalThis, 'fetch').mockImplementation(impl);

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.removeItem('aiInsightsDismissed');
    localStorage.removeItem('reviewQueueApprovals');
  });
  afterEach(() => vi.restoreAllMocks());

  const setup = (props = {}) => render(
    <LiveRegionProvider><ToastProvider>
      <DashboardPage scanHistory={history} onNavigate={vi.fn()} onOpenScan={vi.fn()} launchControl={<div>launch control</div>} {...props} />
    </ToastProvider></LiveRegionProvider>
  );
  // model-info for AI Insights; update-category for approvals (E4)
  const routeFetch = ({ published = true, fail = false } = {}) => mockFetch(async (url) => {
    if (url.includes('update-category')) {
      return fail ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, json: async () => ({ success: true, knowledge_base_updated: published }) };
    }
    return { ok: true, json: async () => MODEL_INFO };
  });

  it('AI Insights shows exactly what model-info reports (11A)', async () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    setup();
    const banner = screen.getByRole('region', { name: 'AI insights' });
    await waitFor(() => expect(within(banner).getByText('94.6%')).toBeInTheDocument());
    expect(within(banner).getByText('Classification accuracy')).toBeInTheDocument();
    expect(within(banner).getByText('Model v6.1.0')).toBeInTheDocument();
    expect(within(banner).getByText('Based on your recent reviews and classifications')).toBeInTheDocument();
    // auto-classification is off, so nothing was auto classified
    expect(within(banner).getByText('Cookies auto classified').closest('.ai-stat')).toHaveTextContent('0');
    expect(within(banner).getByText('Cookie Unclassified').closest('.ai-stat')).toHaveTextContent('2');
    // awaiting review = unpublished cookies in the latest scan
    expect(within(banner).getByText('Suggestions awaiting review').closest('.ai-stat')).toHaveTextContent('2');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/ml/model-info');
  });

  it('AI Insights says when model information is unavailable, never inventing numbers', async () => {
    mockFetch(async () => ({ ok: false, status: 503 }));
    setup();
    const banner = screen.getByRole('region', { name: 'AI insights' });
    await waitFor(() => expect(within(banner).getByText(/model information is unavailable/i)).toBeInTheDocument());
    expect(within(banner).queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('links to the ML Model page and can be dismissed', async () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    const onNavigate = vi.fn();
    setup({ onNavigate });
    await userEvent.click(screen.getByRole('button', { name: 'View ML model' }));
    expect(onNavigate).toHaveBeenCalledWith('model');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss AI insights' }));
    expect(screen.queryByRole('region', { name: 'AI insights' })).not.toBeInTheDocument();
  });

  it('first run: one "Scan your first website" panel with the launch control, nothing else (6A)', () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    setup({ scanHistory: [] });
    expect(screen.getByRole('heading', { name: 'Scan your first website' })).toBeInTheDocument();
    expect(screen.getByText('launch control')).toBeInTheDocument();
    expect(document.querySelector('.ui-kpi')).toBeNull();
    expect(screen.queryByRole('table', { name: 'Recent activity' })).not.toBeInTheDocument();
  });

  it('KPI row (Figma Website, Cookies, Risk Score, Reviews) with status chips, then the two charts', () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    setup();
    const card = (label) => screen.getByText(label, { selector: '.ui-kpi__label' }).closest('.ui-kpi');
    expect(card('Website')).toHaveTextContent('1');
    expect(within(card('Website')).getByText('1 Active')).toBeInTheDocument();
    expect(card('Cookies')).toHaveTextContent('3');
    expect(within(card('Cookies')).getByText('2 Unclassified')).toBeInTheDocument();
    expect(card('Risk Score')).toHaveTextContent('C (67)');
    expect(within(card('Risk Score')).getByText('1 Critical + High')).toBeInTheDocument();
    expect(card('Reviews')).toHaveTextContent('2');
    expect(within(card('Reviews')).getByText('1 High Priority')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cookie count by category' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cookies by category' })).toBeInTheDocument();
  });

  it('switches the chart period', async () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    setup();
    const [period] = screen.getAllByLabelText('Period');
    expect([...period.options].map((o) => o.textContent)).toEqual(['This Week', 'This Month', 'All Time']);
    await userEvent.selectOptions(period, 'all');
    expect(period).toHaveValue('all');
  });

  it('three tables: recent cookies, recent activity (opens the scan), pending review', async () => {
    mockFetch(async () => ({ ok: true, json: async () => MODEL_INFO }));
    const onOpenScan = vi.fn();
    const onNavigate = vi.fn();
    setup({ onOpenScan, onNavigate });
    expect(within(screen.getByRole('table', { name: 'Recently discovered cookies' })).getAllByRole('row')).toHaveLength(4);

    const activity = screen.getByRole('table', { name: 'Recent activity' });
    expect(within(activity).getByText('Deep')).toBeInTheDocument();
    await userEvent.click(within(activity).getByRole('button', { name: 'shop.com' }));
    expect(onOpenScan).toHaveBeenCalledWith(history[0]);

    const pending = screen.getByRole('table', { name: 'Pending review' });
    const rows = within(pending).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Analytics')).toBeInTheDocument();
    expect(within(rows[0]).getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('2 Items')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See all pending reviews' }));
    expect(onNavigate).toHaveBeenCalledWith('review');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search recent activity' }), 'zzz');
    expect(within(activity).getAllByRole('row')).toHaveLength(2); // header + "no match" row
  });

  it('pending review rows (12A): Figma columns, rule engine noted, manual-check chip, Approve with confirmation, Edit', async () => {
    routeFetch();
    const onNavigate = vi.fn();
    setup({ onNavigate });
    const pending = screen.getByRole('table', { name: 'Pending review' });
    expect(within(pending).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Details', 'Chances', 'Action']);
    const [ga, odd] = within(pending).getAllByRole('row').slice(1);
    expect(within(ga).queryByText(/^Rule engine:/)).not.toBeInTheDocument(); // rule engine and model agree
    expect(within(odd).getByText(/^Rule engine: /)).toBeInTheDocument(); // they differ, so the rule's answer is noted
    expect(within(odd).getByText('Needs manual check')).toBeInTheDocument();

    await userEvent.click(within(ga).getByRole('button', { name: 'Approve _ga' }));
    await waitFor(() => expect(readApprovals().map((a) => a.cookieKey)).toEqual(['shop.com:_ga']));
    expect(within(screen.getByRole('table', { name: 'Pending review' })).getAllByRole('row')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Approve odd' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Approve without evidence?' });
    expect(dialog).toHaveTextContent('Approve Marketing?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(readApprovals()).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Edit odd' }));
    expect(onNavigate).toHaveBeenCalledWith('review');
  });

  it('keeps an approval that was saved but not published, marked with Retry (E4)', async () => {
    routeFetch({ published: false });
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Approve _ga' }));
    const row = () => screen.getByRole('table', { name: 'Pending review' }).querySelector('tbody tr');
    await waitFor(() => expect(row()).toHaveTextContent('Not published'));
    expect(readApprovals()).toEqual([]);
    expect(document.querySelector('.toast__message')).toHaveTextContent('Saved, but not published: the database is unavailable.');
    expect(within(row()).getByRole('button', { name: 'Retry _ga' })).toBeInTheDocument();
  });

  it('shows an inline error when the approval cannot be saved (8A)', async () => {
    routeFetch({ fail: true });
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Approve _ga' }));
    await waitFor(() => expect(screen.getByText(/Couldn't save/)).toBeInTheDocument());
    expect(readApprovals()).toEqual([]);
  });
});
