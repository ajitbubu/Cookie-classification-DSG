import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Data-source contract (plan section 7.1, eng R2 / E2). Every panel reads real
 * data: browser-stored scans via src/lib readers and App props, or the ML API.
 * No mock data exists (T12 retired, decision f1197f00).
 */
const ROOT = resolve(__dirname, '../..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const sources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = join(dir, e.name);
  if (e.isDirectory()) return sources(rel);
  return /\.(jsx?|ts)$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
});
const APP = read('src/App.jsx');

describe('data-source contract (7.1)', () => {
  it('ships no mock data module or mock flag', () => {
    const offenders = sources('src').filter((f) => /VITE_ENABLE_MOCK_DATA|mockData|from ['"].*mock/i.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('touches localStorage only in the documented stores', () => {
    const allowed = new Set([
      'src/lib/scanStorage.js',           // this tab's in-progress scan record only
      'src/lib/scanApi.js',               // one-time import of pre-store browser data, then removes it
      'src/components/DashboardPage.jsx', // per-viewer "dismiss AI insights" convenience
      'src/components/OverrideModal.jsx', // legacy override audit log
    ]);
    // src/test/ is test infrastructure (the Node 25 storage shim), not app code.
    const touching = sources('src').filter((f) => !f.startsWith('src/test/') && /localStorage/.test(read(f)));
    expect(touching.filter((f) => !allowed.has(f))).toEqual([]);
  });

  it('loads scans, schedules, publishes and approvals from the scan store (MongoDB), not the browser', () => {
    expect(APP).toMatch(/loadStore\(\)/);
    expect(APP).not.toMatch(/localStorage/);
  });

  it.each([
    ['DashboardPage', 'scanHistory={scanHistory}'],
    ['ScanResultsPage', 'scanHistory={scanHistory}'],
    ['WebsitesPage', 'domainHistory={domainHistory}'],
    ['CookieInventoryPage', 'scanHistory={scanHistory}'],
    ['ReviewQueuePage', 'scanHistory={scanHistory}'],
    ['ActiveScanPage', 'scheduledJobs={scheduledJobs}'],
    ['DomainDetailsPage', 'versions={domainVersions}'],
  ])('%s receives its 7.1 source from App (%s)', (component, prop) => {
    const tag = APP.match(new RegExp(`<${component}\\b[\\s\\S]*?/>`));
    expect(tag, `${component} not rendered in App`).toBeTruthy();
    expect(tag[0]).toContain(prop);
  });

  it('reads model metrics only from the live ML API', () => {
    for (const f of ['src/components/DashboardPage.jsx', 'src/components/ModelPerformancePage.jsx']) {
      expect(read(f), f).toMatch(/\/api\/v1\/ml\/model-info/);
    }
  });
});
