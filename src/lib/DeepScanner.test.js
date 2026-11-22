import { describe, it, expect } from 'vitest';
import { DeepScanner } from './DeepScanner';

describe('DeepScanner.formatBackendResult', () => {
  it("keeps the site's CMP summary and each cookie's declaration", () => {
    const cookie = { name: 'IDE', domain: '.doubleclick.net', category: 'Marketing',
      websiteDeclaration: { category: 'Marketing', group: 'Targeting Cookies', cmp: 'OneTrust' } };
    const cmp = { vendor: 'OneTrust', declared: 368, matched: 9, url: 'https://www.okta.com/' };
    const out = new DeepScanner().formatBackendResult({ domain: 'okta.com', cookies: [cookie], cmp, statistics: {} });
    expect(out.cmp).toEqual(cmp);
    expect(out.cookies[0].websiteDeclaration.cmp).toBe('OneTrust');
    expect(new DeepScanner().formatBackendResult({ cookies: [], statistics: {} }).cmp).toBeNull();
  });
});
