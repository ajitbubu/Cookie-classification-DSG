import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScanTypeModal from './ScanTypeModal';

describe('ScanTypeModal (Figma 12.07.06 "Launch New Scan")', () => {
  const setup = (props = {}) => {
    const all = { open: true, initialUrl: '', onClose: vi.fn(), onContinue: vi.fn(), onQuickScan: vi.fn(), ...props };
    render(<ScanTypeModal {...all} />);
    return all;
  };

  it('offers Quick, Deep and Schedule Scan as cards, none chosen yet', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Launch New Scan' })).toBeInTheDocument();
    expect(screen.getByText('Pick the right scan for your use case.')).toBeInTheDocument();
    for (const name of [/Quick Scan/, /Deep Scan/, /Schedule Scan/]) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked();
    }
    expect(screen.getByText('Fast')).toBeInTheDocument();
    expect(screen.getByText('Thorough')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('continues with Deep or Schedule Scan', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Deep Scan/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(p.onContinue).toHaveBeenCalledWith('deep');
  });

  it('Quick Scan opens the Quick Scan URL panel in place of Cancel / Continue', async () => {
    setup({ initialUrl: 'https://shop.com' });
    await userEvent.click(screen.getByRole('radio', { name: /Quick Scan/ }));
    expect(screen.getByLabelText('Quick Scan URL')).toHaveValue('https://shop.com');
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('runs the Quick Scan from the pop-up', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Quick Scan/ }));
    await userEvent.type(screen.getByLabelText('Quick Scan URL'), 'https://shop.com');
    await userEvent.click(screen.getByRole('button', { name: 'Run Quick Scan' }));
    expect(p.onQuickScan).toHaveBeenCalledWith('https://shop.com');
  });

  it('says what is wrong with the URL instead of starting', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Quick Scan/ }));
    await userEvent.type(screen.getByLabelText('Quick Scan URL'), 'shop');
    await userEvent.click(screen.getByRole('button', { name: 'Run Quick Scan' }));
    expect(screen.getByText(/full URL starting with https/)).toBeInTheDocument();
    expect(p.onQuickScan).not.toHaveBeenCalled();
  });

  it('cancels without choosing', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onContinue).not.toHaveBeenCalled();
  });
});
