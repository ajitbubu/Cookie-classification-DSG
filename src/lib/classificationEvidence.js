/**
 * What the cookie detail card says about a category: where it came from first,
 * then simple checks on the cookie's name and flags, with weak ones marked.
 *
 * The heuristics are not the model's reasoning. Flags like HttpOnly describe how
 * a cookie is protected, not what it is for (Cloudflare's __cf_bm and many ad IDs
 * are HttpOnly), so they are labelled weak and never shown as the reason alone.
 *
 * Framework-free per the `src/lib/` convention — no React imports.
 */
import { knownCookieText } from './reviewQueue';
import { declarationConflictText, declarationText } from './websiteDeclaration';

const ABSTAIN_REASONS = {
  insufficient_evidence: 'it had no name or vendor signal',
  low_confidence: 'its confidence was below the threshold',
  model_unclassified: 'it predicted Unclassified',
};

const percent = (value) => Math.round((value > 1 ? value / 100 : value) * 100);

/**
 * Where the category came from: { text, warning? }. Scans saved before
 * 2026-11-21 don't store classificationSource, so it is inferred when missing.
 */
export function categorySource(cookie = {}) {
  const source = cookie.classificationSource
    || (cookie.websiteDeclaration?.category ? 'website_declaration' : null)
    || (cookie.knownCookie ? 'known_cookie' : null)
    || (typeof cookie.mlConfidence === 'number' ? 'ml_prediction' : null);

  switch (source) {
    case 'website_declaration':
      return { text: declarationText({ ...cookie, classificationSource: source }), warning: declarationConflictText(cookie) };
    case 'known_cookie':
      return { text: knownCookieText(cookie) || 'Listed in a known-cookie list.' };
    case 'user_override':
      return { text: 'A reviewer chose this category.' };
    case 'pattern_match':
      return { text: 'Matched a stored cookie-name pattern.' };
    case 'rules_fallback':
      return { text: "The model was unavailable, so the rule engine picked this from the cookie's name." };
    case 'ml_prediction': {
      if (cookie.classificationStatus === 'abstained' || cookie.abstainReason) {
        const why = ABSTAIN_REASONS[cookie.abstainReason] || 'it was not confident enough';
        return { text: `The model didn't decide: ${why}. A reviewer needs to choose.` };
      }
      const level = cookie.mlConfidenceLevel ? `, ${cookie.mlConfidenceLevel}` : '';
      return { text: `Model suggestion (${percent(cookie.mlConfidence ?? 0)}% confidence${level}).` };
    }
    default:
      return { text: 'Not recorded for this scan.' };
  }
}

/** Name, vendor and flag checks consistent with `category`; weak ones are marked. */
export function heuristicSignals(cookie = {}, category = cookie.mlClassification || cookie.category) {
  const name = (cookie.name || '').toLowerCase();
  const domain = (cookie.domain || '').toLowerCase();
  const signals = [];
  const strong = (text) => signals.push({ text, weak: false });
  const weak = (text) => signals.push({ text, weak: true });

  if (category === 'Analytics') {
    if (name.includes('_ga') || name.includes('_gid') || name.includes('_gat')) strong(`Name matches a known analytics pattern ("${cookie.name}")`);
    if (domain.includes('google')) strong('Set by a Google domain');
    if (domain.includes('analytics') || name.includes('analytics')) strong('Name or domain contains "analytics"');
    if (cookie.expiry_days && cookie.expiry_days > 300) weak(`Long expiry (${cookie.expiry_days} days)`);
    if (cookie.isThirdParty === false) weak('First-party cookie');
  } else if (category === 'Marketing') {
    if (name.includes('_fb') || name.includes('fbp') || name.includes('fbc')) strong('Name matches a Facebook tracking pattern');
    if (domain.includes('facebook') || domain.includes('doubleclick') || domain.includes('google')) strong(`Set by a known advertising vendor (${cookie.domain})`);
    if (name.includes('ads') || name.includes('click') || name.includes('track')) strong('Name contains an advertising word');
    if (cookie.isThirdParty) weak('Third-party cookie');
  } else if (category === 'Strictly Necessary') {
    if (name.includes('session') || name.includes('sess')) strong('Name suggests session management');
    if (name.includes('csrf') || name.includes('xsrf')) strong('Name suggests a CSRF protection token');
    if (name.includes('auth') || name.includes('token')) strong('Name suggests authentication');
    if (cookie.httpOnly) weak("HttpOnly: page scripts can't read it. Many tracking cookies are HttpOnly too");
  } else if (category === 'Functional') {
    if (name.includes('pref') || name.includes('lang') || name.includes('locale')) strong('Name suggests a stored preference');
    if (name.includes('theme') || name.includes('dark') || name.includes('display')) strong('Name suggests a display setting');
    if (name.includes('consent') || name.includes('accept')) strong('Name suggests stored consent choices');
  }
  return [...signals.filter((s) => !s.weak), ...signals.filter((s) => s.weak)];
}

/** A one-line verdict on the heuristics, or null when a strong one matched. */
export function signalsNote(signals) {
  if (signals.length === 0) return 'No name or vendor signal matched.';
  if (signals.every((s) => s.weak)) return "Only weak signals matched: they don't show what this cookie is for.";
  return null;
}
