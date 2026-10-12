import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewQueuePage from './ReviewQueuePage';
import { ToastProvider } from './Toast';
import { LiveRegionProvider } from './ui/LiveRegion';
import { readApprovals } from '../lib/reviewQueue';

const cookie = (name, extra = {}) => ({ name, domain: '.shop.com', category: 'Unclassified', mlClassification: 'Analytics', mlConfidence: 0.4, ...extra });
const historyWith = (cookies) => [{ id: 's1', domain: 'shop.com', timestamp: '2026-10-11T10:00:00Z', fullResults: { cookies } }];
const history = historyWith([
  cookie('_ga'),
  cookie('x9q', { domain: 'shop.com', mlClassification: 'Marketing', mlConfidence: 0.3, abstainReason: 'insufficient_evidence' }),
]);

// Single approvals hit update-category; bulk hits bulk-update-categories.
const api = ({ published = true, bulkPublished = null, fail = false } = {}) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (fail) return { ok: false, status: 503, json: async () => ({}) };
    if (url.endsWith('bulk-update-categories')) {
      const names = JSON.parse(init.body).map((u) => u.cookie_name);
      const done = bulkPublished ?? names;
      return { ok: true, json: async () => ({ total: names.length, persisted: done.length, results: names.map((n) => ({ cookie_name: n, persisted: done.includes(n) })) }) };
    }
    return { ok: true, json: async () => ({ success: true, knowledge_base_updated: published }) };
  });

const renderRQ = (h = history) => render(
  <LiveRegionProvider><ToastProvider><ReviewQueuePage scanHistory={h} onNavigate={vi.fn()} /></ToastProvider></LiveRegionProvider>
);

// UCM review table: one row per cookie, found by its name cell.
const card = (name) => screen.getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr');
const toastText = () => [...document.querySelectorAll('.toast__message')].map((t) => t.textContent).join(' | ');

describe('ReviewQueuePage review rows (12A)', () => {
  beforeEach(() => localStorage.removeItem('reviewQueueApprovals'));
  afterEach(() => vi.restoreAllMocks());

  it('is a UCM review table: Model confidence and Rule engine columns beside the suggestion', () => {
    api();
    renderRQ();
    expect(screen.queryByText('AI Confidence')).not.toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Cookie', 'Rule engine', 'Model suggestion', 'Model confidence', 'Category', 'Actions']));
    const cells = within(card('_ga')).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(expect.arrayContaining(['Analytics', '40%']));
  });

  it('shows the queues as tabs with counts and an empty state per queue (6A)', async () => {
    api();
    renderRQ();
    expect(screen.getByRole('tab', { name: /High priority/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /Validation/ }));
    expect(screen.getByRole('heading', { name: 'Nothing to review' })).toBeInTheDocument();
  });

  it('marks suggestions without identity evidence "Needs manual check"', () => {
    api();
    renderRQ();
    expect(within(card('x9q')).getByText('Needs manual check')).toBeInTheDocument();
    expect(within(card('_ga')).queryByText('Needs manual check')).not.toBeInTheDocument();
  });

  it('publishes an approval and removes the row with a success toast (E4)', async () => {
    api({ published: true });
    renderRQ();
    await userEvent.click(within(card('_ga')).getByRole('button', { name: /^Approve/ }));
    await waitFor(() => expect(readApprovals().map((a) => a.cookieKey)).toEqual(['shop.com:_ga']));
    expect(screen.queryByRole('rowheader', { name: /^_ga/ })).not.toBeInTheDocument();
    expect(toastText()).toContain('_ga approved as Analytics');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ scan_id: 's1', cookie_name: '_ga', new_category: 'Analytics' });
  });

  it('keeps a saved-but-unpublished approval in the queue, marked "Not published" with Retry (E4)', async () => {
    const spy = api({ published: false });
    renderRQ();
    await userEvent.click(within(card('_ga')).getByRole('button', { name: /^Approve/ }));
    await waitFor(() => expect(within(card('_ga')).getByText('Not published')).toBeInTheDocument());
    expect(readApprovals()).toEqual([]);
    expect(toastText()).toContain('Saved, but not published: the database is unavailable');

    spy.mockRestore();
    api({ published: true });
    await userEvent.click(within(card('_ga')).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /^_ga/ })).not.toBeInTheDocument());
  });

  it('shows an inline error and keeps the row when saving fails (8A)', async () => {
    api({ fail: true });
    renderRQ();
    await userEvent.click(within(card('_ga')).getByRole('button', { name: /^Approve/ }));
    await waitFor(() => expect(within(card('_ga')).getByText(/Couldn't save/)).toBeInTheDocument());
    expect(within(card('_ga')).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(readApprovals()).toEqual([]);
  });

  it('requires confirmation before approving an insufficient-evidence suggestion', async () => {
    api();
    renderRQ();
    await userEvent.click(within(card('x9q')).getByRole('button', { name: /^Approve/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Approve without evidence?' });
    expect(dialog).toHaveTextContent('The model had no name or vendor signal for this cookie. Approve Marketing?');
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.click(within(card('x9q')).getByRole('button', { name: /^Approve/ }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Approve Marketing' }));
    await waitFor(() => expect(readApprovals().map((a) => a.cookieKey)).toEqual(['shop.com:x9q']));
  });

  it('bulk approve leaves manual-check rows in the queue', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api();
    renderRQ();
    await userEvent.click(screen.getByRole('button', { name: /Approve All/ }));
    await waitFor(() => expect(readApprovals().map((a) => a.cookieKey)).toEqual(['shop.com:_ga']));
    expect(card('x9q')).toBeInTheDocument();
    expect(screen.getByText(/1 needs a manual check/)).toBeInTheDocument();
  });

  it('bulk approve reports "2 of 3 published" and keeps the unpublished row marked (E4)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api({ bulkPublished: ['a1', 'a3'] });
    renderRQ(historyWith([cookie('a1'), cookie('a2'), cookie('a3')]));
    await userEvent.click(screen.getByRole('button', { name: /Approve All/ }));
    await waitFor(() => expect(readApprovals().map((a) => a.cookieKey).sort()).toEqual(['shop.com:a1', 'shop.com:a3']));
    expect(toastText()).toContain('2 of 3 published. 1 saved but not published: the database is unavailable.');
    expect(within(card('a2')).getByText('Not published')).toBeInTheDocument();
  });
});
