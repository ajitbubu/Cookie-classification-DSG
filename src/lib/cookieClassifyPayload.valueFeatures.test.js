import { describe, it, expect } from 'vitest';
import { toClassifyCookie } from './cookieClassifyPayload';
import { deriveValueFeatures } from './cookieValueFeatures';

// Backend scans no longer return cookie values (backend/scanner/cookie_values.py);
// they send the model's three value features instead. The in-browser Quick Scan
// still reads document.cookie, so it derives them locally.
const base = { name: '_gh_sess', domain: 'github.com', path: '/' };

describe('toClassifyCookie value features', () => {
  it('uses the features a backend scan sent when there is no value', () => {
    const body = toClassifyCookie({ ...base, value_length: 50, value_is_uuid: false, value_is_base64: true }, 'github.com');
    expect(body).toMatchObject({ value_length: 50, value_is_uuid: false, value_is_base64: true });
    expect(body).not.toHaveProperty('value');
  });

  it('derives them from the value for in-browser scans', () => {
    const body = toClassifyCookie({ ...base, value: 'dGVzdA==' }, 'github.com');
    expect(body).toMatchObject(deriveValueFeatures('dGVzdA=='));
    expect(body).not.toHaveProperty('value');
  });

  it('treats a stored scan with neither as an empty value', () => {
    expect(toClassifyCookie(base, 'github.com')).toMatchObject({ value_length: 0, value_is_uuid: false, value_is_base64: false });
  });
});
