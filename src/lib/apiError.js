/**
 * The message to show for a failed API response: FastAPI's `detail` string when
 * there is one (e.g. "Scanning is unavailable: the scan egress proxy can't be
 * reached."), else the status text.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 */
export async function responseErrorMessage(response, prefix = '') {
  let detail = null;
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string' && body.detail.trim()) detail = body.detail.trim();
  } catch {
    // not JSON (proxy error page, empty body): fall back to the status
  }
  return detail || `${prefix}${response.status} ${response.statusText || ''}`.trim();
}
