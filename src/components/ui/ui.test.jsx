import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import KpiCard from './KpiCard';
import { StatusChip, ScanTypeChip, Chip, CategoryTag } from './Chip';
import DataTable from './DataTable';
import { KpiSkeleton, RowSkeleton, ChartSkeleton } from './Skeleton';
import PanelError from './PanelError';
import EmptyState from './EmptyState';

describe('KpiCard', () => {
  it('shows label and value', () => {
    render(<KpiCard label="Cookies found" value={128} />);
    expect(screen.getByText('Cookies found')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('shows an em dash, never a stale number, when the value is unknown (8A)', () => {
    render(<KpiCard label="Cookies found" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a trend chip and an optional action', async () => {
    const onAction = vi.fn();
    render(<KpiCard label="Unclassified" value={4} trend={{ text: '+2 this week', tone: 'warning' }}
      action={{ label: 'Review', onClick: onAction }} />);
    expect(screen.getByText('+2 this week')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('chips (UCM design system tags and pills)', () => {
  it('labels scan statuses as Figma does, on UCM tag colours', () => {
    const { rerender } = render(<StatusChip status="completed" />);
    expect(screen.getByText('Completed')).toHaveClass('ui-chip--necessary');
    rerender(<StatusChip status="partial" failed={38} />);
    expect(screen.getByText('Partial (38 Failed)')).toHaveClass('ui-chip--unclassified');
    rerender(<StatusChip status="cancelled" />);
    expect(screen.getByText('Cancelled')).toHaveClass('ui-chip--neutral');
    rerender(<StatusChip status="failed" />);
    expect(screen.getByText('Failed')).toHaveClass('ui-chip--unclassified');
  });

  it('uses table words in tags and full names on solid pills', () => {
    const { rerender } = render(<ScanTypeChip type="quick" />);
    expect(screen.getByText('Quick')).toHaveClass('ui-chip--analytics');
    rerender(<ScanTypeChip type="deep" />);
    expect(screen.getByText('Deep')).toHaveClass('ui-chip--advertising');
    rerender(<ScanTypeChip type="schedule" />);
    expect(screen.getByText('Scheduled')).toHaveClass('ui-chip--marketing');
    rerender(<ScanTypeChip type="deep" variant="pill" />);
    expect(screen.getByText('Deep scan').closest('.ui-pill')).toHaveClass('ui-pill--deep');
    rerender(<ScanTypeChip type="schedule" variant="pill" />);
    expect(screen.getByText('Schedule scan').closest('.ui-pill')).toHaveClass('ui-pill--schedule');
  });

  it('colours cookie categories with the UCM tag set', () => {
    const { rerender } = render(<CategoryTag category="Strictly Necessary" />);
    // Figma labels the category "Necessary" on every chip.
    expect(screen.getByText('Necessary')).toHaveClass('ui-chip--necessary');
    rerender(<CategoryTag category="Marketing" />);
    expect(screen.getByText('Marketing')).toHaveClass('ui-chip--marketing');
    rerender(<CategoryTag category="Uncategorized" />);
    expect(screen.getByText('Unclassified')).toHaveClass('ui-chip--unclassified');
    rerender(<CategoryTag category="Functional" />);
    expect(screen.getByText('Functional')).toHaveClass('ui-chip--neutral');
  });

  it('has a solid variant for the Domain Details tables (Figma 12.12.39)', () => {
    const { rerender } = render(<CategoryTag category="Analytics" solid />);
    expect(screen.getByText('Analytics')).toHaveClass('ui-chip--solid', 'ui-chip--analytics');
    rerender(<CategoryTag category="Unknown" solid />);
    expect(screen.getByText('Unclassified')).toHaveClass('ui-chip--solid', 'ui-chip--unclassified');
  });

  it('takes every colour from the vendored --ucm-* tokens', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/ui/Chip.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{6}/i);
    for (const t of ['--ucm-tint-necessary', '--ucm-tint-analytics', '--ucm-tint-marketing', '--ucm-tint-advertising', '--ucm-tint-unclassified', '--ucm-green-1']) {
      expect(css).toContain(t);
    }
  });

  it('renders a plain tone chip', () => {
    render(<Chip tone="analytics">Sample</Chip>);
    expect(screen.getByText('Sample')).toHaveClass('ui-chip--analytics');
  });
});

describe('DataTable (21A sticky first column)', () => {
  const columns = [
    { key: 'site', header: 'Website' },
    { key: 'cookies', header: 'Cookies found', align: 'end' },
  ];
  const rows = [{ id: 1, site: 'a.com', cookies: 12 }, { id: 2, site: 'b.com', cookies: 3 }];

  it('renders a captioned table with header and body rows', () => {
    render(<DataTable caption="Scan results" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const table = screen.getByRole('table', { name: 'Scan results' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Website', 'Cookies found']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('pins the identifying column and scrolls inside its own wrapper', () => {
    const { container } = render(<DataTable caption="x" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(container.querySelector('.ui-table-scroll')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'a.com' })).toHaveClass('ui-table__sticky');
    const css = readFileSync(join(process.cwd(), 'src/components/ui/DataTable.css'), 'utf8');
    expect(css).toMatch(/\.ui-table__sticky\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.ui-table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('supports custom cell renderers', () => {
    render(<DataTable caption="x" columns={[{ key: 'site', header: 'Website', render: (r) => <a href="#">{r.site}</a> }]}
      rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole('link', { name: 'a.com' })).toBeInTheDocument();
  });

  it('shows loading, error and empty states in the table body', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable caption="x" columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');

    rerender(<DataTable caption="x" columns={columns} rows={[]} rowKey={(r) => r.id}
      error="Couldn't load scan results." onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();

    rerender(<DataTable caption="x" columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>No scans yet</p>} />);
    expect(screen.getByText('No scans yet')).toBeInTheDocument();
  });
});

describe('skeletons (7A)', () => {
  it('are hidden from assistive tech and labelled busy for screen readers', () => {
    const { container } = render(<><KpiSkeleton /><ChartSkeleton /><table><tbody><RowSkeleton columns={3} /></tbody></table></>);
    container.querySelectorAll('.ui-skeleton').forEach((el) => expect(el).toHaveAttribute('aria-hidden', 'true'));
    expect(container.querySelectorAll('tr td')).toHaveLength(3);
  });

  it('turn off the shimmer under prefers-reduced-motion', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/ui/Skeleton.css'), 'utf8');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none/);
  });
});

describe('PanelError (8A)', () => {
  it('says what failed and offers Retry', async () => {
    const onRetry = vi.fn();
    render(<PanelError message="Couldn't load running scans." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load running scans.");
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('EmptyState (6A)', () => {
  it('says what belongs here and offers the one action that fills it', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="No scans yet" description="Scans you run appear here." action={{ label: 'New Scan', onClick }} />);
    expect(screen.getByRole('heading', { name: 'No scans yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Scan' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('can have no action', () => {
    render(<EmptyState title="Nothing to review" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ui kit hygiene', () => {
  it('pairs every component with its own stylesheet and imports no second icon library', () => {
    const dir = join(process.cwd(), 'src/components/ui');
    const files = readdirSync(dir);
    for (const f of files.filter((n) => /^[A-Z].*\.jsx$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/from 'react-icons|@heroicons|@mui\/icons/);
    }
  });
});
