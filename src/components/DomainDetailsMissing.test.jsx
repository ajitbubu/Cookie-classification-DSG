import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainDetailsMissing from './DomainDetailsMissing';

describe('DomainDetailsMissing (E3 loader states)', () => {
  it('unknown domain: "No scans for <domain>" + New Scan', async () => {
    const onNewScan = vi.fn();
    render(<DomainDetailsMissing status="unknown" domain="nope.com" onNewScan={onNewScan} onScanNow={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No scans for nope.com' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Scan' }));
    expect(onNewScan).toHaveBeenCalled();
  });

  it('pruned scan: identity row + "no longer stored" + Scan Now', async () => {
    const onScanNow = vi.fn();
    const entry = { id: 's1', domain: 'shop.com', url: 'https://shop.com', timestamp: '2026-10-01T10:00:00Z', scanType: 'deep', totalCookies: 12 };
    render(<DomainDetailsMissing status="pruned" domain="shop.com" entry={entry} onNewScan={vi.fn()} onScanNow={onScanNow} />);
    expect(screen.getByRole('heading', { name: 'shop.com' })).toBeInTheDocument();
    expect(screen.getByText('Deep scan')).toBeInTheDocument();
    expect(screen.getByText('Full details for this scan are no longer stored in this browser.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Scan Now' }));
    expect(onScanNow).toHaveBeenCalledWith('https://shop.com', 'deep');
  });

  it('no scan open: points to Scan Results', async () => {
    const onOpenResults = vi.fn();
    render(<DomainDetailsMissing status="none" onOpenResults={onOpenResults} onNewScan={vi.fn()} onScanNow={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No scan open' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open Scan Results' }));
    expect(onOpenResults).toHaveBeenCalled();
  });
});
