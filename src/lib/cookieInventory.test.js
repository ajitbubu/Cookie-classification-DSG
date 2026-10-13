import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildInventory } from './cookieInventory';

const scan = (domain, timestamp, cookies) => ({ domain, timestamp, fullResults: { cookies } });

describe('buildInventory', () => {
  it('lists each cookie once with its latest category and every site it was seen on', () => {
    const history = [
      scan('b.com', '2026-10-11T10:00:00.000Z', [{ name: '_ga', domain: '.b.com', category: 'Analytics' }]),
      scan('a.com', '2026-10-10T10:00:00.000Z', [
        { name: '_ga', domain: '.b.com', category: 'Unclassified' },
        { name: 'sid', domain: 'a.com', category: 'Strictly Necessary' },
      ]),
    ];

    const inventory = buildInventory(history);

    expect(inventory).toHaveLength(2);
    const ga = inventory.find((c) => c.name === '_ga');
    expect(ga.category).toBe('Analytics');
    expect(ga.sites).toEqual(['a.com', 'b.com']);
    expect(ga.lastSeen).toBe('2026-10-11T10:00:00.000Z');
    expect(ga.sourceFailedPages).toBe(0);
  });

  it('skips scans whose details were trimmed from storage', () => {
    expect(buildInventory([{ domain: 'a.com', timestamp: 't', fullResults: undefined }])).toEqual([]);
  });

  it('never lists the same name+domain twice', () => {
    const cookie = fc.record({
      name: fc.constantFrom('_ga', 'sid', 'csrf'),
      domain: fc.constantFrom('a.com', 'b.com'),
      category: fc.constantFrom('Analytics', 'Functional'),
    });
    fc.assert(
      fc.property(fc.array(fc.array(cookie, { maxLength: 5 }), { maxLength: 6 }), (scans) => {
        const inventory = buildInventory(scans.map((c, i) => scan(`s${i}.com`, `2026-10-0${(i % 9) + 1}`, c)));
        const keys = inventory.map((c) => `${c.name}|${c.domain}`);
        expect(new Set(keys).size).toBe(keys.length);
      })
    );
  });
});
