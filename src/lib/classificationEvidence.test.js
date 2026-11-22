import { describe, it, expect } from 'vitest';
import { categorySource, heuristicSignals, signalsNote } from './classificationEvidence';

describe('categorySource', () => {
  it("leads with the site's own declaration, and the model's disagreement", () => {
    const cookie = { classificationSource: 'website_declaration', websiteDeclaration: { category: 'Strictly Necessary', group: 'Strictly Necessary Cookies', cmp: 'OneTrust' },
      declarationConflict: { declared: 'Strictly Necessary', suggested: 'Marketing', confidence: 0.92 } };
    expect(categorySource(cookie)).toEqual({
      text: 'Declared as Strictly Necessary ("Strictly Necessary Cookies") in the site\'s OneTrust banner.',
      warning: "The model suggests Marketing (92%), but the site declares Strictly Necessary. Check the site's banner.",
    });
  });

  it('names known-cookie lists, reviewers, patterns and the rule fallback', () => {
    expect(categorySource({ classificationSource: 'known_cookie', knownCookie: { source: 'open_cookie_database', platform: 'Cloudflare' } }).text)
      .toBe('Listed in the Open Cookie Database (Cloudflare).');
    expect(categorySource({ classificationSource: 'user_override' }).text).toBe('A reviewer chose this category.');
    expect(categorySource({ classificationSource: 'pattern_match' }).text).toBe('Matched a stored cookie-name pattern.');
    expect(categorySource({ classificationSource: 'rules_fallback' }).text).toMatch(/^The model was unavailable/);
  });

  it("gives the model's confidence, or why it didn't decide", () => {
    expect(categorySource({ classificationSource: 'ml_prediction', mlConfidence: 0.62, mlConfidenceLevel: 'Medium' }).text)
      .toBe('Model suggestion (62% confidence, Medium).');
    expect(categorySource({ classificationSource: 'ml_prediction', classificationStatus: 'abstained', abstainReason: 'insufficient_evidence' }).text)
      .toBe("The model didn't decide: it had no name or vendor signal. A reviewer needs to choose.");
  });

  it('infers the source for scans saved before it was stored', () => {
    expect(categorySource({ mlConfidence: 0.5 }).text).toBe('Model suggestion (50% confidence).');
    expect(categorySource({ knownCookie: { source: 'iab_gvl', platform: 'Xandr' } }).text).toMatch(/IAB TCF vendor list/);
    expect(categorySource({}).text).toBe('Not recorded for this scan.');
  });
});

describe('heuristicSignals', () => {
  it('marks HttpOnly as weak, and says when only weak signals matched', () => {
    const signals = heuristicSignals({ name: '__cf_bm', httpOnly: true }, 'Strictly Necessary');
    expect(signals).toEqual([{ text: "HttpOnly: page scripts can't read it. Many tracking cookies are HttpOnly too", weak: true }]);
    expect(signalsNote(signals)).toBe("Only weak signals matched: they don't show what this cookie is for.");
  });

  it('lists strong signals first and needs no verdict when one matched', () => {
    const signals = heuristicSignals({ name: 'sessionid', httpOnly: true }, 'Strictly Necessary');
    expect(signals.map((s) => s.weak)).toEqual([false, true]);
    expect(signalsNote(signals)).toBeNull();
  });

  it('says so when nothing matched', () => {
    expect(signalsNote(heuristicSignals({ name: 'x9q' }, 'Functional'))).toBe('No name or vendor signal matched.');
  });
});
