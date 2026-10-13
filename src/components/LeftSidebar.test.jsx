import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeftSidebar from './LeftSidebar';

/**
 * Sidebar contract, Figma 1:189760 / 1:129292.
 *
 * Preserved from FINDING-002 (mobile drawer, regression contract R6):
 *   - the drawer exposes labelled items
 *   - the backdrop closes it
 *   - selecting an item closes it
 * Intentional change (R6 allowed update, user request 2026-10-12 "match Figma"):
 *   the full product menu is shown; Cookie Classification is expanded to its
 *   five pages; modules this app does not have are listed but disabled.
 */
const COOKIE_ITEMS = ['Dashboard', 'Scanning', 'Website', 'Cookie Inventory', 'Review Queue'];
const OTHER_MODULES = ['UCM', 'PIA', 'CDD', 'DSAR', 'CDR', 'DPM', 'Compliance Audit', 'Organization'];

describe('LeftSidebar — Figma product menu', () => {
  it('shows the datasafeguard brand', () => {
    render(<LeftSidebar onNavigate={vi.fn()} />);
    expect(screen.getByRole('img', { name: /datasafeguard/i })).toBeInTheDocument();
  });

  it('lists the Cookie Classification pages as working items', () => {
    render(<LeftSidebar currentPage="home" onNavigate={vi.fn()} />);
    for (const label of COOKIE_ITEMS) {
      expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('shows the other product modules but disables them', () => {
    render(<LeftSidebar currentPage="home" onNavigate={vi.fn()} />);
    for (const label of OTHER_MODULES) {
      expect(screen.getByRole('menuitem', { name: label }), label).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('does nothing when a disabled module is clicked', async () => {
    const onNavigate = vi.fn();
    render(<LeftSidebar currentPage="home" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'PIA' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates to each Cookie Classification page', async () => {
    const onNavigate = vi.fn();
    render(<LeftSidebar currentPage="home" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Scanning' }));
    expect(onNavigate).toHaveBeenLastCalledWith('launch');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Website' }));
    expect(onNavigate).toHaveBeenLastCalledWith('websites');
  });

  it('marks Scanning current on every scanning screen, Domain Details included', () => {
    for (const page of ['launch', 'active', 'history', 'results']) {
      const { unmount } = render(<LeftSidebar currentPage={page} onNavigate={vi.fn()} />);
      expect(screen.getByRole('menuitem', { name: 'Scanning' }), page).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('menuitem', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it('opens Settings to reach ML Model, and shows it open on the model page', async () => {
    const onNavigate = vi.fn();
    const { unmount } = render(<LeftSidebar currentPage="home" onNavigate={onNavigate} />);
    expect(screen.queryByRole('menuitem', { name: 'ML Model' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'ML Model' }));
    expect(onNavigate).toHaveBeenLastCalledWith('model');
    unmount();

    render(<LeftSidebar currentPage="model" onNavigate={vi.fn()} />);
    expect(screen.getByRole('menuitem', { name: 'ML Model' })).toHaveAttribute('aria-current', 'page');
  });

  describe('mobile drawer (FINDING-002, preserved)', () => {
    it('exposes the item labels as text when opened', () => {
      render(<LeftSidebar mobileOpen onMobileClose={vi.fn()} currentPage="home" />);
      expect(screen.getByText('Cookie Classification')).toBeVisible();
      expect(screen.getByText('Review Queue')).toBeVisible();
    });

    it('closes when the backdrop is tapped', async () => {
      const onMobileClose = vi.fn();
      const { container } = render(<LeftSidebar mobileOpen onMobileClose={onMobileClose} />);
      const backdrop = container.querySelector('.left-sidebar-backdrop');
      expect(backdrop.className).toContain('visible');
      await userEvent.click(backdrop);
      expect(onMobileClose).toHaveBeenCalled();
    });

    it('closes after selecting an item', async () => {
      const onMobileClose = vi.fn();
      render(<LeftSidebar mobileOpen onMobileClose={onMobileClose} onNavigate={vi.fn()} currentPage="home" />);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Review Queue' }));
      expect(onMobileClose).toHaveBeenCalled();
    });
  });
});
