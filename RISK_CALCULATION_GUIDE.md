# Privacy Risk Calculation Guide

## Current Implementation

The risk calculations are performed in `src/App.jsx` in the `addToHistory` function (around line 641):

```javascript
gdprRisk: results.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW',
ccpaRisk: results.cookies.some(c => c.category === 'Marketing') ? 'HIGH' 
          : results.cookies.some(c => c.category === 'Analytics') ? 'MEDIUM' 
          : 'LOW',
dpdpRisk: results.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW',
```

## Current Logic

### GDPR Risk (General Data Protection Regulation - EU)
**Current Formula:**
- **HIGH**: If any cookies require consent (`requiresConsent > 0`)
- **LOW**: If no cookies require consent

**Rationale:**
- GDPR requires explicit consent for non-essential cookies
- Any cookie requiring consent creates compliance risk

### CCPA Risk (California Consumer Privacy Act - US)
**Current Formula:**
- **HIGH**: If any Marketing cookies exist
- **MEDIUM**: If any Analytics cookies exist (but no Marketing)
- **LOW**: If only Functional/Strictly Necessary cookies exist

**Rationale:**
- CCPA focuses on "sale" of personal information
- Marketing cookies often involve data sharing/selling
- Analytics cookies may track user behavior

### DPDP Risk (Digital Personal Data Protection Act - India)
**Current Formula:**
- **HIGH**: If any cookies require consent (`requiresConsent > 0`)
- **LOW**: If no cookies require consent

**Rationale:**
- DPDP requires consent for personal data processing
- Similar to GDPR in consent requirements

## Detailed Risk Factors

### What Makes a Cookie "Require Consent"?

A cookie requires consent if it meets any of these criteria:
1. **Category**: Marketing, Analytics, or Social Media
2. **Third-party**: Cookie from a different domain
3. **Tracking**: Contains tracking identifiers
4. **Not essential**: Not strictly necessary for site functionality

### Cookie Categories and Risk

| Category | GDPR Risk | CCPA Risk | DPDP Risk | Requires Consent |
|----------|-----------|-----------|-----------|------------------|
| **Strictly Necessary** | LOW | LOW | LOW | ❌ No |
| **Functional** | LOW | LOW | LOW | ❌ No |
| **Analytics** | HIGH | MEDIUM | HIGH | ✅ Yes |
| **Marketing** | HIGH | HIGH | HIGH | ✅ Yes |
| **Social Media** | HIGH | HIGH | HIGH | ✅ Yes |
| **Uncategorized** | HIGH | MEDIUM | HIGH | ✅ Yes (cautious) |

## Improved Risk Calculation (Recommended)

### Enhanced GDPR Risk
```javascript
function calculateGDPRRisk(cookies, statistics) {
  const consentRequired = statistics.requiresConsent || 0;
  const thirdParty = statistics.thirdParty || 0;
  const marketing = statistics.byCategory['Marketing'] || 0;
  const analytics = statistics.byCategory['Analytics'] || 0;
  
  // HIGH: Marketing cookies or many consent-required cookies
  if (marketing > 0 || consentRequired > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Some analytics or third-party cookies
  if (analytics > 0 || thirdParty > 0 || consentRequired > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only essential cookies
  return 'LOW';
}
```

### Enhanced CCPA Risk
```javascript
function calculateCCPARisk(cookies, statistics) {
  const marketing = statistics.byCategory['Marketing'] || 0;
  const analytics = statistics.byCategory['Analytics'] || 0;
  const thirdParty = statistics.thirdParty || 0;
  
  // HIGH: Marketing cookies or many third-party cookies (data selling)
  if (marketing > 0 || thirdParty > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Analytics or some third-party cookies
  if (analytics > 0 || thirdParty > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only first-party essential cookies
  return 'LOW';
}
```

### Enhanced DPDP Risk
```javascript
function calculateDPDPRisk(cookies, statistics) {
  const consentRequired = statistics.requiresConsent || 0;
  const thirdParty = statistics.thirdParty || 0;
  const marketing = statistics.byCategory['Marketing'] || 0;
  
  // HIGH: Marketing or many consent-required cookies
  if (marketing > 0 || consentRequired > 5) {
    return 'HIGH';
  }
  
  // MEDIUM: Some consent-required or third-party cookies
  if (consentRequired > 0 || thirdParty > 0) {
    return 'MEDIUM';
  }
  
  // LOW: Only essential cookies
  return 'LOW';
}
```

## Risk Level Definitions

### HIGH Risk
**Meaning:** Significant compliance issues that require immediate attention

**Indicators:**
- Marketing cookies present
- Many cookies requiring consent (>5)
- Extensive third-party tracking
- Potential data selling/sharing

**Actions Required:**
- Implement consent management platform (CMP)
- Review and document all cookie purposes
- Provide opt-out mechanisms
- Update privacy policy

### MEDIUM Risk
**Meaning:** Some compliance concerns that should be addressed

**Indicators:**
- Analytics cookies present
- Some third-party cookies
- Limited tracking
- Few consent-required cookies (1-5)

**Actions Required:**
- Implement basic consent mechanism
- Document cookie purposes
- Provide privacy information
- Consider cookie banner

### LOW Risk
**Meaning:** Minimal compliance concerns

**Indicators:**
- Only essential cookies
- No third-party tracking
- No marketing/analytics cookies
- First-party functional cookies only

**Actions Required:**
- Document essential cookies in privacy policy
- No consent banner required
- Maintain current practices

## Compliance Requirements Summary

### GDPR (EU)
- ✅ Explicit consent required for non-essential cookies
- ✅ Consent must be freely given, specific, informed
- ✅ Easy opt-out mechanism required
- ✅ Cookie policy must be clear and accessible
- ⚠️ Fines up to €20M or 4% of global revenue

### CCPA (California, US)
- ✅ Notice of data collection required
- ✅ Opt-out right for data "sale"
- ✅ "Do Not Sell My Personal Information" link required
- ✅ Cannot discriminate against users who opt-out
- ⚠️ Fines up to $7,500 per violation

### DPDP (India)
- ✅ Consent required for personal data processing
- ✅ Clear notice of data collection
- ✅ Right to withdraw consent
- ✅ Data minimization principle
- ⚠️ Penalties up to ₹250 crores

## Risk Calculation Examples

### Example 1: E-commerce Site
**Cookies Found:**
- 2 Strictly Necessary (session, cart)
- 1 Functional (language preference)
- 3 Analytics (Google Analytics)
- 5 Marketing (Facebook Pixel, Google Ads)

**Risk Assessment:**
- GDPR: **HIGH** (8 cookies require consent)
- CCPA: **HIGH** (Marketing cookies present)
- DPDP: **HIGH** (8 cookies require consent)

### Example 2: Simple Blog
**Cookies Found:**
- 1 Strictly Necessary (session)
- 1 Functional (theme preference)
- 2 Analytics (basic stats)

**Risk Assessment:**
- GDPR: **MEDIUM** (2 analytics cookies)
- CCPA: **MEDIUM** (Analytics present)
- DPDP: **MEDIUM** (2 cookies require consent)

### Example 3: Static Website
**Cookies Found:**
- 1 Strictly Necessary (CSRF token)

**Risk Assessment:**
- GDPR: **LOW** (No consent required)
- CCPA: **LOW** (No tracking)
- DPDP: **LOW** (Essential only)

## Recommendations for Implementation

### 1. Add Risk Calculation Functions
Create a separate utility file `src/lib/riskCalculator.js`:

```javascript
export function calculateComplianceRisks(cookies, statistics) {
  return {
    gdprRisk: calculateGDPRRisk(cookies, statistics),
    ccpaRisk: calculateCCPARisk(cookies, statistics),
    dpdpRisk: calculateDPDPRisk(cookies, statistics)
  };
}
```

### 2. Add Risk Explanations
Show users WHY they have a certain risk level:

```javascript
export function getRiskExplanation(riskType, riskLevel, statistics) {
  const explanations = {
    gdpr: {
      HIGH: `${statistics.requiresConsent} cookies require consent under GDPR`,
      MEDIUM: `${statistics.thirdParty} third-party cookies detected`,
      LOW: 'Only essential cookies found'
    },
    // ... more explanations
  };
  return explanations[riskType][riskLevel];
}
```

### 3. Add Actionable Recommendations
Provide specific steps to reduce risk:

```javascript
export function getRiskRecommendations(riskType, riskLevel, cookies) {
  if (riskLevel === 'HIGH') {
    return [
      'Implement a Consent Management Platform (CMP)',
      'Review and categorize all cookies',
      'Add cookie banner with opt-in/opt-out',
      'Update privacy policy with cookie details'
    ];
  }
  // ... more recommendations
}
```

## Current Limitations

1. **Binary Logic**: Current GDPR/DPDP only checks if ANY cookies require consent
2. **No Thresholds**: Doesn't consider the NUMBER of problematic cookies
3. **No Severity Weighting**: All consent-required cookies treated equally
4. **Limited CCPA Logic**: Only checks category, not actual data sharing
5. **No Context**: Doesn't consider cookie duration, data sensitivity, etc.

## Future Enhancements

1. **Weighted Scoring**: Different cookies have different risk weights
2. **Duration Factor**: Persistent cookies are riskier than session cookies
3. **Data Sensitivity**: Cookies with PII are higher risk
4. **Vendor Reputation**: Known tracking vendors increase risk
5. **Consent Status**: Track if consent was actually obtained
6. **Historical Trends**: Show risk changes over time
7. **Benchmark Comparison**: Compare against industry standards
