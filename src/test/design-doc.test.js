import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * DESIGN.md is the written design system (plan decision 18A). These guards keep
 * it from drifting away from the shipped datasafeguard theme tokens.
 */

const ROOT = resolve(__dirname, '../..');
const DESIGN = readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8');
const THEMES = readFileSync(resolve(ROOT, 'design-system/tokens/themes.css'), 'utf8');

function themeBlock(theme) {
  const block = THEMES.split(`[data-theme="${theme}"]`)[1];
  return block.slice(0, block.indexOf('}'));
}

function frontMatterColors() {
  const fm = DESIGN.match(/^---\n([\s\S]*?)\n---/);
  expect(fm, 'DESIGN.md needs YAML front matter').toBeTruthy();
  const section = fm[1].split(/\ncolors:\n/)[1].split(/\n\S/)[0];
  return Object.fromEntries(
    [...section.matchAll(/^\s+([a-z-]+):\s*"(#[0-9A-Fa-f]{6})"/gm)].map(([, k, v]) => [k, v.toUpperCase()])
  );
}

describe('DESIGN.md', () => {
  it('documents every colour exactly as the datasafeguard theme ships it', () => {
    const colors = frontMatterColors();
    const block = themeBlock('datasafeguard');
    expect(Object.keys(colors).length).toBeGreaterThanOrEqual(10);
    for (const [name, hex] of Object.entries(colors)) {
      const match = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
      expect(match, `--${name} missing from the datasafeguard theme`).toBeTruthy();
      expect(match[1].toUpperCase(), `--${name}`).toBe(hex);
    }
  });

  it('names the type faces and the brand', () => {
    expect(DESIGN).toMatch(/Inter/);
    expect(DESIGN).toMatch(/Source Sans/);
    expect(DESIGN).toMatch(/datasafeguard/);
  });

  it('marks the old Next.js design-system docs as legacy', () => {
    for (const doc of ['design-system/README.md', 'design-system/PATTERNS.md']) {
      expect(readFileSync(resolve(ROOT, doc), 'utf8').split('\n').slice(0, 8).join('\n'), doc)
        .toMatch(/Legacy/);
    }
  });
});
