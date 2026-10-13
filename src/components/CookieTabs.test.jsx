import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CookieTabs from './CookieTabs';

// Scanning page tabs (Figma 1:189760): Launch New Scan | Active Scan (n) | Scan Result.
describe('CookieTabs — Scanning tabs (Figma 1:189760, decision 22A)', () => {
  const renderTabs = (props = {}) =>
    render(<CookieTabs currentPage="launch" activeCount={0} onNavigate={vi.fn()} {...props} />);

  it('renders the three Scanning tabs as links in a labelled navigation', () => {
    renderTabs();
    const nav = screen.getByRole('navigation', { name: 'Scanning' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent.replace(/\d+$/, '').trim())).toEqual(['Launch New Scan', 'Active Scan', 'Scan Result']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/scanning', '/scanning/active', '/scanning/results']);
  });

  it('marks the current tab', () => {
    renderTabs({ currentPage: 'history' });
    expect(screen.getByRole('link', { name: 'Scan Result' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Launch New Scan' })).not.toHaveAttribute('aria-current');
  });

  it('navigates in-app instead of reloading', async () => {
    const onNavigate = vi.fn();
    renderTabs({ onNavigate });
    await userEvent.click(screen.getByRole('link', { name: 'Scan Result' }));
    expect(onNavigate).toHaveBeenCalledWith('history');
  });

  it('shows the active scan count only when there is one', () => {
    const { rerender } = renderTabs({ activeCount: 3 });
    expect(screen.getByRole('link', { name: 'Active Scan, 3 active' })).toBeInTheDocument();
    rerender(<CookieTabs currentPage="launch" activeCount={0} onNavigate={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Active Scan' })).toBeInTheDocument();
  });

  it('has no New Scan button: Launch New Scan is a tab', () => {
    renderTabs();
    expect(screen.queryByRole('button', { name: 'New Scan' })).not.toBeInTheDocument();
  });
});
