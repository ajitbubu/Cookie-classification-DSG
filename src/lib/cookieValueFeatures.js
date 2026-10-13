/**
 * Client-side derivation of the model's cookie-value features.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 *
 * The classifier used to receive `value_sample`: the first 50 characters of the
 * raw cookie value. Cookie values routinely carry session tokens and user
 * identifiers, so shipping them to the classification endpoint put credential
 * material on the wire for a product whose job is protecting privacy.
 *
 * The model never needed the text. `_extract_value_features` in
 * `backend/api/ml_classifier/feature_extractor.py` derives exactly three
 * numbers from it, so we compute those here and send them instead. The raw
 * value never leaves the browser.
 *
 * PARITY REQUIREMENT
 * ------------------
 * These must match the Python byte for byte or predictions shift:
 *
 *   len(value)                                      -> valueLength
 *   _contains_uuid(value)  re.search on value.lower() -> valueIsUuid
 *   _is_base64(value)      len>=4, ^[A-Za-z0-9+/]+=*$, len%4==0 -> valueIsBase64
 *
 * Note the features are computed over the SAME 50-character truncation the old
 * payload used. Using the full value would change `value_length` from a value
 * capped at 50 to an unbounded one, which is not the distribution the model was
 * trained on.
 */

/** Matches `feature_extractor.py` `_contains_uuid`. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** Matches `feature_extractor.py` `_is_base64`. */
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

/** The truncation the previous `value_sample` payload applied. */
export const VALUE_SAMPLE_LENGTH = 50;

export function containsUuid(text) {
  return UUID_RE.test(String(text).toLowerCase());
}

export function isBase64(text) {
  const s = String(text);
  if (s.length < 4) return false;
  return BASE64_RE.test(s) && s.length % 4 === 0;
}

/**
 * Derive the value features the classifier needs, without transmitting the value.
 *
 * @param {string|undefined|null} value raw cookie value
 * @returns {{value_length: number, value_is_uuid: boolean, value_is_base64: boolean}}
 */
export function deriveValueFeatures(value) {
  const sample = value ? String(value).substring(0, VALUE_SAMPLE_LENGTH) : '';
  return {
    value_length: sample.length,
    value_is_uuid: containsUuid(sample),
    value_is_base64: isBase64(sample),
  };
}
