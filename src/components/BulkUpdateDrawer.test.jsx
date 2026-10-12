import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkUpdateDrawer from './BulkUpdateDrawer';

const cookies = [
  { name: '_ga', domain: '.a.com', category: 'Unclassified' },
  { name: '_fbp', domain: '.a.com', category: 'Analytics' },
];

describe('BulkUpdateDrawer (Figma 12.13.08)', () => {
  it('is the labelled dialog with one category picker per selected cookie', () => {
    render(<BulkUpdateDrawer open cookies={cookies} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Bulk Update Cookie Type' })).toBeInTheDocument();
    expect(screen.getByLabelText('Category for _ga')).toHaveValue('Unclassified');
    expect(screen.getByLabelText('Category for _fbp')).toHaveValue('Analytics');
  });

  it('counts the selection and starts every row on the category picked in the selection bar', () => {
    render(<BulkUpdateDrawer open cookies={cookies} initialCategory="Marketing" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('2 Selected!')).toBeInTheDocument();
    expect(screen.getByLabelText('Category for _ga')).toHaveValue('Marketing');
    expect(screen.getByLabelText('Category for _fbp')).toHaveValue('Marketing');
  });

  it('confirms only real changes', async () => {
    const onConfirm = vi.fn();
    render(<BulkUpdateDrawer open cookies={cookies} initialCategory="Analytics" onConfirm={onConfirm} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith({ '_ga|.a.com': 'Analytics' });
  });

  it('cannot confirm with nothing changed, and Cancel closes', async () => {
    const onClose = vi.fn();
    render(<BulkUpdateDrawer open cookies={cookies} onConfirm={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('offers only categories the backend accepts', () => {
    render(<BulkUpdateDrawer open cookies={cookies} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const options = [...screen.getByLabelText('Category for _ga').options].map((o) => o.value);
    expect(options).toEqual(['Strictly Necessary', 'Functional', 'Analytics', 'Marketing', 'Unclassified']);
  });
});
