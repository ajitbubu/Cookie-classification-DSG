import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuButton from './MenuButton';

const items = (onSelect) => [
  { label: 'View details', onSelect: () => onSelect('view') },
  { label: 'Rescan', onSelect: () => onSelect('rescan') },
  { label: 'Delete', onSelect: () => onSelect('delete') },
];

describe('MenuButton (22A menu-button pattern)', () => {
  it('opens with Enter and focuses the first item', async () => {
    render(<MenuButton label="Actions for a.com" items={items(vi.fn())} />);
    const button = screen.getByRole('button', { name: 'Actions for a.com' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'View details' })).toHaveFocus();
  });

  it('opens with ArrowDown and Space too', async () => {
    render(<MenuButton label="Actions" items={items(vi.fn())} />);
    screen.getByRole('button', { name: 'Actions' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard(' ');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves with arrow keys, wrapping, and selects with Enter', async () => {
    const onSelect = vi.fn();
    render(<MenuButton label="Actions" items={items(onSelect)} />);
    screen.getByRole('button', { name: 'Actions' }).focus();
    await userEvent.keyboard('{Enter}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rescan' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('delete');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });

  it('closes on Esc and returns focus to the button', async () => {
    render(<MenuButton label="Actions" items={items(vi.fn())} />);
    const button = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    render(<><MenuButton label="Actions" items={items(vi.fn())} /><p>outside</p></>);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
