import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieInventoryPage from './CookieInventoryPage';

const history = [
  { domain: 'a.com', timestamp: '2026-10-11T10:00:00.000Z', failedPages: 1, fullResults: { cookies: [
    { name: '_ga', domain: '.a.com', category: 'Analytics' },
    { name: 'sid', domain: 'a.com', category: 'Strictly Necessary' },
  ] } },
];

describe('CookieInventoryPage', () => {
  it('lists every stored cookie with its category, sites and source scan', () => {
    render(<CookieInventoryPage scanHistory={history} onNewScan={vi.fn()} />);
    const rows = within(screen.getByRole('table', { name: 'Cookie inventory' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('_ga');
    expect(within(rows[0]).getByText('Analytics')).toBeInTheDocument();
    // Cookies from partial scans are listed normally; the source scan shows the Partial chip (9A)
    expect(within(rows[0]).getByText('Partial (1 Failed)')).toBeInTheDocument();
  });

  it('filters by name or domain, and by category', async () => {
    render(<CookieInventoryPage scanHistory={history} onNewScan={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search cookies' }), 'sid');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['sid']);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search cookies' }));
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Analytics');
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent)).toEqual(['_ga']);
  });

  it('empty: explains where cookies come from and offers New Scan (6A)', async () => {
    const onNewScan = vi.fn();
    render(<CookieInventoryPage scanHistory={[]} onNewScan={onNewScan} />);
    expect(screen.getByRole('heading', { name: 'No cookies discovered yet' })).toBeInTheDocument();
    expect(screen.getByText('Cookies appear here after your first scan.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Scan' }));
    expect(onNewScan).toHaveBeenCalled();
  });

  it('loading: 8 row skeletons; error: message + Retry (7A, 8A)', async () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(<CookieInventoryPage scanHistory={history} loading onNewScan={vi.fn()} />);
    expect(container.querySelectorAll('.ui-skeleton--row')).toHaveLength(8);
    rerender(<CookieInventoryPage scanHistory={history} error onRetry={onRetry} onNewScan={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the cookie inventory.");
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
