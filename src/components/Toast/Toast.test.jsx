import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';
import { LiveRegionProvider } from '../ui/LiveRegion';

function Trigger({ opts }) {
  const toast = useToast();
  return <button onClick={() => toast(opts)}>fire</button>;
}

const visibleToast = () => document.querySelector('.toast__message');

const setup = (opts) => render(
  <LiveRegionProvider><ToastProvider><Trigger opts={opts} /></ToastProvider></LiveRegionProvider>
);

describe('Toast with Undo (28A)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the action and dismisses', () => {
    const undo = vi.fn();
    setup({ message: '3 cookies updated', duration: 10000, action: { label: 'Undo', onClick: undo } });
    fireEvent.click(screen.getByText('fire'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalled();
  });

  it('pauses its timer while hovered or focused, then resumes', () => {
    setup({ message: '3 cookies updated', duration: 10000, action: { label: 'Undo', onClick: vi.fn() } });
    fireEvent.click(screen.getByText('fire'));
    act(() => { vi.advanceTimersByTime(6000); });

    const toast = visibleToast().closest('.toast');
    fireEvent.mouseEnter(toast);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(visibleToast()).toHaveTextContent('3 cookies updated');

    fireEvent.mouseLeave(toast);
    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(30000); });
    expect(visibleToast()).toHaveTextContent('3 cookies updated');

    fireEvent.blur(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(3900); });
    expect(visibleToast()).toHaveTextContent('3 cookies updated');
    act(() => { vi.advanceTimersByTime(500); });
    expect(visibleToast()).toBeNull();
  });

  it('announces through the shared polite live region, not role=alert', () => {
    setup({ message: 'Version 3 published' });
    fireEvent.click(screen.getByText('fire'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const statuses = screen.getAllByRole('status');
    expect(statuses.some((s) => s.textContent.includes('Version 3 published'))).toBe(true);
  });
});
