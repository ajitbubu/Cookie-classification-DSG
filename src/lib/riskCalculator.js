/**
 * Privacy Risk Calculator
 * Calculates GDPR, CCPA, and DPDP compliance risk levels
 */
import { normalizeCategory, UNCLASSIFIED_CATEGORY } from './classificationPolicy';

const UNPUBLISHED = new Set([UNCLASSIFIED_CATEGORY, 'Uncategorized', 'Unknown']);

/**
 * Calculate GDPR (EU) compliance risk
 * @param {Array} cookies - Array of cookie objects
 * @param {Object} statistics - Cookie statistics
 * @returns {string} Risk level: 'HIGH', 'MEDIUM', or 'LOW'
 */
export function calculateGDPRRisk(cookies, statistics) {
  const consentRequired = statistics.requiresConsent || 0;
  const thirdParty = statistics.thirdParty || 0;
  const marketing = statistics.byCategory?.['Marketing'] || 0;
  const analytics = statistics.byCategory?.['Analytics'] || 0;
  const socialMedia = statistics.byCategory?.['Social Media'] || 0;
  
  // HIGH: Marketing/Social Media cookies or many consent-required cookies
  if (marketing > 0 || socialMedia > 0 || consentRequired > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Analytics cookies or some third-party/consent-required cookies
  if (analytics > 0 || thirdParty > 0 || consentRequired > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only essential cookies
  return 'LOW';
}

/**
 * Calculate CCPA (California, US) compliance risk
 * @param {Array} cookies - Array of cookie objects
 * @param {Object} statistics - Cookie statistics
 * @returns {string} Risk level: 'HIGH', 'MEDIUM', or 'LOW'
 */
export function calculateCCPARisk(cookies, statistics) {
  const marketing = statistics.byCategory?.['Marketing'] || 0;
  const analytics = statistics.byCategory?.['Analytics'] || 0;
  const socialMedia = statistics.byCategory?.['Social Media'] || 0;
  const thirdParty = statistics.thirdParty || 0;
  
  // HIGH: Marketing/Social Media cookies or many third-party cookies (potential data selling)
  if (marketing > 0 || socialMedia > 0 || thirdParty > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Analytics cookies or some third-party cookies
  if (analytics > 0 || thirdParty > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only first-party essential cookies
  return 'LOW';
}

/**
 * Calculate DPDP (India) compliance risk
 * @param {Array} cookies - Array of cookie objects
 * @param {Object} statistics - Cookie statistics
 * @returns {string} Risk level: 'HIGH', 'MEDIUM', or 'LOW'
 */
export function calculateDPDPRisk(cookies, statistics) {
  const consentRequired = statistics.requiresConsent || 0;
  const thirdParty = statistics.thirdParty || 0;
  const marketing = statistics.byCategory?.['Marketing'] || 0;
  const socialMedia = statistics.byCategory?.['Social Media'] || 0;
  
  // HIGH: Marketing/Social Media cookies or many consent-required cookies
  if (marketing > 0 || socialMedia > 0 || consentRequired > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Some consent-required or third-party cookies
  if (consentRequired > 0 || thirdParty > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only essential cookies
  return 'LOW';
}

/**
 * Calculate all compliance risks
 * @param {Array} cookies - Array of cookie objects
 * @param {Object} statistics - Cookie statistics
 * @returns {Object} Object with gdprRisk, ccpaRisk, and dpdpRisk
 */
export function calculateComplianceRisks(cookies, statistics) {
  return {
    gdprRisk: calculateGDPRRisk(cookies, statistics),
    ccpaRisk: calculateCCPARisk(cookies, statistics),
    dpdpRisk: calculateDPDPRisk(cookies, statistics)
  };
}

/**
 * The category a person has decided for a cookie: its Review Queue approval
 * (keyed `<website>:<cookie name>`) if there is one, else the cookie's own
 * published category. A model suggestion nobody approved stays Unclassified.
 */
export function reviewedCategory(cookie, website, approvalsByKey = new Map()) {
  const approved = approvalsByKey.get(`${website}:${cookie?.name}`);
  if (approved?.approvedCategory) return normalizeCategory(approved.approvedCategory);
  const own = normalizeCategory(cookie?.category);
  return UNPUBLISHED.has(own) ? UNCLASSIFIED_CATEGORY : own;
}

/**
 * Risk inputs counted from the cookies' reviewed categories. Unreviewed
 * cookies count as needing consent, since nobody has shown they are essential.
 */
export function reviewedStatistics(cookies = [], website, approvals = []) {
  const approvalsByKey = new Map(approvals.map((a) => [a.cookieKey, a]));
  const stats = { totalCount: cookies.length, byCategory: {}, requiresConsent: 0, thirdParty: 0, unreviewed: 0 };
  for (const cookie of cookies) {
    const category = reviewedCategory(cookie, website, approvalsByKey);
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    if (category !== 'Strictly Necessary') stats.requiresConsent++;
    if (category === UNCLASSIFIED_CATEGORY) stats.unreviewed++;
    if (cookie.isThirdParty || cookie.type === 'third-party') stats.thirdParty++;
  }
  return stats;
}

/** GDPR / CCPA / DPDP risk from reviewed categories, plus the statistics behind it. */
export function reviewedComplianceRisks(cookies, website, approvals = []) {
  const statistics = reviewedStatistics(cookies, website, approvals);
  return { ...calculateComplianceRisks(cookies, statistics), statistics };
}

/**
 * Risk for a stored scan. Scans that kept their cookies are re-scored from
 * reviewed categories; older entries without cookies keep their saved levels.
 */
export function scanRisks(scan, approvals = []) {
  const cookies = scan?.fullResults?.cookies;
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return { gdprRisk: scan?.gdprRisk, ccpaRisk: scan?.ccpaRisk, dpdpRisk: scan?.dpdpRisk };
  }
  const { gdprRisk, ccpaRisk, dpdpRisk } = reviewedComplianceRisks(cookies, scan.domain, approvals);
  return { gdprRisk, ccpaRisk, dpdpRisk };
}

/**
 * Get explanation for a risk level
 * @param {string} riskType - 'gdpr', 'ccpa', or 'dpdp'
 * @param {string} riskLevel - 'HIGH', 'MEDIUM', or 'LOW'
 * @param {Object} statistics - Cookie statistics
 * @returns {string} Human-readable explanation
 */
export function getRiskExplanation(riskType, riskLevel, statistics) {
  const consentRequired = statistics.requiresConsent || 0;
  const thirdParty = statistics.thirdParty || 0;
  const marketing = statistics.byCategory?.['Marketing'] || 0;
  const analytics = statistics.byCategory?.['Analytics'] || 0;
  const socialMedia = statistics.byCategory?.['Social Media'] || 0;
  
  const explanations = {
    gdpr: {
      HIGH: marketing > 0 || socialMedia > 0
        ? `${marketing + socialMedia} marketing/social media cookies require explicit consent`
        : `${consentRequired} cookies require consent under GDPR`,
      MEDIUM: analytics > 0
        ? `${analytics} analytics cookies detected - consent recommended`
        : `${consentRequired} cookies require consent`,
      LOW: 'Only essential cookies - no consent required'
    },
    ccpa: {
      HIGH: marketing > 0 || socialMedia > 0
        ? `${marketing + socialMedia} marketing/social cookies may involve data selling`
        : `${thirdParty} third-party cookies detected`,
      MEDIUM: analytics > 0
        ? `${analytics} analytics cookies track user behavior`
        : `${thirdParty} third-party cookies present`,
      LOW: 'Only first-party essential cookies - minimal risk'
    },
    dpdp: {
      HIGH: marketing > 0 || socialMedia > 0
        ? `${marketing + socialMedia} marketing/social cookies require consent`
        : `${consentRequired} cookies require consent under DPDP`,
      MEDIUM: consentRequired > 0
        ? `${consentRequired} cookies require consent`
        : `${thirdParty} third-party cookies detected`,
      LOW: 'Only essential cookies - no consent required'
    }
  };
  
  return explanations[riskType]?.[riskLevel] || 'Risk level not determined';
}

/**
 * Get actionable recommendations based on risk level
 * @param {string} riskType - 'gdpr', 'ccpa', or 'dpdp'
 * @param {string} riskLevel - 'HIGH', 'MEDIUM', or 'LOW'
 * @returns {Array} Array of recommendation strings
 */
export function getRiskRecommendations(riskType, riskLevel) {
  const recommendations = {
    gdpr: {
      HIGH: [
        'Implement a Consent Management Platform (CMP)',
        'Add cookie banner with explicit opt-in for non-essential cookies',
        'Document purpose and legal basis for each cookie',
        'Provide easy opt-out mechanism',
        'Update privacy policy with detailed cookie information'
      ],
      MEDIUM: [
        'Add cookie notice with opt-in/opt-out options',
        'Document cookie purposes in privacy policy',
        'Consider implementing a consent banner',
        'Review if all cookies are necessary'
      ],
      LOW: [
        'Document essential cookies in privacy policy',
        'Ensure cookies are truly necessary for site functionality',
        'No consent banner required'
      ]
    },
    ccpa: {
      HIGH: [
        'Add "Do Not Sell My Personal Information" link',
        'Implement opt-out mechanism for data sharing',
        'Review third-party data sharing agreements',
        'Update privacy policy with data selling disclosure',
        'Ensure no discrimination against users who opt-out'
      ],
      MEDIUM: [
        'Add privacy notice about data collection',
        'Provide opt-out option for analytics tracking',
        'Review third-party cookie usage',
        'Update privacy policy with cookie details'
      ],
      LOW: [
        'Maintain current privacy policy',
        'Document first-party cookie usage',
        'No additional action required'
      ]
    },
    dpdp: {
      HIGH: [
        'Implement consent mechanism for data processing',
        'Provide clear notice of data collection',
        'Enable easy consent withdrawal',
        'Document data processing purposes',
        'Update privacy policy per DPDP requirements'
      ],
      MEDIUM: [
        'Add consent notice for non-essential cookies',
        'Document cookie purposes',
        'Provide opt-out mechanism',
        'Review data minimization practices'
      ],
      LOW: [
        'Document essential cookies in privacy policy',
        'Ensure compliance with data minimization',
        'No consent banner required'
      ]
    }
  };
  
  return recommendations[riskType]?.[riskLevel] || [];
}

/**
 * Get risk summary with counts
 * @param {Object} statistics - Cookie statistics
 * @returns {Object} Summary object with risk factors
 */
export function getRiskSummary(statistics) {
  return {
    totalCookies: statistics.totalCount || 0,
    requiresConsent: statistics.requiresConsent || 0,
    thirdParty: statistics.thirdParty || 0,
    marketing: statistics.byCategory?.['Marketing'] || 0,
    analytics: statistics.byCategory?.['Analytics'] || 0,
    socialMedia: statistics.byCategory?.['Social Media'] || 0,
    functional: statistics.byCategory?.['Functional'] || 0,
    strictlyNecessary: statistics.byCategory?.['Strictly Necessary'] || 0
  };
}

export default {
  calculateGDPRRisk,
  calculateCCPARisk,
  calculateDPDPRisk,
  calculateComplianceRisks,
  getRiskExplanation,
  getRiskRecommendations,
  getRiskSummary,
  reviewedCategory,
  reviewedStatistics,
  reviewedComplianceRisks,
  scanRisks
};
