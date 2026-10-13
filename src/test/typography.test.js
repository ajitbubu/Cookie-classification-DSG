import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Source guards for plan decisions 16A (two faces) and 17A (Figma type scale).
 * jsdom does not compute styles, so these check the committed CSS/HTML.
 */

const ROOT = resolve(__dirname, '../..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function cssSources(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return cssSources(rel);
    return /\.(css|jsx)$/.test(entry.name) ? [[rel, read(rel)]] : [];
  });
}

describe('type faces (16A)', () => {
  it('loads Source Sans Pro alongside Inter and JetBrains Mono', () => {
    const html = read('index.html');
    expect(html).toMatch(/family=Inter/);
    expect(html).toMatch(/family=Source\+Sans\+3|family=Source\+Sans\+Pro/);
    expect(html).toMatch(/family=JetBrains\+Mono/);
  });

  it('maps content to Larsseit (Inter fallback), titles to Inter and the sidebar to Source Sans (UCM design system)', () => {
    const bridge = read('src/styles/design-system.css');
    expect(bridge).toMatch(/--font-sans:\s*['"]Larsseit['"],\s*['"]Inter['"]/);
    expect(bridge).toMatch(/--font-nav:\s*['"]Source Sans 3['"]/);
    expect(bridge).toMatch(/--font-display:\s*var\(--font-inter/);
    expect(bridge).toMatch(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6[^{]*\{[^}]*font-family:\s*var\(--font-display\)/);
  });
});

describe('display vs body split (16A)', () => {
  it('keeps headings and KPI values on the display face', () => {
    const app = read('src/App.css');
    for (const selector of ['.slim-hero__title', '.kpi-tile__value']) {
      const block = app.slice(app.indexOf(`${selector} {`));
      const body = block.slice(0, block.indexOf('}'));
      expect(body, selector).toMatch(/font-family:\s*var\(--font-display\)/);
    }
  });
});

describe('one <h1> per page (17A)', () => {
  it('leaves the top-bar title as the only page-level <h1>', () => {
    const offenders = cssSources('src')
      .filter(([path]) => path.endsWith('.jsx') && !path.endsWith('Navbar.jsx') && !path.includes('.test.'))
      .flatMap(([path, text]) => [...text.matchAll(/<h1 className="([^"]+)"/g)]
        .filter(([, cls]) => cls !== 'rp-policy-h1')
        .map(([, cls]) => `${path}: ${cls}`));
    expect(offenders).toEqual([]);
  });
});

describe('type scale (17A)', () => {
  it('retires the 30px/24px page-title sizes from app pages', () => {
    const offenders = cssSources('src')
      .filter(([, text]) => /var\(--fs-h[12]\)/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
