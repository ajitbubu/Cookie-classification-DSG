import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebsitesPage from './WebsitesPage';

const scanHistory = [
  { id: 'a2', domain: 'a.com', url: 'https://a.com', timestamp: '2026-10-11T10:00:00Z', totalCookies: 9, categories: { Unclassified: 3 }, gdprRisk: 'HIGH', failedPages: 2, fullResults: {} },
  { id: 'b1', domain: 'b.com', url: 'https://b.com', timestamp: '2026-10-05T10:00:00Z', totalCookies: 2, categories: {}, gdprRisk: 'LOW', ccpaRisk: 'LOW', dpdpRisk: 'LOW' },
];
const props = (over = {}) => ({ scanHistory, domainHistory: {}, onOpenScan: vi.fn(), onScanNow: vi.fn(), onNewScan: vi.fn(), ...over });

describe('WebsitesPage', () => {
  it('lists each website with cookies, unclassified, risk and the last scan\'s status', () => {
    render(<WebsitesPage {...props()} />);
    const rows = within(screen.getByRole('table', { name: 'Websites' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('a.com');
    expect(within(rows[0]).getByText('High')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Partial (2 Failed)')).toBeInTheDocument();
  });

  it('opens the latest scan, or scans a site again from its menu', async () => {
    const p = props();
    render(<WebsitesPage {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'a.com' }));
    expect(p.onOpenScan).toHaveBeenCalledWith(scanHistory[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for b.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Scan now' }));
    expect(p.onScanNow).toHaveBeenCalledWith('https://b.com');
  });

  it('searches and sorts', async () => {
    render(<WebsitesPage {...props()} />);
    await userEvent.selectOptions(screen.getByLabelText('Sort websites'), 'alpha');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['a.com', 'b.com']);
    await userEvent.selectOptions(screen.getByLabelText('Sort websites'), 'cookies');
    expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('a.com');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search websites' }), 'b.c');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['b.com']);
  });

  it('empty: "No websites added" with Scan a website (6A)', async () => {
    const p = props({ scanHistory: [] });
    render(<WebsitesPage {...p} />);
    expect(screen.getByRole('heading', { name: 'No websites added' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Scan a website' }));
    expect(p.onNewScan).toHaveBeenCalled();
  });

  it('loading and error states live in the table body (7A, 8A)', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<WebsitesPage {...props({ loading: true })} />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    rerender(<WebsitesPage {...props({ error: true, onRetry })} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load websites.");
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
