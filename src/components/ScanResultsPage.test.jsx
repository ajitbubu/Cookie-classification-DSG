import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScanResultsPage from './ScanResultsPage';

const history = [
  { id: '1', domain: 'a.com', url: 'https://a.com', timestamp: '2026-10-11T10:00:00Z', totalCookies: 12, scanType: 'deep', pagesScanned: 40, failedPages: 38, fullResults: {} },
  { id: '2', domain: 'b.com', url: 'https://b.com', timestamp: '2026-10-10T10:00:00Z', totalCookies: 5, scanType: 'quick', pagesScanned: 1, fullResults: {} },
];

const props = (over = {}) => ({
  scanHistory: history, onOpenScan: vi.fn(), onDeleteScan: vi.fn(), onClearHistory: vi.fn(), onNewScan: vi.fn(), ...over,
});

describe('ScanResultsPage (5.1 states)', () => {
  it('success: KPI row then a table with type and status chips', () => {
    render(<ScanResultsPage {...props()} />);
    expect(screen.getByText('Total Scan').closest('.ui-kpi')).toHaveTextContent('2');
    const table = screen.getByRole('table', { name: 'Scan results' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Deep scan')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Quick scan')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Completed')).toBeInTheDocument();
  });

  it('partial: labels the scan with the exact failed count (9A)', () => {
    render(<ScanResultsPage {...props()} />);
    expect(screen.getByText('Partial (38 Failed)')).toBeInTheDocument();
  });

  it('opens a scan from its website button', async () => {
    const onOpenScan = vi.fn();
    render(<ScanResultsPage {...props({ onOpenScan })} />);
    await userEvent.click(screen.getByRole('button', { name: 'a.com' }));
    expect(onOpenScan).toHaveBeenCalledWith(history[0]);
  });

  it('searches by website', async () => {
    render(<ScanResultsPage {...props()} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search scans' }), 'b.c');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  });

  it('deletes a scan from its row menu', async () => {
    const onDeleteScan = vi.fn();
    render(<ScanResultsPage {...props({ onDeleteScan })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for a.com' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete scan' }));
    expect(onDeleteScan).toHaveBeenCalledWith('1');
  });

  it('empty: says so and offers New Scan (6A)', async () => {
    const onNewScan = vi.fn();
    render(<ScanResultsPage {...props({ scanHistory: [], onNewScan })} />);
    expect(screen.getByRole('heading', { name: 'No scans yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Scan' }));
    expect(onNewScan).toHaveBeenCalled();
  });

  it('shows Figma row formats: pages done/attempted and new cookies', () => {
    render(<ScanResultsPage {...props()} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('40/78')).toBeInTheDocument();
    expect(within(rows[0]).getByText('+12')).toBeInTheDocument();
  });

  it('filters to deep scans and clears history from the Filter menu', async () => {
    const onClearHistory = vi.fn();
    render(<ScanResultsPage {...props({ onClearHistory })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Deep scans' }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Clear history' }));
    expect(onClearHistory).toHaveBeenCalled();
  });

  it('pages the table five rows at a time', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...history[1], id: `m${i}`, domain: `s${i}.com`, timestamp: `2026-10-0${i + 1}T10:00:00Z` }));
    render(<ScanResultsPage {...props({ scanHistory: many })} />);
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });

  it('loading: KPI and row skeletons, table busy (7A)', () => {
    const { container } = render(<ScanResultsPage {...props({ loading: true })} />);
    expect(container.querySelectorAll('.ui-skeleton--kpi')).toHaveLength(4);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });

  it('error: message + Retry in the table, KPIs show — not stale numbers (8A)', async () => {
    const onRetry = vi.fn();
    render(<ScanResultsPage {...props({ error: true, onRetry })} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load scan results.");
    expect(screen.getAllByText('—')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
