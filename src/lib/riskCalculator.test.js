import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { reviewedCategory, reviewedStatistics, reviewedComplianceRisks, scanRisks } from './riskCalculator';
import { dashboardKpis } from './dashboard';
import { websitesFromHistory } from './websites';

const SITE = 'shop.com';
// Stored cookie after the model ran with auto-classification off: the model's
// pick is only a suggestion, so the published category is Unclassified.
const suggested = (name, suggestion, extra = {}) => ({
  name, domain: SITE, category: 'Unclassified', mlClassification: suggestion, isThirdParty: false, ...extra,
});
const approval = (name, approvedCategory, website = SITE) => ({ cookieKey: `${website}:${name}`, name, approvedCategory });
const levels = ({ gdprRisk, ccpaRisk, dpdpRisk }) => [gdprRisk, ccpaRisk, dpdpRisk];

describe('reviewed categories drive risk', () => {
  it('ignores a model suggestion nobody approved', () => {
    const stats = reviewedStatistics([suggested('_fbp', 'Marketing')], SITE, []);
    expect(stats.byCategory).toEqual({ Unclassified: 1 });
    expect(stats.unreviewed).toBe(1);
    expect(stats.requiresConsent).toBe(1);
    expect(levels(reviewedComplianceRisks([suggested('_fbp', 'Marketing')], SITE, []))).toEqual(['MEDIUM', 'LOW', 'MEDIUM']);
  });

  it('raises every regulation to HIGH once a reviewer approves a marketing cookie', () => {
    const risks = reviewedComplianceRisks([suggested('_fbp', 'Marketing')], SITE, [approval('_fbp', 'Marketing')]);
    expect(levels(risks)).toEqual(['HIGH', 'HIGH', 'HIGH']);
    expect(risks.statistics.byCategory).toEqual({ Marketing: 1 });
  });

  it('drops to LOW when the reviewer decides the only cookie is strictly necessary', () => {
    const cookies = [suggested('sessionid', 'Marketing')];
    expect(levels(reviewedComplianceRisks(cookies, SITE, [approval('sessionid', 'Strictly Necessary')]))).toEqual(['LOW', 'LOW', 'LOW']);
  });

  it('lets an approval override a category published earlier', () => {
    const cookies = [{ name: 'lang', domain: SITE, category: 'Marketing' }];
    expect(reviewedCategory(cookies[0], SITE, new Map([[`${SITE}:lang`, approval('lang', 'Functional')]]))).toBe('Functional');
  });

  it('applies an approval only to the website it was made on', () => {
    const stats = reviewedStatistics([suggested('_fbp', 'Marketing')], SITE, [approval('_fbp', 'Marketing', 'other.com')]);
    expect(stats.byCategory).toEqual({ Unclassified: 1 });
  });

  it('maps model label names to the categories the risk rules check', () => {
    const stats = reviewedStatistics(
      [suggested('_ga', 'Analytics'), suggested('ads', 'Marketing')], SITE,
      [approval('_ga', 'Analytics_Performance'), approval('ads', 'Marketing_Advertising')],
    );
    expect(stats.byCategory).toEqual({ Analytics: 1, Marketing: 1 });
  });

  it('counts third parties from the cookies, so backend-shaped statistics cannot hide them', () => {
    // The backend scanner reports thirdPartyCount; the rules read thirdParty.
    const cookies = Array.from({ length: 6 }, (_, i) => suggested(`t${i}`, 'Functional', { isThirdParty: true }));
    const approvals = cookies.map((c) => approval(c.name, 'Functional'));
    const risks = reviewedComplianceRisks(cookies, SITE, approvals);
    expect(risks.statistics.thirdParty).toBe(6);
    expect(risks.ccpaRisk).toBe('HIGH');
  });

  it('is LOW for any set of first-party cookies all approved as strictly necessary', () => {
    fc.assert(fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z_]{1,12}$/), { minLength: 1, maxLength: 30 }), (names) => {
      const cookies = names.map((n) => suggested(n, 'Marketing'));
      const risks = reviewedComplianceRisks(cookies, SITE, names.map((n) => approval(n, 'Strictly Necessary')));
      return levels(risks).every((l) => l === 'LOW');
    }));
  });
});

describe('stored scans are re-scored', () => {
  const stored = (extra = {}) => ({
    id: 's1', domain: SITE, timestamp: '2026-11-10T10:00:00Z', totalCookies: 1, categories: { Unclassified: 1 },
    gdprRisk: 'MEDIUM', ccpaRisk: 'LOW', dpdpRisk: 'MEDIUM',
    fullResults: { cookies: [suggested('_fbp', 'Marketing')] }, ...extra,
  });

  it('replaces the levels saved at scan time once a cookie is approved', () => {
    expect(levels(scanRisks(stored(), [approval('_fbp', 'Marketing')]))).toEqual(['HIGH', 'HIGH', 'HIGH']);
  });

  it('keeps the saved levels for old entries that have no cookies', () => {
    expect(levels(scanRisks(stored({ fullResults: undefined }), [approval('_fbp', 'Marketing')]))).toEqual(['MEDIUM', 'LOW', 'MEDIUM']);
  });

  it('updates the dashboard high-risk count and score from approvals', () => {
    const now = Date.parse('2026-11-12T00:00:00Z');
    const before = dashboardKpis([stored()], now, []);
    const after = dashboardKpis([stored()], now, [approval('_fbp', 'Marketing')]);
    expect(before.highRiskWebsites).toBe(0);
    expect(after.highRiskWebsites).toBe(1);
    expect(after.risk.score).toBeLessThan(before.risk.score);
  });

  it('updates the websites list risk from approvals', () => {
    expect(websitesFromHistory([stored()], {}, [])[0].risk).toBe('MEDIUM');
    expect(websitesFromHistory([stored()], {}, [approval('_fbp', 'Marketing')])[0].risk).toBe('HIGH');
  });
});
