import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPublishedVersion, publishVersion } from './publishStore';

describe('publishStore (browser-local until the backend stores publishes)', () => {
  beforeEach(() => localStorage.removeItem('publishedVersions'));

  it('remembers the published version per domain', () => {
    expect(getPublishedVersion('a.com')).toBeNull();
    publishVersion('a.com', 'scan-2', '2026-10-11T10:00:00Z');
    expect(getPublishedVersion('a.com')).toEqual({ id: 'scan-2', publishedAt: '2026-10-11T10:00:00Z' });
    expect(getPublishedVersion('b.com')).toBeNull();
  });

  it('survives storage being unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getPublishedVersion('a.com')).toBeNull();
    spy.mockRestore();
  });
});
