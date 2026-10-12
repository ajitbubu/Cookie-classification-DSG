import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TableToolbar from './TableToolbar';

describe('TableToolbar (Figma search + filter + sort)', () => {
  const setup = (over = {}) => {
    const props = {
      label: 'Search scans', query: '', onQuery: vi.fn(),
      filters: [{ value: 'all', label: 'All scans' }, { value: 'deep', label: 'Deep scans' }], filter: 'all', onFilter: vi.fn(),
      sorts: [{ value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }], sort: 'new', onSort: vi.fn(),
      ...over,
    };
    render(<TableToolbar {...props} />);
    return props;
  };

  it('has a labelled search box with the Figma placeholder', async () => {
    const props = setup();
    const box = screen.getByRole('searchbox', { name: 'Search scans' });
    expect(box).toHaveAttribute('placeholder', 'Search');
    await userEvent.type(box, 'a');
    expect(props.onQuery).toHaveBeenCalledWith('a');
  });

  it('filters and sorts from icon menus that show the current choice', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('menuitemradio', { name: 'All scans' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Deep scans' }));
    expect(props.onFilter).toHaveBeenCalledWith('deep');
    await userEvent.click(screen.getByRole('button', { name: 'Sort' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oldest first' }));
    expect(props.onSort).toHaveBeenCalledWith('old');
  });

  it('adds extra menu actions after the filters', async () => {
    const onClear = vi.fn();
    setup({ actions: [{ label: 'Clear history', tone: 'critical', onSelect: onClear }] });
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Clear history' }));
    expect(onClear).toHaveBeenCalled();
  });
});
