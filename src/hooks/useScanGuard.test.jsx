import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanGuard } from './useScanGuard';

const stored = () => JSON.parse(localStorage.getItem('activeScan') || 'null');
const leave = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useScanGuard (E5)', () => {
  beforeEach(() => localStorage.removeItem('activeScan'));

  it('records the scan at start, warns before leaving, and clears both when it ends', () => {
    const scan = { url: 'https://a.com', type: 'quick' };
    const { rerender } = renderHook(({ scanning }) => useScanGuard(scanning, scan), { initialProps: { scanning: false } });
    expect(stored()).toBeNull();
    expect(leave()).toBe(false);

    rerender({ scanning: true });
    expect(stored()).toMatchObject({ url: 'https://a.com', type: 'quick', domain: 'a.com' });
    expect(leave()).toBe(true);

    rerender({ scanning: false });
    expect(stored()).toBeNull();
    expect(leave()).toBe(false);
  });

  it('does not wipe a leftover record on first load (it is read before effects run)', () => {
    localStorage.setItem('activeScan', JSON.stringify({ url: 'https://b.com', domain: 'b.com', type: 'deep', startedAt: 't' }));
    renderHook(() => useScanGuard(false, null));
    expect(stored()).toMatchObject({ domain: 'b.com' });
  });
});
