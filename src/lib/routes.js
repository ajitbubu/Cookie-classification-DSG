/**
 * URL <-> page mapping for the single-page app. Framework-free so it can be
 * unit tested; App.jsx owns the history.pushState / popstate wiring.
 */

const PAGE_PATHS = {
  home: '/',
  launch: '/scanning',
  active: '/scanning/active',
  results: '/results',
  history: '/scanning/results',
  review: '/review',
  vendors: '/vendors',
  websites: '/websites',
  inventory: '/inventory',
  model: '/settings/model',
};

// Paths from before the UCM redesign keep working; retired screens open the
// page that took over their job (decisions 4A, 5A).
const LEGACY_PATHS = {
  '/history': 'history',
  '/model': 'model',
  '/scheduled': 'active',
  '/compare': 'history',
  '/auto-publish': 'history',
  '/reports': 'history',
};

// Cookie Classification pages in the sidebar, in Figma order (1:189760).
export const COOKIE_PAGES = [
  { page: 'home', label: 'Dashboard' },
  { page: 'launch', label: 'Scanning' },
  { page: 'websites', label: 'Website' },
  { page: 'inventory', label: 'Cookie Inventory' },
  { page: 'review', label: 'Review Queue' },
];

// Tabs inside the Scanning page (Figma 1:189760).
export const SCANNING_TABS = [
  { page: 'launch', label: 'Launch New Scan' },
  { page: 'active', label: 'Active Scan' },
  { page: 'history', label: 'Scan Result' },
];

const SCANNING_PAGES = new Set(['launch', 'active', 'history', 'results']);

/** The sidebar entry that is current for a page: scanning screens, Domain Details included, sit under Scanning. */
export function navPageFor(page) {
  return SCANNING_PAGES.has(page) ? 'launch' : page;
}

// The Compliance nav item is the compliance tab of the results page.
const COMPLIANCE_PATH = '/compliance';

export const PAGES = Object.keys(PAGE_PATHS);

// Domain Details tabs, addressable as /domains/:domain/<tab> (E3, eng R3).
export const DOMAIN_TABS = ['overview', 'cookies', 'categories', 'pages', 'vendors'];
const DOMAIN_PATH = /^\/domains\/([^/]+)(?:\/([^/]+))?$/;

export function pathForRoute(page, tab, { domain, scanId } = {}) {
  if (page === 'results' && domain) {
    const tabPart = tab && tab !== 'overview' && DOMAIN_TABS.includes(tab) ? `/${tab}` : '';
    const query = scanId ? `?scan=${encodeURIComponent(scanId)}` : '';
    return `/domains/${encodeURIComponent(domain)}${tabPart}${query}`;
  }
  if (page === 'results' && tab === 'compliance') return COMPLIANCE_PATH;
  return PAGE_PATHS[page] || '/';
}

// Screen names for the breadcrumb (Figma: Cookie Classification / <page>;
// the three Scanning tabs share "Scanning"; ML Model lives under Settings).
const SCREEN_TITLES = {
  home: 'Dashboard',
  launch: 'Scanning',
  active: 'Scanning',
  results: 'Scan Result',
  history: 'Scanning',
  review: 'Review Queue',
  vendors: 'Vendors',
  websites: 'Websites',
  inventory: 'Cookie Inventory',
  model: 'ML Model',
};

const SETTINGS_PAGES = new Set(['model']);

export function moduleTitleFor(page) {
  return SETTINGS_PAGES.has(page) ? 'Settings' : 'Cookie Classification';
}

export function breadcrumbFor(page) {
  const title = SCREEN_TITLES[page] || SCREEN_TITLES.home;
  return SETTINGS_PAGES.has(page) ? ['Settings', title] : ['Cookie Classification', title]; // Figma: no module prefix
}

export function routeFromPath(pathname, search = '') {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const domainMatch = path.match(DOMAIN_PATH);
  if (domainMatch) {
    try {
      const domain = decodeURIComponent(domainMatch[1]);
      const tab = DOMAIN_TABS.includes(domainMatch[2]) ? domainMatch[2] : 'overview';
      return { page: 'results', tab, domain, scanId: new URLSearchParams(search).get('scan') };
    } catch {
      return { page: 'home', tab: 'cookies' };
    }
  }
  if (path === COMPLIANCE_PATH) return { page: 'results', tab: 'compliance' };
  const page = PAGES.find((candidate) => PAGE_PATHS[candidate] === path) || LEGACY_PATHS[path] || 'home';
  return { page, tab: 'cookies' };
}
