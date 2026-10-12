/**
 * Validation for scan target URLs. Returns a message for the user, or null
 * when the URL can be scanned. Framework-free.
 */
export function scanUrlError(value) {
  const text = (value || '').trim();
  if (!text) return 'Enter a website URL to scan.';
  let url;
  try {
    url = new URL(text);
  } catch {
    return 'Enter a full URL starting with https:// (for example https://example.com).';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Enter a full URL starting with https:// (for example https://example.com).';
  }
  return null;
}
