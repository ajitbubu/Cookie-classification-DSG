import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeepScanModal from './DeepScanModal';
import ScheduleScanModal from './ScheduleScanModal';

const defaults = { maxPages: 10, maxDepth: 3, concurrency: 20 };

describe('DeepScanModal (Figma 12.08.02)', () => {
  const setup = (props = {}) => {
    const all = { open: true, initialUrl: 'https://a.com', defaults, onStart: vi.fn(), onClose: vi.fn(), ...props };
    render(<DeepScanModal {...all} />);
    return all;
  };

  it('opens as the Deep Scan dialog with the URL pre-filled and focused', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Deep Scan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configure deep scan' })).toBeInTheDocument();
    const url = screen.getByLabelText(/Website URL/);
    expect(url).toHaveValue('https://a.com');
    expect(url).toHaveFocus();
  });

  it('starts with the chosen crawl mode and depth', async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText(/Crawl Mode/), 'subdomains');
    await userEvent.selectOptions(screen.getByLabelText(/Crawl Depth/), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Start Deep Scan' }));
    expect(p.onStart).toHaveBeenCalledWith({ url: 'https://a.com', maxPages: 500, maxDepth: 3, concurrency: 20, includeSubdomains: true });
  });

  it('checks a single page in "Strict single page check" mode', async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText(/Crawl Mode/), 'single');
    expect(screen.getByLabelText(/Crawl Depth/)).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Start Deep Scan' }));
    expect(p.onStart).toHaveBeenCalledWith(expect.objectContaining({ maxPages: 1, maxDepth: 1, includeSubdomains: false }));
  });

  it('shows the Figma checks: cookies always on, the others not available yet', () => {
    setup();
    const checks = screen.getByRole('group', { name: /Checks/ });
    expect(within(checks).getByRole('checkbox', { name: /Cookies & Tracker/ })).toBeChecked();
    expect(within(checks).getByRole('checkbox', { name: /Cookies & Tracker/ })).toBeDisabled();
    for (const name of [/PII Data flows/, /Consent Banner Audit/, /SDK & Script Inventory/]) {
      const box = within(checks).getByRole('checkbox', { name });
      expect(box).toBeDisabled();
      expect(box).not.toBeChecked();
    }
    expect(within(checks).getAllByText('Not available yet')).toHaveLength(3);
  });

  it('refuses a bad URL with an inline message', async () => {
    const p = setup({ initialUrl: 'a.com' });
    await userEvent.click(screen.getByRole('button', { name: 'Start Deep Scan' }));
    expect(p.onStart).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Website URL/)).toHaveAccessibleDescription(/https:\/\//);
  });

  it('closes on Cancel and on the back arrow', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(p.onClose).toHaveBeenCalledTimes(2);
  });

  it('picks up a new pre-filled URL each time it opens', () => {
    const { rerender } = render(<DeepScanModal open={false} initialUrl="https://a.com" defaults={defaults} onStart={vi.fn()} onClose={vi.fn()} />);
    rerender(<DeepScanModal open initialUrl="https://b.com" defaults={defaults} onStart={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/Website URL/)).toHaveValue('https://b.com');
  });
});

describe('ScheduleScanModal (Figma 12.08.27)', () => {
  const setup = (props = {}) => {
    const all = { open: true, initialUrl: 'https://a.com', onSchedule: vi.fn(), onClose: vi.fn(), ...props };
    render(<ScheduleScanModal {...all} />);
    return all;
  };

  it('opens as the Schedule Scan dialog with the URL pre-filled', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Schedule Scan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Set up schedule' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Website URL/)).toHaveValue('https://a.com');
  });

  it('schedules a weekly homepage scan from the start date, time and frequency', async () => {
    const p = setup();
    await userEvent.clear(screen.getByLabelText('Start Date'));
    await userEvent.type(screen.getByLabelText('Start Date'), '2030-10-18'); // a Friday
    await userEvent.selectOptions(screen.getByLabelText('Frequency'), 'weekly');
    await userEvent.clear(screen.getByLabelText('Run Time'));
    await userEvent.type(screen.getByLabelText('Run Time'), '07:30');
    expect(screen.getByText(/Next Run/).closest('p')).toHaveTextContent('2030');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Scan' }));
    expect(p.onSchedule).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://a.com', scanType: 'quick', unit: 'weekly', day: 'friday', time: '07:30', startDate: '2030-10-18',
    }));
  });

  it('scans key pages up to the page limit', async () => {
    const p = setup();
    expect(screen.getByLabelText(/Page Limit/)).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Key pages' }));
    await userEvent.selectOptions(screen.getByLabelText(/Page Limit/), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Scan' }));
    expect(p.onSchedule).toHaveBeenCalledWith(expect.objectContaining({ scanType: 'deep', maxPages: 50 }));
  });

  it('converts a UTC run time to local time', async () => {
    const p = setup();
    await userEvent.clear(screen.getByLabelText('Start Date'));
    await userEvent.type(screen.getByLabelText('Start Date'), '2030-01-15');
    await userEvent.selectOptions(screen.getByLabelText('Timezone'), 'UTC');
    await userEvent.clear(screen.getByLabelText('Run Time'));
    await userEvent.type(screen.getByLabelText('Run Time'), '02:00');
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Scan' }));
    const instant = new Date(Date.UTC(2030, 0, 15, 2, 0));
    const local = `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`;
    expect(p.onSchedule).toHaveBeenCalledWith(expect.objectContaining({ time: local }));
  });

  it('refuses a bad URL', async () => {
    const p = setup({ initialUrl: '' });
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Scan' }));
    expect(p.onSchedule).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Website URL/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('pre-fills every field when rescheduling an existing job, keeping a minutes interval', async () => {
    const onSchedule = vi.fn();
    const job = { url: 'https://shop.com', scanType: 'deep', unit: 'minutes', interval: 30, scheduleTime: '07:30', maxPages: 100, maxDepth: 2, concurrency: 5 };
    render(<ScheduleScanModal open initial={job} title="Reschedule Scan" submitLabel="Save schedule" onSchedule={onSchedule} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Reschedule Scan' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Website URL/)).toHaveValue('https://shop.com');
    expect(screen.getByRole('radio', { name: 'Key pages' })).toBeChecked();
    expect(screen.getByLabelText(/Page Limit/)).toHaveValue('100');
    expect(screen.getByLabelText('Frequency')).toHaveValue('minutes');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://shop.com', unit: 'minutes', interval: 30, maxPages: 100, maxDepth: 2, concurrency: 5 }));
  });
});
