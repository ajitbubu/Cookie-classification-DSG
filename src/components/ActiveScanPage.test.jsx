import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActiveScanPage from './ActiveScanPage';

const job = { id: 'j1', url: 'https://shop.com', scanType: 'quick', unit: 'weekly', scheduleDay: 'friday', scheduleTime: '07:30', nextRun: '2026-10-16T07:30:00Z' };

const props = (over = {}) => ({
  running: null, failure: null, completed: null, scheduledJobs: [],
  onCancelRunning: vi.fn(), onRetryScan: vi.fn(), onViewResults: vi.fn(), onDismissCompleted: vi.fn(),
  onCancelJob: vi.fn(), onRescheduleJob: vi.fn(), onTogglePauseJob: vi.fn(), onNewScan: vi.fn(), ...over,
});

describe('ActiveScanPage (5.1 states)', () => {
  it('empty: Figma "No scans on record" (12.08.35)', () => {
    render(<ActiveScanPage {...props()} />);
    expect(screen.getByRole('heading', { name: 'No scans on record' })).toBeInTheDocument();
    expect(screen.getByText('Scan your website to detect and classify all cookies across your domain.')).toBeInTheDocument();
  });

  it('heads the list "Active Scan" with an in-progress count', () => {
    render(<ActiveScanPage {...props({ scheduledJobs: [job], running: { url: 'https://a.com', type: 'deep', progress: null } })} />);
    expect(screen.getByRole('heading', { name: 'Active Scan' })).toBeInTheDocument();
    expect(screen.getByText('2 in progress')).toBeInTheDocument();
  });

  it('loading: three card skeletons (7A)', () => {
    const { container } = render(<ActiveScanPage {...props({ loading: true })} />);
    expect(container.querySelectorAll('.as-card--skeleton')).toHaveLength(3);
  });

  it('error: panel message + Retry (8A)', async () => {
    const onRetry = vi.fn();
    render(<ActiveScanPage {...props({ error: true, onRetry })} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load running scans.");
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('running deep scan: progress and Cancel', async () => {
    const onCancelRunning = vi.fn();
    render(<ActiveScanPage {...props({ onCancelRunning, running: { url: 'https://a.com', type: 'deep', progress: { current: 4, total: 10 } } })} />);
    const card = screen.getByRole('article', { name: 'https://a.com' });
    expect(within(card).getByRole('progressbar', { name: 'Pages scanned' })).toHaveAttribute('aria-valuenow', '40');
    expect(within(card).getByText('40%')).toBeInTheDocument();
    expect(within(card).getByText('4/10 Pages')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel Scan' }));
    expect(onCancelRunning).toHaveBeenCalled();
  });

  it('running quick scan: no Cancel (it cannot be stopped)', () => {
    render(<ActiveScanPage {...props({ running: { url: 'https://a.com', type: 'quick', progress: null } })} />);
    expect(screen.queryByRole('button', { name: 'Cancel Scan' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Pages scanned' })).not.toHaveAttribute('aria-valuenow');
  });

  it('failed scan: red card with the reason and Retry scan (8A)', async () => {
    const onRetryScan = vi.fn();
    render(<ActiveScanPage {...props({ onRetryScan, failure: { url: 'https://a.com', type: 'deep', message: 'Timed out' } })} />);
    const card = screen.getByRole('article', { name: 'https://a.com' });
    expect(card).toHaveClass('as-card--failed');
    expect(within(card).getByText('Scan failed: Timed out')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Retry scan' }));
    expect(onRetryScan).toHaveBeenCalled();
  });

  it('completed: card turns Completed with View results; partial shows its failed count', async () => {
    const onViewResults = vi.fn();
    const completed = { id: 's1', domain: 'a.com', url: 'https://a.com', scanType: 'deep', totalCookies: 12, pagesScanned: 40, failedPages: 3 };
    render(<ActiveScanPage {...props({ onViewResults, completed })} />);
    const card = screen.getByRole('article', { name: 'https://a.com' });
    expect(within(card).getByText('Partial (3 Failed)')).toBeInTheDocument();
    expect(within(card).getByText('12 cookies found')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'View results' }));
    expect(onViewResults).toHaveBeenCalledWith(completed);
  });

  it('scheduled job: schedule, Reschedule and Cancel', async () => {
    const onCancelJob = vi.fn();
    const onRescheduleJob = vi.fn();
    render(<ActiveScanPage {...props({ scheduledJobs: [job], onCancelJob, onRescheduleJob })} />);
    const card = screen.getByRole('article', { name: 'https://shop.com' });
    expect(within(card).getByText('Weekly on Friday at 07:30')).toBeInTheDocument();
    expect(within(card).getByText('Schedule scan')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Reschedule' }));
    expect(onRescheduleJob).toHaveBeenCalledWith(job);
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel Scan' }));
    expect(onCancelJob).toHaveBeenCalledWith('j1');
  });

  it('switches between card and table views', async () => {
    render(<ActiveScanPage {...props({ scheduledJobs: [job], running: { url: 'https://a.com', type: 'quick', progress: null } })} />);
    const tableBtn = screen.getByRole('button', { name: 'Table view' });
    expect(tableBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(tableBtn);
    expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
    const table = screen.getByRole('table', { name: 'Active and scheduled scans' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for https://shop.com' }));
    expect(screen.getByRole('menuitem', { name: 'Reschedule' })).toBeInTheDocument();
  });

  it('cancelled scan: neutral Cancelled card, not a failure', () => {
    render(<ActiveScanPage {...props({ failure: { url: 'https://a.com', type: 'deep', message: 'Scan cancelled', cancelled: true } })} />);
    const card = screen.getByRole('article', { name: 'https://a.com' });
    expect(card).not.toHaveClass('as-card--failed');
    expect(within(card).getByText('Cancelled')).toBeInTheDocument();
    expect(within(card).queryByText(/Scan failed/)).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Run again' })).toBeInTheDocument();
  });

  it('pauses and resumes a scheduled job', async () => {
    const onTogglePauseJob = vi.fn();
    const { rerender } = render(<ActiveScanPage {...props({ scheduledJobs: [job], onTogglePauseJob })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onTogglePauseJob).toHaveBeenCalledWith('j1');
    rerender(<ActiveScanPage {...props({ scheduledJobs: [{ ...job, paused: true }], onTogglePauseJob })} />);
    expect(screen.getByText('Paused')).toHaveClass('ui-chip--neutral');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('puts the Launch New Scan control at the top (27C)', () => {
    render(<ActiveScanPage {...props({ launchControl: <div>launch control</div> })} />);
    expect(screen.getByRole('heading', { name: 'Launch new scan' })).toBeInTheDocument();
    expect(screen.getByText('launch control')).toBeInTheDocument();
  });

  it('pauses and resumes a running deep scan', async () => {
    const onPauseRunning = vi.fn();
    const onResumeRunning = vi.fn();
    const running = { url: 'https://a.com', type: 'deep', progress: { current: 2, total: 10 } };
    const { rerender } = render(<ActiveScanPage {...props({ running, onPauseRunning, onResumeRunning })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause scan' }));
    expect(onPauseRunning).toHaveBeenCalled();
    rerender(<ActiveScanPage {...props({ running: { ...running, paused: true }, onPauseRunning, onResumeRunning })} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume scan' }));
    expect(onResumeRunning).toHaveBeenCalled();
  });

  it('interrupted scan (E5): "Scan of <domain> was interrupted" with Rescan and Dismiss', async () => {
    const onRescanInterrupted = vi.fn();
    const onDismissInterrupted = vi.fn();
    const interrupted = { url: 'https://a.com', domain: 'a.com', type: 'deep', startedAt: '2026-10-12T05:00:00.000Z' };
    render(<ActiveScanPage {...props({ interrupted, onRescanInterrupted, onDismissInterrupted })} />);
    const card = screen.getByRole('article', { name: 'https://a.com' });
    expect(within(card).getByText('Scan of a.com was interrupted')).toBeInTheDocument();
    expect(within(card).getByText('Interrupted')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Rescan' }));
    expect(onRescanInterrupted).toHaveBeenCalledWith(interrupted);
    await userEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(onDismissInterrupted).toHaveBeenCalled();
  });

  it('hides the interrupted card while a new scan runs', () => {
    render(<ActiveScanPage {...props({ interrupted: { url: 'https://a.com', domain: 'a.com', type: 'quick' }, running: { url: 'https://b.com', type: 'quick', progress: null } })} />);
    expect(screen.queryByText(/was interrupted/)).not.toBeInTheDocument();
  });
});
