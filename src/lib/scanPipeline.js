/**
 * What happens to a scan between the scanner's response and the scan store.
 *
 * Moved out of App.jsx so the browser and the server-side scheduler build the
 * exact same record: classify the cookies (ML, with the rule fallback), apply the
 * publish policy and the site's own declaration, recount statistics, keep only the
 * fields we store, and add the summary + GDPR/CCPA/DPDP risks.
 *
 * Framework-free per the `src/lib/` convention — no React imports. Network calls
 * take `fetchImpl` and `baseUrl` so a Node process can use them too.
 */
import { calculateComplianceRisks } from './riskCalculator';
import {
  createRuleFallbackClassifications,
  normalizeCategory,
  publishableCategory as publishableCategoryFor,
} from './classificationPolicy';
import { toClassifyCookie } from './cookieClassifyPayload';
import { applyWebsiteDeclaration } from './websiteDeclaration';

export const newScanId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

/** Counts by category and type, consent and third-party totals, total size. */
export function calculateStatistics(cookies) {
  const stats = { byCategory: {}, byType: {}, requiresConsent: 0, thirdParty: 0, totalSize: 0 };
  cookies.forEach((cookie) => {
    const category = cookie.category || 'Uncategorized';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    const type = cookie.type || 'session';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    if (cookie.requiresConsent) stats.requiresConsent++;
    if (cookie.isThirdParty) stats.thirdParty++;
    stats.totalSize += cookie.size || 0;
  });
  return stats;
}

/** fetch that gives up after `timeoutMs` with "Request timeout after N seconds". */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
    throw error;
  }
}

// Model confidence must remain the calibrated model output. Rule agreement is
// useful evidence, but adding an arbitrary boost makes the score misleading.
const modelConfidence = (mlData) => ({
  adjustedConfidence: mlData.confidence_score ?? 0,
  adjustedLevel: mlData.confidence_level || 'Low',
});

/** One scanned cookie merged with its classify result (or the rule fallback). */
export function enrichCookieWithClassification(cookie, classification) {
  const mlData = classification || createRuleFallbackClassifications([cookie], 'missing_classification_result')[0];
  const suggestedCategory = normalizeCategory(mlData.suggested_category || mlData.predicted_category);
  const publishableCategory = publishableCategoryFor(mlData);
  const { adjustedConfidence, adjustedLevel } = modelConfidence(mlData);
  const classificationSource = mlData.source || 'ml_prediction';
  const isPublishedClassification = mlData.classification_status === 'classified';

  return applyWebsiteDeclaration({
    ...cookie,
    originalCategory: cookie.category,
    category: publishableCategory,
    mlClassification: suggestedCategory,
    mlSuggestedClassification: suggestedCategory,
    mlConfidence: adjustedConfidence,
    mlConfidenceLevel: adjustedLevel,
    mlAlternativePredictions: mlData.alternative_predictions || [],
    classificationSource,
    classificationStatus: mlData.classification_status || (
      publishableCategory === 'Unclassified' ? 'suggested' : 'classified'
    ),
    abstainReason: mlData.abstain_reason || null,
    siteLabelSplit: mlData.site_label_split || null,
    knownCookie: mlData.known_cookie || null,
    requiresReview: mlData.requires_review ?? true,
    requiresConsent: isPublishedClassification ? publishableCategory !== 'Strictly Necessary' : true,
    gdprCompliant: isPublishedClassification ? publishableCategory === 'Strictly Necessary' : false,
    ccpaApplicable: isPublishedClassification ? ['Analytics', 'Marketing'].includes(publishableCategory) : true,
    websiteProvided: false,
    categorySource: isPublishedClassification ? classificationSource : 'unclassified',
  });
}

/** POST /api/v1/ml/classify; the rule fallback when the model can't be reached. */
export async function classifyCookies(cookies, siteDomain, { fetchImpl = fetch, baseUrl = '', timeoutMs = 30000, log = console } = {}) {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/v1/ml/classify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies: cookies.map((cookie) => toClassifyCookie(cookie, siteDomain)),
          options: { return_explanation: false, find_similar: false, auto_classify: false },
        }),
      },
      timeoutMs,
      fetchImpl,
    );
    if (response.ok) return (await response.json()).classifications;
    log.error(`ML API returned error: ${response.status} ${response.statusText}`);
  } catch (error) {
    log.error(String(error.message).includes('timeout') ? `ML API timeout after ${timeoutMs / 1000} seconds` : `ML API failed: ${error}`);
  }
  return createRuleFallbackClassifications(cookies, 'model_unavailable');
}

/**
 * A scan result with its cookies classified: enriched cookies, the same enrichment
 * on each page's copies (when the scan has pages), and statistics recounted.
 */
export function applyClassifications(results, classifications) {
  const cookies = (results.cookies || []).map((cookie, idx) => enrichCookieWithClassification(cookie, classifications[idx]));
  const byKey = new Map(cookies.map((c) => [`${c.name}||${c.domain}`, c]));
  const pages = results.pageResults
    ? {
      pageResults: results.pageResults.map((page) => ({
        ...page,
        cookies: (page.cookies || []).map((c) => {
          const enriched = byKey.get(`${c.name}||${c.domain}`);
          return enriched ? { ...c, ...enriched } : c;
        }),
      })),
    }
    : {};
  return { ...results, cookies, ...pages, statistics: calculateStatistics(cookies) };
}

const PAGE_COOKIE_FIELDS = [
  'name', 'domain', 'category', 'originalCategory', 'type', 'purpose', 'requiresConsent', 'isThirdParty', 'size',
  'secure', 'httpOnly', 'mlClassification', 'mlConfidence', 'mlConfidenceLevel', 'mlReasoning', 'abstainReason',
  'siteLabelSplit', 'knownCookie',
];
// The site's own banner declaration (OneTrust/Cookiebot) and what the model said about it
const COOKIE_FIELDS = [
  ...PAGE_COOKIE_FIELDS, 'websiteDeclaration', 'websiteProvided', 'classificationSource', 'modelSuggestion',
  'declarationConflict',
];
const pick = (cookie, fields) => Object.fromEntries(fields.map((f) => [f, cookie[f]]));

/**
 * The scan as stored: a fixed list of fields, no circular references. Cookie values
 * are never stored: they can hold session tokens and personal data.
 */
export function cleanResultsForStorage(results) {
  return {
    cookies: results.cookies.map((cookie) => pick(cookie, COOKIE_FIELDS)),
    statistics: {
      byCategory: { ...results.statistics.byCategory },
      byType: { ...results.statistics.byType },
      requiresConsent: results.statistics.requiresConsent,
      thirdParty: results.statistics.thirdParty,
      totalSize: results.statistics.totalSize,
    },
    domain: results.domain,
    scannedAt: results.scannedAt,
    totalCount: results.totalCount,
    scannedUrl: results.scannedUrl,
    scanType: results.scanType,
    errorPages: results.errorPages,
    scanDuration: results.scanDuration,
    cmp: results.cmp,
    pageResults: results.pageResults
      ? results.pageResults.map((page) => ({ url: page.url, cookies: page.cookies.map((c) => pick(c, PAGE_COOKIE_FIELDS)) }))
      : undefined,
  };
}

/** The scan-store record for a scan result: summary fields, risks, and the stored results. */
export function buildHistoryEntry(results, { now = new Date() } = {}) {
  const fullResults = cleanResultsForStorage(results);
  // Derive stats from cookies array when summary fields are missing/zero
  const cookies = results.cookies || [];
  const stats = results.statistics || {};
  const totalCookies = results.totalCount || stats.totalCount || cookies.length || 0;
  const requiresConsent = stats.requiresConsent || cookies.filter((c) => c.requiresConsent).length || 0;
  const thirdParty = stats.thirdParty || cookies.filter((c) => c.isThirdParty || c.type === 'third-party').length || 0;

  const byCategory = stats.byCategory && Object.keys(stats.byCategory).length > 0 ? { ...stats.byCategory } : {};
  if (Object.keys(byCategory).length === 0) {
    cookies.forEach((c) => {
      const cat = c.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
  }
  const byType = stats.byType && Object.keys(stats.byType).length > 0 ? { ...stats.byType } : {};
  if (Object.keys(byType).length === 0) {
    cookies.forEach((c) => {
      const t = c.isThirdParty ? 'third-party' : (c.type || 'first-party');
      byType[t] = (byType[t] || 0) + 1;
    });
  }

  return {
    id: results._scanId || newScanId(),
    timestamp: now.toISOString(),
    domain: results.domain,
    url: results.scannedUrl,
    totalCookies,
    requiresConsent,
    thirdParty,
    categories: byCategory,
    types: byType,
    ...calculateComplianceRisks(cookies, { ...stats, requiresConsent, thirdParty }),
    scanType: results.scanType || 'quick',
    pagesScanned: results.totalPages || results.pageResults?.length || 1,
    failedPages: results.errorPages?.length || 0,
    durationMs: results.scanDuration || null,
    fullResults,
  };
}
