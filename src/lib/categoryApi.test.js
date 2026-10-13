import { describe, it, expect, vi, afterEach } from 'vitest';
import { publishCategory, publishCategories, publishSummary } from './categoryApi';

const respond = (body, ok = true, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

afterEach(() => vi.restoreAllMocks());

const decision = { scanId: 's1', name: '_ga', domain: '.a.com', oldCategory: 'Unclassified', newCategory: 'Analytics' };

describe('publishCategory (E4, eng R4)', () => {
  it('reports published when the knowledge base was updated', async () => {
    respond({ success: true, knowledge_base_updated: true });
    await expect(publishCategory(decision)).resolves.toEqual({ published: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/categories/update-category');
    expect(JSON.parse(init.body)).toEqual({ scan_id: 's1', cookie_name: '_ga', cookie_domain: '.a.com', old_category: 'Unclassified', new_category: 'Analytics' });
  });

  it('reports saved-but-not-published when only the file fallback wrote it', async () => {
    respond({ success: true, knowledge_base_updated: false });
    await expect(publishCategory(decision)).resolves.toEqual({ published: false });
  });

  it('sends categories the API rejects as Unclassified for the old value', async () => {
    respond({ success: true, knowledge_base_updated: true });
    await publishCategory({ ...decision, oldCategory: 'Social Media' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).old_category).toBe('Unclassified');
  });

  it('throws with the status when the request fails', async () => {
    respond({ detail: 'nope' }, false, 422);
    await expect(publishCategory(decision)).rejects.toThrow(/422/);
  });
});

describe('publishCategories (bulk)', () => {
  it('returns how many of the changes reached the knowledge base', async () => {
    respond({ total: 3, successful: 3, failed: 0, persisted: 2, file_fallback: 1, results: [
      { cookie_name: 'a', persisted: true }, { cookie_name: 'b', persisted: false }, { cookie_name: 'c', persisted: true },
    ] });
    await expect(publishCategories([decision, decision, decision])).resolves.toEqual({ total: 3, published: 2, publishedNames: ['a', 'c'] });
    expect(fetch.mock.calls[0][0]).toBe('/api/categories/bulk-update-categories');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toHaveLength(3);
  });
});

describe('publishSummary', () => {
  it('is a plain success when everything published', () => {
    expect(publishSummary({ total: 3, published: 3 })).toEqual({ tone: 'success', text: '3 cookies updated.' });
    expect(publishSummary({ total: 1, published: 1 })).toEqual({ tone: 'success', text: '1 cookie updated.' });
  });

  it('warns with exact counts when some were only saved (2 of 3)', () => {
    expect(publishSummary({ total: 3, published: 2 })).toEqual({
      tone: 'warning', text: '2 of 3 published. 1 saved but not published: the database is unavailable.',
    });
  });

  it('warns when nothing published', () => {
    expect(publishSummary({ total: 2, published: 0 }).text).toBe('Saved, but not published: the database is unavailable.');
  });
});
