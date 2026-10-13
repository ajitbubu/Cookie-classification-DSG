import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPublishedVersion, loadPublishedVersions, publishVersion } from './publishStore';

describe('publishStore (backed by the scan store)', () => {
  beforeEach(() => loadPublishedVersions({}));
  afterEach(() => vi.restoreAllMocks());

  it('remembers the published version per domain once the store saved it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    expect(getPublishedVersion('a.com')).toBeNull();
    await publishVersion('a.com', 'scan-2', '2026-10-11T10:00:00Z');
    expect(getPublishedVersion('a.com')).toEqual({ id: 'scan-2', publishedAt: '2026-10-11T10:00:00Z' });
    expect(getPublishedVersion('b.com')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/store/published/a.com', expect.objectContaining({ method: 'PUT' }));
  });

  it('does not change the published version when the store rejects the save', async () => {
    loadPublishedVersions({ 'a.com': { id: 'scan-1', publishedAt: null } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(publishVersion('a.com', 'scan-2')).rejects.toThrow('503');
    expect(getPublishedVersion('a.com')).toEqual({ id: 'scan-1', publishedAt: null });
  });
});
