/**
 * Publishing human category decisions (eng R1/R4, E4). The API answers
 * success even when only its file fallback saved the change; whether the
 * decision is actually published is `knowledge_base_updated` (single) or
 * `persisted` (bulk). Callers must show "not published" when it is false.
 */
const ACCEPTED = new Set(['Strictly Necessary', 'Functional', 'Analytics', 'Marketing', 'Uncategorized', 'Unclassified', 'Unknown']);
const accepted = (category) => (ACCEPTED.has(category) ? category : 'Unclassified');

const toRequest = ({ scanId, name, domain, oldCategory, newCategory }) => ({
  scan_id: scanId,
  cookie_name: name,
  cookie_domain: domain,
  old_category: accepted(oldCategory),
  new_category: newCategory,
});

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function publishCategory(decision) {
  const data = await post('/api/categories/update-category', toRequest(decision));
  return { published: data.knowledge_base_updated === true };
}

export async function publishCategories(decisions) {
  const data = await post('/api/categories/bulk-update-categories', decisions.map(toRequest));
  return {
    total: data.total ?? decisions.length,
    published: data.persisted ?? 0,
    publishedNames: (data.results || []).filter((r) => r.persisted).map((r) => r.cookie_name),
  };
}

// One wording for every caller (decision 10A success copy, R4 warning copy).
export function publishSummary({ total, published }) {
  if (published >= total) return { tone: 'success', text: `${total} cookie${total === 1 ? '' : 's'} updated.` };
  if (published === 0) return { tone: 'warning', text: 'Saved, but not published: the database is unavailable.' };
  const left = total - published;
  return { tone: 'warning', text: `${published} of ${total} published. ${left} saved but not published: the database is unavailable.` };
}
