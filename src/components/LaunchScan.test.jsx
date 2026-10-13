import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LaunchScan from './LaunchScan';

function Harness(props) {
  const [url, setUrl] = useState(props.initial || '');
  return <LaunchScan value={url} onChange={setUrl} onQuickScan={vi.fn()} onDeepScan={vi.fn()} onScheduleScan={vi.fn()} {...props} />;
}

describe('LaunchScan (decision 27C)', () => {
  it('puts a labelled URL field first, then the scan type menu, then Start Scan', () => {
    render(<Harness />);
    const field = screen.getByLabelText('Website URL');
    const type = screen.getByRole('button', { name: /scan type: quick/i });
    const start = screen.getByRole('button', { name: 'Start Scan' });
    expect(field.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(type.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts a Quick scan on Enter', async () => {
    const onQuickScan = vi.fn();
    render(<Harness onQuickScan={onQuickScan} />);
    await userEvent.type(screen.getByLabelText('Website URL'), 'https://example.com{Enter}');
    expect(onQuickScan).toHaveBeenCalledWith('https://example.com');
  });

  it('starts a Quick scan from the Start Scan button', async () => {
    const onQuickScan = vi.fn();
    render(<Harness initial="https://a.com" onQuickScan={onQuickScan} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start Scan' }));
    expect(onQuickScan).toHaveBeenCalledWith('https://a.com');
  });

  it('keeps the no-URL Quick scan of this page', async () => {
    const onQuickScan = vi.fn();
    render(<Harness onQuickScan={onQuickScan} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start Scan' }));
    expect(onQuickScan).toHaveBeenCalledWith('');
  });

  it('shows an inline error instead of an alert for a bad URL', async () => {
    const onQuickScan = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Harness onQuickScan={onQuickScan} />);
    const field = screen.getByLabelText('Website URL');
    await userEvent.type(field, 'example.com{Enter}');
    expect(onQuickScan).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/https:\/\//);
    await userEvent.type(field, 'x');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
    alertSpy.mockRestore();
  });

  it('opens Deep and Schedule from the type menu with the URL passed through, by keyboard', async () => {
    const onDeepScan = vi.fn();
    const onScheduleScan = vi.fn();
    render(<Harness initial="https://a.com" onDeepScan={onDeepScan} onScheduleScan={onScheduleScan} />);
    screen.getByRole('button', { name: /scan type/i }).focus();
    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(onDeepScan).toHaveBeenCalledWith('https://a.com');
    await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}{Enter}');
    expect(onScheduleScan).toHaveBeenCalledWith('https://a.com');
  });

  it('disables everything while a scan runs', () => {
    render(<Harness scanning />);
    expect(screen.getByLabelText('Website URL')).toBeDisabled();
    expect(screen.getByRole('button', { name: /scanning/i })).toBeDisabled();
  });
});
