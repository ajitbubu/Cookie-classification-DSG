import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import Donut from './Donut';
import BarSeries from './BarSeries';

const mix = [{ label: 'Marketing', value: 4 }, { label: 'Analytics', value: 3 }, { label: 'Unclassified', value: 3 }];

describe('Donut (26A)', () => {
  it('gives screen readers a data table instead of the picture', () => {
    const { container } = render(<Donut title="Cookies by category" data={mix} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const table = screen.getByRole('table', { name: 'Cookies by category' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['Marketing440%', 'Analytics330%', 'Unclassified330%']);
  });

  it('draws one segment per category and a legend with counts', () => {
    const { container } = render(<Donut title="Cookies by category" data={mix} />);
    expect(container.querySelectorAll('.chart-donut__segment')).toHaveLength(3);
    const legend = container.querySelector('.chart-legend');
    expect(legend).toHaveTextContent('Marketing4');
    expect(container.querySelector('.chart-donut__total')).toHaveTextContent('10');
  });

  it('shows a tooltip on hover', () => {
    const { container } = render(<Donut title="Cookies by category" data={mix} />);
    fireEvent.mouseEnter(container.querySelectorAll('.chart-donut__segment')[0]);
    expect(container.querySelector('.chart-tooltip')).toHaveTextContent('Marketing: 4 (40%)');
  });

  it('colours segments from theme tokens', () => {
    const { container } = render(<Donut title="x" data={mix} />);
    const strokes = [...container.querySelectorAll('.chart-donut__segment')].map((p) => p.getAttribute('stroke'));
    expect(strokes.every((s) => s.startsWith('var(--'))).toBe(true);
  });

  it('says so when there is nothing to chart', () => {
    render(<Donut title="Cookies by category" data={[]} />);
    expect(screen.getByText('No cookies recorded yet')).toBeInTheDocument();
  });
});

describe('BarSeries (26A)', () => {
  const days = [{ label: 'Mon 6', value: 0 }, { label: 'Tue 7', value: 5 }, { label: 'Wed 8', value: 10 }];

  it('gives screen readers a data table', () => {
    render(<BarSeries title="Unclassified cookies over time" valueLabel="Unclassified" data={days} />);
    const table = screen.getByRole('table', { name: 'Unclassified cookies over time' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Day', 'Unclassified']);
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Mon 60', 'Tue 75', 'Wed 810']);
  });

  it('scales bars to the largest value and labels each day', () => {
    const { container } = render(<BarSeries title="x" valueLabel="y" data={days} />);
    const bars = [...container.querySelectorAll('.chart-bars__bar')];
    expect(bars.map((b) => Number(b.getAttribute('height')))).toEqual([0, 50, 100]);
    expect([...container.querySelectorAll('.chart-bars__label')].map((t) => t.textContent)).toEqual(['Mon 6', 'Tue 7', 'Wed 8']);
  });

  it('shows a tooltip on hover', () => {
    const { container } = render(<BarSeries title="x" valueLabel="Unclassified" data={days} />);
    fireEvent.mouseEnter(container.querySelectorAll('.chart-bars__hit')[1]);
    expect(container.querySelector('.chart-tooltip')).toHaveTextContent('Tue 7: 5 Unclassified');
  });
});
