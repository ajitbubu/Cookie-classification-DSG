/**
 * Which scan version of each domain is published. Kept in this browser until
 * the backend can store publishes (TODOS.md: backend persistence).
 */
const KEY = 'publishedVersions';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function getPublishedVersion(domain) {
  return readAll()[domain] || null;
}

export function publishVersion(domain, id, publishedAt = new Date().toISOString()) {
  const all = readAll();
  all[domain] = { id, publishedAt };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the publish still applies for this session.
  }
  return all[domain];
}
