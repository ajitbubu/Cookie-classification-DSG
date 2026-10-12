import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  deriveValueFeatures,
  containsUuid,
  isBase64,
  VALUE_SAMPLE_LENGTH,
} from './cookieValueFeatures';

/**
 * Parity tests for the client-side value features (T5 / decision T5-A).
 *
 * The browser now derives what `_extract_value_features` used to compute from
 * the raw `value_sample`, so cookie values never leave the page. If this logic
 * drifts from `backend/api/ml_classifier/feature_extractor.py`, the model
 * silently receives different features and predictions shift with no error.
 *
 * Python reference:
 *   _contains_uuid: re.search(
 *       r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
 *       text.lower())
 *   _is_base64:     len(text) >= 4
 *                   and re.match(r'^[A-Za-z0-9+/]+=*$', text)
 *                   and len(text) % 4 == 0
 *   value_length:   len(text)
 */

describe('containsUuid — parity with _contains_uuid', () => {
  it('matches a canonical lowercase UUID', () => {
    expect(containsUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('is case-insensitive, because Python lowercases first', () => {
    expect(containsUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('matches a UUID embedded in a larger value (re.search, not re.match)', () => {
    expect(containsUuid('GA1.2.550e8400-e29b-41d4-a716-446655440000.17')).toBe(true);
  });

  it('rejects a malformed UUID', () => {
    expect(containsUuid('550e8400-e29b-41d4-a716-44665544')).toBe(false);
    expect(containsUuid('not-a-uuid-at-all')).toBe(false);
  });

  it('rejects non-hex characters in UUID positions', () => {
    expect(containsUuid('zzzzzzzz-e29b-41d4-a716-446655440000')).toBe(false);
  });
});

describe('isBase64 — parity with _is_base64', () => {
  it('requires at least 4 characters', () => {
    expect(isBase64('abc')).toBe(false);
    expect(isBase64('abcd')).toBe(true);
  });

  it('requires length divisible by 4', () => {
    expect(isBase64('abcde')).toBe(false);
    expect(isBase64('abcdefgh')).toBe(true);
  });

  it('accepts padding', () => {
    expect(isBase64('YWJjZA==')).toBe(true);
  });

  it('rejects characters outside the base64 alphabet', () => {
    expect(isBase64('abc-defg')).toBe(false);
    expect(isBase64('abc defg')).toBe(false);
    expect(isBase64('abc.defg')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isBase64('')).toBe(false);
  });
});

describe('deriveValueFeatures', () => {
  it('never returns the raw value', () => {
    const secret = 'session=super-secret-token-value-do-not-leak';
    const derived = deriveValueFeatures(secret);

    expect(Object.values(derived).join(' ')).not.toContain('secret');
    expect(Object.keys(derived).sort()).toEqual([
      'value_is_base64',
      'value_is_uuid',
      'value_length',
    ]);
  });

  it('measures the 50-char sample, not the full value', () => {
    // The old payload sent value.substring(0, 50), so value_length was capped
    // at 50. Reporting the true length would change the feature distribution.
    const long = 'x'.repeat(500);
    expect(deriveValueFeatures(long).value_length).toBe(VALUE_SAMPLE_LENGTH);
  });

  it('treats missing values as empty, matching the Python None branch', () => {
    for (const empty of [undefined, null, '']) {
      expect(deriveValueFeatures(empty)).toEqual({
        value_length: 0,
        value_is_uuid: false,
        value_is_base64: false,
      });
    }
  });

  it('derives from the truncated sample for uuid and base64 too', () => {
    // A UUID that starts after char 50 must NOT be detected, because the old
    // code only ever saw the first 50 characters.
    const padded = 'y'.repeat(60) + '550e8400-e29b-41d4-a716-446655440000';
    expect(deriveValueFeatures(padded).value_is_uuid).toBe(false);
  });

  it('produces types the backend can cast with float()', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const d = deriveValueFeatures(value);
        expect(Number.isInteger(d.value_length)).toBe(true);
        expect(d.value_length).toBeGreaterThanOrEqual(0);
        expect(d.value_length).toBeLessThanOrEqual(VALUE_SAMPLE_LENGTH);
        expect(typeof d.value_is_uuid).toBe('boolean');
        expect(typeof d.value_is_base64).toBe('boolean');
      })
    );
  });
});
