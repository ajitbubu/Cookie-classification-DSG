/**
 * Which scan version of each domain is published. Stored in the scan store;
 * App loads it at startup.
 */
import { savePublished } from './scanApi';

let published = {};

export function loadPublishedVersions(map) {
  published = map && typeof map === 'object' ? { ...map } : {};
}

export function getPublishedVersion(domain) {
  return published[domain] || null;
}

/** Save the publish to the store (throws if it can't), then return it. */
export async function publishVersion(domain, id, publishedAt = new Date().toISOString()) {
  const record = { id, publishedAt };
  await savePublished(domain, record);
  published = { ...published, [domain]: record };
  return record;
}
