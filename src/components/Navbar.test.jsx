import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Navbar from './Navbar';

const renderBar = (props = {}) =>
  render(<Navbar navOpen={false} onMenuToggle={vi.fn()} notifications={[]} unreadCount={0} {...props} />);

describe('Navbar — top bar (plan decisions 1B, 14A, 17A)', () => {
  it('titles cookie screens "Cookie Classification" as the page <h1>', () => {
    renderBar({ currentPage: 'review' });
    expect(screen.getByRole('heading', { level: 1, name: 'Cookie Classification' })).toBeInTheDocument();
  });

  it('shows the Cookie Classification breadcrumb with the current screen last', () => {
    renderBar({ currentPage: 'history' });
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem');
    expect(crumbs.map((li) => li.textContent)).toEqual(['Cookie Classification', 'Scanning']);
    expect(within(crumbs[1]).getByText('Scanning')).toHaveAttribute('aria-current', 'page');
  });

  it('titles the ML Model page under Settings', () => {
    renderBar({ currentPage: 'model' });
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('carries no brand mark (it lives in the sidebar) and no FACEOFF', () => {
    renderBar({ currentPage: 'home' });
    expect(screen.queryByRole('img', { name: /datasafeguard|faceoff/i })).not.toBeInTheDocument();
    expect(screen.queryByText('FACEOFF')).not.toBeInTheDocument();
  });

  it('keeps the mobile menu button', () => {
    renderBar({ currentPage: 'home' });
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
  });
});
