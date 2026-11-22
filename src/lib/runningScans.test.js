import { describe, it, expect } from 'vitest';
import { scanKey, withCompleted } from './runningScans';

describe('scanKey', () => {
  it('treats URLs of one website as the same scan', () => {
    for (const url of ['https://www.att.com/deals', 'att.com', 'HTTP://ATT.com/', ' www.att.com ']) expect(scanKey(url)).toBe('att.com');
    expect(scanKey('https://xfinity.com')).toBe('xfinity.com');
    expect(scanKey('https://shop.att.com')).toBe('shop.att.com'); // a subdomain is its own website
  });
});

describe('withCompleted', () => {
  it('keeps the newest finished scan per website, newest first, capped', () => {
    const done = (id, domain) => ({ id, domain, url: `https://${domain}` });
    let list = [];
    for (const [id, d] of [['1', 'a.com'], ['2', 'b.com'], ['3', 'a.com']]) list = withCompleted(list, done(id, d));
    expect(list.map((s) => s.id)).toEqual(['3', '2']);
    for (let i = 0; i < 10; i += 1) list = withCompleted(list, done(`x${i}`, `s${i}.com`));
    expect(list).toHaveLength(5);
  });
});
