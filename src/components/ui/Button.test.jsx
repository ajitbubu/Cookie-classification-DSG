import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Plus } from 'lucide-react';
import Button from './Button';

describe('Button (UCM .ucm-btn)', () => {
  it('renders the design-system variants and sizes as classes', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('ui-btn', 'ui-btn--neutral');
    rerender(<Button variant="primary" size="modal">Scan</Button>);
    expect(screen.getByRole('button', { name: 'Scan' })).toHaveClass('ui-btn--primary', 'ui-btn--modal');
    rerender(<Button variant="success">Approve</Button>);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveClass('ui-btn--success');
  });

  it('defaults to type="button", passes props through and shows a leading icon', async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" icon={Plus} onClick={onClick} aria-label="New Scan">New Scan</Button>);
    const btn = screen.getByRole('button', { name: 'New Scan' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveClass('ui-btn--icon-lead');
    expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('uses the UCM button fills and keeps 44px touch targets', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/ui/Button.css'), 'utf8');
    expect(css).toMatch(/\.ui-btn--primary\s*\{[^}]*var\(--ucm-btn-primary\)/);
    expect(css).toMatch(/\.ui-btn--success\s*\{[^}]*var\(--ucm-green-2\)/);
    expect(css).toMatch(/\.ui-btn--modal\s*\{[^}]*height:\s*44px/);
    expect(css).toMatch(/pointer:\s*coarse[\s\S]*min-height:\s*44px/);
  });
});
