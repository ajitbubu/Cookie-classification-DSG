import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyWebsiteDeclaration, declarationConflictText, declarationText, isWebsiteDeclared } from './websiteDeclaration';

const declaration = (category, group = 'Targeting Cookies') => ({ category, group, cmp: 'OneTrust', provider: 'doubleclick.net', declaredDuration: '390 days' });
const enriched = (extra = {}) => ({
  name: 'IDE', domain: '.doubleclick.net', category: 'Unclassified', mlClassification: 'Marketing',
  mlConfidence: 0.91, mlConfidenceLevel: 'High', classificationSource: 'ml_prediction', websiteProvided: false, ...extra,
});

describe('applyWebsiteDeclaration', () => {
  it('leaves undeclared cookies (and unmapped site groups) alone', () => {
    const plain = enriched();
    expect(applyWebsiteDeclaration(plain)).toBe(plain);
    const unmapped = enriched({ websiteDeclaration: { ...declaration(null), group: 'Other' } });
    expect(applyWebsiteDeclaration(unmapped)).toBe(unmapped);
  });

  it("makes the site's category the suggestion, keeps the model's answer, and still needs review", () => {
    const out = applyWebsiteDeclaration(enriched({ websiteDeclaration: declaration('Marketing') }));
    expect(out).toMatchObject({
      mlClassification: 'Marketing', classificationSource: 'website_declaration', websiteProvided: true,
      category: 'Unclassified', // not published: a reviewer approves it
      modelSuggestion: { category: 'Marketing', confidence: 0.91, level: 'High', source: 'ml_prediction' },
      declarationConflict: null,
    });
    expect(isWebsiteDeclared(out)).toBe(true);
  });

  it('flags a site label the model confidently disagrees with', () => {
    const out = applyWebsiteDeclaration(enriched({ websiteDeclaration: declaration('Strictly Necessary', 'Strictly Necessary Cookies') }));
    expect(out.mlClassification).toBe('Strictly Necessary');
    expect(out.declarationConflict).toEqual({ declared: 'Strictly Necessary', suggested: 'Marketing', confidence: 0.91 });
    expect(declarationConflictText(out)).toBe('The model suggests Marketing (91%), but the site declares Strictly Necessary. Check the site\'s banner.');
  });

  it('does not flag an unsure or abstaining model', () => {
    for (const extra of [{ mlConfidenceLevel: 'Medium' }, { mlClassification: 'Unclassified' }, { mlClassification: null }]) {
      expect(applyWebsiteDeclaration(enriched({ ...extra, websiteDeclaration: declaration('Analytics') })).declarationConflict).toBeNull();
    }
  });

  it('flags exactly when a High-confidence suggestion names a different category', () => {
    const cats = ['Strictly Necessary', 'Functional', 'Analytics', 'Marketing'];
    fc.assert(fc.property(fc.constantFrom(...cats), fc.constantFrom(...cats), fc.constantFrom('High', 'Medium', 'Low'),
      (declared, model, level) => {
        const out = applyWebsiteDeclaration(enriched({ mlClassification: model, mlConfidenceLevel: level, websiteDeclaration: declaration(declared) }));
        return Boolean(out.declarationConflict) === (model !== declared && level === 'High') && out.mlClassification === declared;
      }));
  });
});

describe('declaration texts', () => {
  it('names the category, the raw group when it differs, and the platform', () => {
    expect(declarationText(applyWebsiteDeclaration(enriched({ websiteDeclaration: declaration('Marketing') }))))
      .toBe('Declared as Marketing ("Targeting Cookies") in the site\'s OneTrust banner.');
    expect(declarationText(applyWebsiteDeclaration(enriched({ websiteDeclaration: { ...declaration('Marketing'), group: 'Marketing', cmp: 'Cookiebot' } }))))
      .toBe("Declared as Marketing in the site's Cookiebot banner.");
    expect(declarationText(enriched())).toBeNull();
  });
});
