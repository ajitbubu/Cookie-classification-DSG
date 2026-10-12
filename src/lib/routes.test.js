import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { COOKIE_PAGES, SCANNING_TABS, DOMAIN_TABS, PAGES, breadcrumbFor, moduleTitleFor, navPageFor, pathForRoute, routeFromPath } from './routes';

describe('routes', () => {
  it('gives every page its own path', () => {
    const paths = PAGES.map((page) => pathForRoute(page));
    expect(new Set(paths).size).toBe(PAGES.length);
    expect(pathForRoute('home')).toBe('/');
    expect(pathForRoute('vendors')).toBe('/vendors');
  });

  it('maps the compliance tab of results to /compliance and back', () => {
    expect(pathForRoute('results', 'compliance')).toBe('/compliance');
    expect(routeFromPath('/compliance')).toEqual({ page: 'results', tab: 'compliance' });
    expect(routeFromPath('/results')).toEqual({ page: 'results', tab: 'cookies' });
  });

  it('round-trips every page through its path', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PAGES), (page) => {
        expect(routeFromPath(pathForRoute(page)).page).toBe(page);
      })
    );
  });

  it('tolerates trailing slashes and falls back to home for unknown paths', () => {
    expect(routeFromPath('/vendors/').page).toBe('vendors');
    fc.assert(
      fc.property(fc.string(), (junk) => {
        const route = routeFromPath(`/zz-${junk}`);
        expect(route.page).toBe('home');
      })
    );
  });
});

describe('screen titles and breadcrumbs', () => {
  it('puts every Cookie Classification screen under UCM', () => {
    expect(breadcrumbFor('home')).toEqual(['Cookie Classification', 'Dashboard']);
    expect(breadcrumbFor('history')).toEqual(['Cookie Classification', 'Scanning']);
    expect(breadcrumbFor('launch')).toEqual(['Cookie Classification', 'Scanning']);
    expect(breadcrumbFor('active')).toEqual(['Cookie Classification', 'Scanning']);
    expect(breadcrumbFor('results')).toEqual(['Cookie Classification', 'Scan Result']);
    expect(moduleTitleFor('review')).toBe('Cookie Classification');
  });

  it('puts the ML Model page under Settings', () => {
    expect(breadcrumbFor('model')).toEqual(['Settings', 'ML Model']);
    expect(moduleTitleFor('model')).toBe('Settings');
  });

  it('has a title for every page', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PAGES), (page) => {
        const crumbs = breadcrumbFor(page);
        expect(crumbs.at(-1)).toBeTruthy();
        expect(crumbs.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
      })
    );
  });
});

describe('Figma navigation: sidebar pages, Scanning tabs (1:189760) and settings route (5A)', () => {
  it('gives each page its path', () => {
    expect(pathForRoute('home')).toBe('/');
    expect(pathForRoute('launch')).toBe('/scanning');
    expect(pathForRoute('active')).toBe('/scanning/active');
    expect(pathForRoute('history')).toBe('/scanning/results');
    expect(pathForRoute('websites')).toBe('/websites');
    expect(pathForRoute('inventory')).toBe('/inventory');
    expect(pathForRoute('review')).toBe('/review');
    expect(pathForRoute('model')).toBe('/settings/model');
  });

  it('keeps the old URLs working', () => {
    expect(routeFromPath('/history').page).toBe('history');
    expect(routeFromPath('/model').page).toBe('model');
  });

  it('lists the Cookie Classification sidebar pages in Figma order', () => {
    expect(COOKIE_PAGES.map((t) => t.label)).toEqual(['Dashboard', 'Scanning', 'Website', 'Cookie Inventory', 'Review Queue']);
    expect(COOKIE_PAGES.every((t) => PAGES.includes(t.page))).toBe(true);
  });

  it('lists the three Scanning tabs in Figma order', () => {
    expect(SCANNING_TABS.map((t) => t.label)).toEqual(['Launch New Scan', 'Active Scan', 'Scan Result']);
    expect(SCANNING_TABS.map((t) => t.page)).toEqual(['launch', 'active', 'history']);
  });

  it('highlights Scanning in the sidebar for every scanning screen, including Domain Details', () => {
    for (const page of ['launch', 'active', 'history', 'results']) expect(navPageFor(page)).toBe('launch');
    for (const page of ['home', 'websites', 'inventory', 'review', 'model']) expect(navPageFor(page)).toBe(page);
  });
});

describe('retired pages redirect to their new homes (T14, decisions 4A/5A)', () => {
  it.each([
    ['/scheduled', 'active'],          // schedules are Active Scan cards
    ['/compare', 'history'],           // version diffs live in Domain Details
    ['/auto-publish', 'history'],      // Publish lives in Domain Details
    ['/reports', 'history'],           // "Export report" on Domain Details
    ['/history', 'history'],
    ['/model', 'model'],
  ])('%s -> %s', (path, page) => {
    expect(routeFromPath(path).page).toBe(page);
  });

  it('no longer has pages for the retired screens', () => {
    for (const retired of ['compare', 'publish', 'reports', 'scheduled']) expect(PAGES).not.toContain(retired);
  });
});

describe('Domain Details deep links (E3, eng R3)', () => {
  it('builds /domains/:domain with an optional tab and pinned scan', () => {
    expect(pathForRoute('results', 'overview', { domain: 'shop.com' })).toBe('/domains/shop.com');
    expect(pathForRoute('results', 'cookies', { domain: 'shop.com' })).toBe('/domains/shop.com/cookies');
    expect(pathForRoute('results', 'pages', { domain: 'shop.com', scanId: 'abc 1' })).toBe('/domains/shop.com/pages?scan=abc%201');
  });

  it('parses /domains/:domain[/tab] and ?scan=', () => {
    expect(routeFromPath('/domains/shop.com')).toEqual({ page: 'results', tab: 'overview', domain: 'shop.com', scanId: null });
    expect(routeFromPath('/domains/shop.com/vendors/', '?scan=s1')).toEqual({ page: 'results', tab: 'vendors', domain: 'shop.com', scanId: 's1' });
    expect(routeFromPath('/domains/shop.com/nope').tab).toBe('overview');
  });

  it('keeps the old results URLs unchanged', () => {
    expect(pathForRoute('results', 'cookies')).toBe('/results');
    expect(routeFromPath('/results')).toEqual({ page: 'results', tab: 'cookies' });
  });

  it('round-trips any domain, tab and scan id', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1 }).filter((d) => d.trim() && !d.includes('/')),
      fc.constantFrom(...DOMAIN_TABS),
      fc.option(fc.string({ minLength: 1 }), { nil: null }),
      (domain, tab, scanId) => {
        const url = pathForRoute('results', tab, { domain, scanId });
        const [pathname, query = ''] = url.split('?');
        expect(routeFromPath(pathname, query ? `?${query}` : '')).toEqual({ page: 'results', tab, domain, scanId });
      }
    ));
  });

  it('treats a malformed domain segment as an unknown page, not a crash', () => {
    expect(() => routeFromPath('/domains/%E0%A4%A')).not.toThrow();
  });
});
