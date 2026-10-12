import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination, { pageItems } from './Pagination';

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
  });
  it('shows the first pages, an ellipsis and the last page (Figma: 1 2 3 … 10)', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, '…', 10]);
    expect(pageItems(6, 10)).toEqual([1, '…', 5, 6, 7, '…', 10]);
    expect(pageItems(10, 10)).toEqual([1, '…', 8, 9, 10]);
  });
});

describe('Pagination (Figma 12.10.31)', () => {
  const setup = (over = {}) => {
    const props = { page: 1, pageSize: 5, total: 23, onPageChange: vi.fn(), onPageSizeChange: vi.fn(), ...over };
    render(<Pagination {...props} />);
    return props;
  };

  it('changes rows per page', async () => {
    const props = setup();
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '10');
    expect(props.onPageSizeChange).toHaveBeenCalledWith(10);
  });

  it('marks the current page and moves between pages', async () => {
    const props = setup({ page: 2 });
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(props.onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(props.onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('disables Previous on the first page and Next on the last', () => {
    setup({ page: 5 });
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });
});
