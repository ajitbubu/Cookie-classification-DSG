/**
 * Builds one cookie entry of the POST /api/v1/ml/classify request from a
 * scanned cookie.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 *
 * Scan results carry `expires` (epoch seconds, -1 or absent for session
 * cookies) and keep the scanned host on the scan, not on each cookie. The model
 * was trained on `expiry_days` and `site_domain`, derived the way
 * `backend/scripts/build_production_dataset.py` does it, so both are derived
 * here. Without them every cookie looks like a first-party session cookie.
 */
import { deriveValueFeatures } from './cookieValueFeatures';

const SECONDS_PER_DAY = 86400;

/** Session cookies are 0 days; a persistent cookie is at least 1 (training parity). */
export function expiryDaysFromExpires(expires, nowMs = Date.now()) {
  if (typeof expires !== 'number' || !Number.isFinite(expires) || expires <= 0) return 0;
  const days = Math.max((expires - nowMs / 1000) / SECONDS_PER_DAY, 0);
  return Math.max(1, Math.round(days));
}

export function toClassifyCookie(cookie, siteDomain, nowMs = Date.now()) {
  return {
    id: `${cookie.name}-${cookie.domain}`,
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path || '/',
    expiry_days: cookie.expiry_days ?? expiryDaysFromExpires(cookie.expires, nowMs),
    http_only: cookie.httpOnly || false,
    secure: cookie.secure || false,
    same_site: cookie.sameSite,
    site_domain: cookie.siteDomain || cookie.site_domain || siteDomain,
    // Derived features instead of the raw value. Cookie values carry
    // session tokens; the model only ever needed length/uuid/base64.
    ...valueFeaturesOf(cookie),
  };
}

/** Backend scans send the features and no value; the in-browser Quick Scan still has the value. */
function valueFeaturesOf(cookie) {
  if (typeof cookie.value_length === 'number') {
    return {
      value_length: cookie.value_length,
      value_is_uuid: Boolean(cookie.value_is_uuid),
      value_is_base64: Boolean(cookie.value_is_base64),
    };
  }
  return deriveValueFeatures(cookie.value);
}
