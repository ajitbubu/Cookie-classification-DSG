import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import DeepScanModal from '../components/DeepScanModal';

/**
 * Regression guards for the CSS-only accessibility fixes.
 *
 * FINDING-001 (5546fa6) scan-mode tab overflow on mobile (guard moved to LaunchScan/CookieTabs in T14)
 * FINDING-003 (8d64f44) KPI stat-label contrast 2.1:1 -> 5.9:1
 * FINDING-004 (b7d0547) keyboard focus rings app-wide
 *
 * These three live entirely in `src/App.css`. jsdom does not apply external
 * stylesheets, compute the cascade, or evaluate media queries, so there is no
 * honest way to assert the rendered result here — a `getComputedStyle` check
 * would pass whether or not the rule exists.
 *
 * So these are SOURCE guards, not behavior tests. They catch the actual risk:
 * the planned navigation rewrite (E1) deleting or overwriting these rules in
 * App.css. They do NOT prove the styles render correctly in a browser — for
 * that, run /design-review against the live app.
 *
 * The contrast assertion below is the exception: it computes real WCAG ratios
 * from the committed token values, so it is a genuine correctness check.
 */

const APP_CSS = readFileSync(resolve(__dirname, '../App.css'), 'utf8');
const THEMES_CSS = readFileSync(
  resolve(__dirname, '../../design-system/tokens/themes.css'),
  'utf8'
);

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve a custom property from a specific [data-theme] block. */
function tokenFromTheme(css, theme, name) {
  const block = css.split(`[data-theme="${theme}"]`)[1];
  if (!block) throw new Error(`theme ${theme} not found`);
  const body = block.slice(0, block.indexOf('}'));
  const match = body.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`${name} not found in ${theme}`);
  return match[1];
}

describe('FINDING-004 — keyboard focus rings (source guard)', () => {
  it('keeps the app-wide :focus-visible outline rule in App.css', () => {
    // Many components set `outline: none`, which strips the keyboard indicator.
    // This block restores it and must survive any nav/shell rewrite.
    expect(APP_CSS).toMatch(/button:focus-visible/);
    expect(APP_CSS).toMatch(/\[role="menuitem"\]:focus-visible/);
    expect(APP_CSS).toMatch(/outline:\s*2px solid[^;]*!important/);
  });

  it('covers every interactive selector the original fix listed', () => {
    for (const selector of [
      'a:focus-visible',
      'button:focus-visible',
      'input:focus-visible',
      'select:focus-visible',
      'textarea:focus-visible',
      '[tabindex]:focus-visible',
      '[role="button"]:focus-visible',
      '[role="menuitem"]:focus-visible',
    ]) {
      expect(APP_CSS, `missing focus selector: ${selector}`).toContain(selector);
    }
  });
});

// R6 (T14): the Dashboard's .mode-btn tabs and .kpi-tile stats were retired;
// these guards follow the components that took over their jobs.
const css = (rel) => readFileSync(resolve(__dirname, rel), 'utf8');
const mobileBlocks = (text) => text.match(/@media[^{]*max-width:\s*768px[^{]*\{[\s\S]*?\n\}/g) || [];

describe('FINDING-001 — scan controls never overflow on mobile (source guard)', () => {
  it('lets the launch control URL field shrink and wraps its row on phones', () => {
    const launch = css('../components/LaunchScan.css');
    expect(launch).toMatch(/\.launch-scan__input\s*\{[^}]*min-width:\s*0/);
    expect(mobileBlocks(launch).some((b) => /\.launch-scan__row\s*\{[^}]*flex-wrap:\s*wrap/.test(b))).toBe(true);
  });

  it('scrolls the Cookie Classification tab bar inside itself instead of the page', () => {
    expect(css('../components/CookieTabs.css')).toMatch(/\.cookie-tabs__nav\s*\{[^}]*overflow-x:\s*auto/);
  });
});

describe('FINDING-003 — KPI label contrast', () => {
  it('styles KPI labels with the secondary text token, never a light gray', () => {
    const rule = css('../components/ui/KpiCard.css').match(/\.ui-kpi__label\s*\{[^}]*\}/);
    expect(rule, '.ui-kpi__label rule missing').toBeTruthy();
    expect(rule[0]).toMatch(/var\(--color-text-secondary\)/);
    expect(rule[0]).not.toMatch(/--ds-gray-200/);
  });

  it('meets WCAG AA on white with the datasafeguard token', () => {
    const secondary = tokenFromTheme(THEMES_CSS, 'datasafeguard', '--color-text-secondary');
    expect(contrastRatio(secondary, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('44px touch targets on phones and touch screens (R6, extended to the redesign)', () => {
  // Every redesigned stylesheet with interactive controls keeps a 44px minimum
  // inside a phone/touch media query (or at base size).
  it.each([
    'components/LeftSidebar.css',
    'components/CookieTabs.css',
    'components/ui/Button.css',
    'components/ui/MenuButton.css',
    'components/ui/Modal.css',
    'components/ui/Drawer.css',
    'components/ScanForm.css',
    'components/DashboardPage.css',
    'components/DomainDetailsPage.css',
    'components/ReviewQueuePage.css',
    'components/ActiveScanPage.css',
    'components/Navbar.css',
  ])('%s', (rel) => {
    const text = css(`../${rel}`);
    const touchBlocks = text.match(/@media[^{]*(max-width:\s*768px|pointer:\s*coarse)[^{]*\{[\s\S]*?\n\}/g) || [];
    const guarded = touchBlocks.some((b) => /(min-)?height:\s*44px|width:\s*44px/.test(b));
    const atBase = /min-height:\s*44px/.test(text.replace(/@media[\s\S]*?\n\}/g, ''));
    expect(guarded || atBase, `${rel} has no 44px touch-target rule`).toBe(true);
  });
});

describe('FINDING-005 — scan form label/input association', () => {
  // R6: the guarantee survives the redesign; the deep-scan inputs moved from the
  // inline Dashboard form into DeepScanModal (T7), so the guard follows them.
  const jsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return jsxFiles(full);
    return entry.name.endsWith('.jsx') && !entry.name.includes('.test.') ? [full] : [];
  });

  it('pairs every static htmlFor with a matching id in the same file', () => {
    for (const file of jsxFiles(resolve(__dirname, '..'))) {
      const text = readFileSync(file, 'utf8');
      const ids = new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const [, target] of text.matchAll(/htmlFor="([^"]+)"/g)) {
        expect(ids.has(target), `${file}: <label htmlFor="${target}"> has no matching id`).toBe(true);
      }
    }
  });

  it('keeps the deep-scan fields labelled (Figma 12.08.02 fields)', () => {
    render(createElement(DeepScanModal, {
      open: true, initialUrl: '', defaults: { maxPages: 10, maxDepth: 3, concurrency: 20 },
      onStart: () => {}, onClose: () => {},
    }));
    expect(screen.getByLabelText(/Website URL/).tagName).toBe('INPUT');
    for (const name of [/Crawl Mode/, /Crawl Depth/]) {
      expect(screen.getByLabelText(name).tagName).toBe('SELECT');
    }
  });
});

describe('Sentinel token contrast (guards the T1 fix)', () => {
  const SURFACE = '#FFFFFF';
  const INSET = '#F3F6FC';

  it('keeps faceoff-light muted text readable on cards and table headers', () => {
    const muted = tokenFromTheme(THEMES_CSS, 'faceoff-light', '--color-text-muted');
    // .ds-table thead th sits on the inset surface — the tighter of the two.
    expect(contrastRatio(muted, INSET)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps badge text readable on its 16% tint', () => {
    const mix16 = (seed, bg) => {
      const [s, b] = [seed.replace('#', ''), bg.replace('#', '')];
      return (
        '#' +
        [0, 2, 4]
          .map((i) =>
            Math.round(parseInt(s.slice(i, i + 2), 16) * 0.16 + parseInt(b.slice(i, i + 2), 16) * 0.84)
              .toString(16)
              .padStart(2, '0')
          )
          .join('')
      );
    };

    for (const [textToken, seedToken] of [
      ['--color-safe-text', '--color-safe'],
      ['--color-warning-text', '--color-warning'],
      ['--color-critical-text', '--color-critical'],
      ['--color-info-text', '--brand-accent'],
    ]) {
      const text = tokenFromTheme(THEMES_CSS, 'faceoff-light', textToken);
      const seed = tokenFromTheme(THEMES_CSS, 'faceoff-light', seedToken);
      const ratio = contrastRatio(text, mix16(seed, SURFACE));
      expect(ratio, `${textToken} on ${seedToken} tint = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('datasafeguard theme follows the Data Safeguard UCM design system', () => {
  // Source of truth: https://claude.ai/artifact/3wguTnHx69YLGQ3usi6Dun (vendored
  // as src/styles/ucm-tokens.css). User decision 2026-10-12: match the design
  // system exactly, including its documented sub-AA pairs (supersedes 19A).
  const THEME = 'datasafeguard';
  const token = (name) => tokenFromTheme(THEMES_CSS, THEME, name);
  const UCM = readFileSync(resolve(__dirname, '../styles/ucm-tokens.css'), 'utf8');
  const ucm = (name) => UCM.match(new RegExp(`--ucm-${name}:\\s*(#[0-9a-fA-F]{6})`))[1].toUpperCase();
  const INDEX_HTML = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const DESIGN = readFileSync(resolve(__dirname, '../../DESIGN.md'), 'utf8');

  it('is the default theme on <html>', () => {
    expect(INDEX_HTML).toMatch(/<html[^>]*data-theme="datasafeguard"/);
  });

  it('maps the theme onto the UCM tokens', () => {
    const pairs = {
      '--brand-primary': 'brand-accent',
      '--color-primary-text': 'brand-accent',
      '--color-text': 'navy',
      '--color-canvas': 'page',
      '--color-surface': 'surface',
      '--color-border': 'blue-4',
      '--color-border-strong': 'input-border',
      '--color-nav': 'sidebar',
      '--color-safe': 'green-1',
      '--color-safe-text': 'green-2',
      '--color-safe-solid': 'green-2',
      '--color-critical': 'red',
      '--color-critical-text': 'red',
      '--color-warning': 'amber',
      '--color-warning-text': 'amber-ink',
    };
    for (const [themeToken, ucmToken] of Object.entries(pairs)) {
      expect(token(themeToken).toUpperCase(), `${themeToken} -> --ucm-${ucmToken}`).toBe(ucm(ucmToken));
    }
  });

  it('keeps body and secondary text readable (AA) on every surface', () => {
    for (const text of ['--color-text', '--color-text-secondary']) {
      for (const bg of ['--color-surface', '--color-surface-inset', '--color-canvas']) {
        const ratio = contrastRatio(token(text), token(bg));
        expect(ratio, `${text} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('lists every design-system pair below AA as a documented exception in DESIGN.md', () => {
    const exceptions = DESIGN.split('## Contrast exceptions')[1];
    expect(exceptions, 'DESIGN.md needs a "## Contrast exceptions" section').toBeTruthy();
    for (const pair of ['#1CC279', '#E94141', '#148018', '#E1EBF5', '#4879B8', '#FF5757', '#DF7900']) {
      expect(exceptions, pair).toContain(pair);
    }
  });
});
