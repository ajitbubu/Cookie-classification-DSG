import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { scanUrlError } from './scanUrl';

describe('scanUrlError', () => {
  it('accepts http and https URLs', () => {
    expect(scanUrlError('https://example.com')).toBeNull();
    expect(scanUrlError('http://shop.example.com/path?q=1')).toBeNull();
  });

  it('explains what is wrong otherwise', () => {
    expect(scanUrlError('')).toMatch(/enter a website url/i);
    expect(scanUrlError('example.com')).toMatch(/https:\/\//);
    expect(scanUrlError('ftp://example.com')).toMatch(/https:\/\//);
    expect(scanUrlError('javascript:alert(1)')).toMatch(/https:\/\//);
  });

  it('never throws', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const r = scanUrlError(s);
      expect(r === null || typeof r === 'string').toBe(true);
    }));
  });
});
