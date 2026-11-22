/**
 * The site's own consent-banner declaration as a cookie's suggestion.
 *
 * Scans of OneTrust/Cookiebot sites set `websiteDeclaration` on the cookies the
 * banner covers (backend/scanner/cmp_declarations.py). The site's category becomes
 * the suggestion a reviewer approves; it still goes to review, like a known-cookie
 * match. The model still classifies the cookie, and when it (or a known-cookie
 * list) is confident and disagrees, the cookie is flagged: a site calling a
 * tracking cookie "Necessary" is a compliance finding, not a label to trust.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 */
export const DECLARATION_SOURCE = 'website_declaration';

const NOT_A_CATEGORY = new Set(['', 'Unclassified', 'Uncategorized', 'Unknown']);

/** An enriched cookie with the site's declared category as its suggestion (unchanged when undeclared). */
export function applyWebsiteDeclaration(cookie) {
  const declared = cookie?.websiteDeclaration?.category;
  if (!declared) return cookie;
  const model = {
    category: cookie.mlClassification || null,
    confidence: cookie.mlConfidence ?? null,
    level: cookie.mlConfidenceLevel || null,
    source: cookie.classificationSource || null,
  };
  const conflict = !NOT_A_CATEGORY.has(model.category || '') && model.category !== declared && model.level === 'High';
  return {
    ...cookie,
    mlClassification: declared,
    mlSuggestedClassification: declared,
    mlConfidence: 1,
    mlConfidenceLevel: 'High',
    classificationSource: DECLARATION_SOURCE,
    websiteProvided: true,
    modelSuggestion: model,
    declarationConflict: conflict ? { declared, suggested: model.category, confidence: model.confidence } : null,
  };
}

export function isWebsiteDeclared(cookie) {
  return cookie?.classificationSource === DECLARATION_SOURCE && Boolean(cookie.websiteDeclaration?.category);
}

/** "Declared as Marketing ("Targeting Cookies") in the site's OneTrust banner." */
export function declarationText(cookie) {
  if (!isWebsiteDeclared(cookie)) return null;
  const { category, group, cmp } = cookie.websiteDeclaration;
  const raw = group && group.toLowerCase() !== category.toLowerCase() ? ` ("${group}")` : '';
  return `Declared as ${category}${raw} in the site's ${cmp || 'consent'} banner.`;
}

/** Why a declared cookie was flagged, or null. */
export function declarationConflictText(cookie) {
  const c = cookie?.declarationConflict;
  if (!c) return null;
  const pct = typeof c.confidence === 'number' ? ` (${Math.round((c.confidence > 1 ? c.confidence / 100 : c.confidence) * 100)}%)` : '';
  return `The model suggests ${c.suggested}${pct}, but the site declares ${c.declared}. Check the site's banner.`;
}
