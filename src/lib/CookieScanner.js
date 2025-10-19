/**
 * Cookie Scanner Core Library
 * Scans, classifies, and analyzes cookies for privacy compliance
 */

export const CookieCategory = {
  STRICTLY_NECESSARY: 'Strictly Necessary',
  ANALYTICS: 'Analytics',
  MARKETING: 'Marketing',
  FUNCTIONAL: 'Functional',
  SOCIAL_MEDIA: 'Social Media',
  UNCLASSIFIED: 'Unclassified'
};

export const CookieType = {
  SESSION: 'Session',
  PERSISTENT: 'Persistent'
};

const classificationRules = {
  strictlyNecessary: {
    patterns: ['session', 'csrf', 'xsrf', 'auth', 'login', 'security', 'token'],
    domains: [],
    purpose: 'Authentication & Security'
  },
  analytics: {
    patterns: ['_ga', '_gid', 'analytics', '_utma', '_utmz', '_utmc', '_hjid', '_vwo'],
    domains: ['google-analytics.com', 'analytics.google.com', 'hotjar.com'],
    purpose: 'Usage Analytics'
  },
  marketing: {
    patterns: ['_fbp', '_gcl', 'ads', '_uetsid', '_ttp', 'IDE', 'test_cookie'],
    domains: ['doubleclick.net', 'facebook.com', 'tiktok.com'],
    purpose: 'Advertising & Tracking'
  },
  functional: {
    patterns: ['lang', 'language', 'pref', 'preference', 'theme', 'cookie_consent', 'consent'],
    domains: [],
    purpose: 'User Preferences'
  },
  socialMedia: {
    patterns: ['fr', 'datr', 'sb', 'c_user'],
    domains: ['facebook.com', 'twitter.com', 'linkedin.com', 'youtube.com'],
    purpose: 'Social Platform Integration'
  }
};

export class CookieScanner {
  constructor(options = {}) {
    this.options = {
      includeHttpOnly: false,
      includeSecure: true,
      customRules: {},
      ...options
    };
    this.rules = { ...classificationRules, ...this.options.customRules };
  }

  parseDocumentCookies() {
    const cookieString = document.cookie;
    if (!cookieString || cookieString.trim() === '') return [];
    
    return cookieString.split(';').map(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      const value = valueParts.join('=');
      return {
        name: name.trim(),
        value: value.trim(),
        domain: window.location.hostname,
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'Lax',
        expires: null
      };
    }).filter(cookie => cookie.name);
  }

  classifyCookie(cookie) {
    const name = cookie.name.toLowerCase();
    const domain = cookie.domain ? cookie.domain.toLowerCase() : '';
    const type = cookie.expires === null || cookie.expires === 'Session' 
      ? CookieType.SESSION 
      : CookieType.PERSISTENT;
    
    for (const [categoryKey, rule] of Object.entries(this.rules)) {
      const matchesPattern = rule.patterns.some(pattern => 
        name.includes(pattern.toLowerCase())
      );
      const matchesDomain = rule.domains.some(d => 
        domain.includes(d.toLowerCase())
      );
      
      if (matchesPattern || matchesDomain) {
        return {
          category: this.getCategoryName(categoryKey),
          purpose: rule.purpose,
          type,
          requiresConsent: categoryKey !== 'strictlyNecessary',
          gdprCompliant: categoryKey === 'strictlyNecessary',
          ccpaApplicable: ['marketing', 'analytics'].includes(categoryKey)
        };
      }
    }
    
    return {
      category: CookieCategory.UNCLASSIFIED,
      purpose: 'Unknown',
      type,
      requiresConsent: true,
      gdprCompliant: false,
      ccpaApplicable: true
    };
  }

  getCategoryName(key) {
    const mapping = {
      strictlyNecessary: CookieCategory.STRICTLY_NECESSARY,
      analytics: CookieCategory.ANALYTICS,
      marketing: CookieCategory.MARKETING,
      functional: CookieCategory.FUNCTIONAL,
      socialMedia: CookieCategory.SOCIAL_MEDIA
    };
    return mapping[key] || CookieCategory.UNCLASSIFIED;
  }

  scan() {
    const rawCookies = this.parseDocumentCookies();
    const analyzedCookies = rawCookies.map(cookie => {
      const classification = this.classifyCookie(cookie);
      return {
        ...cookie,
        ...classification,
        size: new Blob([cookie.value]).size,
        isThirdParty: this.isThirdParty(cookie.domain),
        timestamp: new Date().toISOString()
      };
    });
    
    return {
      cookies: analyzedCookies,
      statistics: this.calculateStatistics(analyzedCookies),
      domain: window.location.hostname,
      scannedAt: new Date().toISOString(),
      totalCount: analyzedCookies.length
    };
  }

  calculateStatistics(cookies) {
    const stats = {
      byCategory: {},
      byType: {},
      requiresConsent: 0,
      thirdParty: 0,
      totalSize: 0
    };
    
    cookies.forEach(cookie => {
      stats.byCategory[cookie.category] = (stats.byCategory[cookie.category] || 0) + 1;
      stats.byType[cookie.type] = (stats.byType[cookie.type] || 0) + 1;
      if (cookie.requiresConsent) stats.requiresConsent++;
      if (cookie.isThirdParty) stats.thirdParty++;
      stats.totalSize += cookie.size;
    });
    
    return stats;
  }

  isThirdParty(cookieDomain) {
    if (!cookieDomain) return false;
    const currentDomain = window.location.hostname;
    const normalizedCookieDomain = cookieDomain.replace(/^\./, '');
    return !currentDomain.endsWith(normalizedCookieDomain) && 
           !normalizedCookieDomain.endsWith(currentDomain);
  }

  generateComplianceReport(scanResults) {
    const { cookies, statistics } = scanResults;
    return {
      gdprCompliance: {
        nonCompliantCookies: cookies.filter(c => !c.gdprCompliant),
        requiresConsent: statistics.requiresConsent,
        status: statistics.requiresConsent === 0 ? 'COMPLIANT' : 'REQUIRES_CONSENT_MANAGEMENT'
      },
      ccpaCompliance: {
        applicableCookies: cookies.filter(c => c.ccpaApplicable),
        requiresOptOut: cookies.filter(c => c.category === CookieCategory.MARKETING).length > 0,
        status: cookies.some(c => c.category === CookieCategory.MARKETING) ? 'REQUIRES_OPT_OUT' : 'COMPLIANT'
      },
      recommendations: this.generateRecommendations(cookies)
    };
  }

  generateRecommendations(cookies) {
    const recommendations = [];
    
    const marketingCookies = cookies.filter(c => c.category === CookieCategory.MARKETING);
    if (marketingCookies.length > 0) {
      recommendations.push({
        severity: 'HIGH',
        message: `Found ${marketingCookies.length} marketing cookies that require explicit consent under GDPR`,
        action: 'Implement consent management before loading these cookies'
      });
    }
    
    const analyticsCookies = cookies.filter(c => c.category === CookieCategory.ANALYTICS);
    if (analyticsCookies.length > 0) {
      recommendations.push({
        severity: 'MEDIUM',
        message: `Found ${analyticsCookies.length} analytics cookies`,
        action: 'Consider using cookieless analytics or obtain consent'
      });
    }
    
    const unclassified = cookies.filter(c => c.category === CookieCategory.UNCLASSIFIED);
    if (unclassified.length > 0) {
      recommendations.push({
        severity: 'MEDIUM',
        message: `Found ${unclassified.length} unclassified cookies`,
        action: 'Review and properly categorize these cookies'
      });
    }
    
    return recommendations;
  }

  export(scanResults, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(scanResults, null, 2);
      case 'csv':
        return this.exportToCSV(scanResults.cookies);
      case 'html':
        return this.exportToHTML(scanResults);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  exportToCSV(cookies) {
    const headers = ['Name', 'Domain', 'Category', 'Type', 'Purpose', 'Requires Consent', 'Third Party'];
    const rows = cookies.map(c => [
      c.name, c.domain, c.category, c.type, c.purpose, c.requiresConsent, c.isThirdParty
    ]);
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  exportToHTML(scanResults) {
    const { cookies, statistics, domain } = scanResults;
    return `<!DOCTYPE html>
<html>
<head>
  <title>Cookie Report - ${domain}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 20px; }
    h1 { color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4f46e5; color: white; }
    tr:nth-child(even) { background-color: #f9fafb; }
  </style>
</head>
<body>
  <h1>Cookie Scan Report</h1>
  <p><strong>Domain:</strong> ${domain}</p>
  <p><strong>Scanned At:</strong> ${new Date(scanResults.scannedAt).toLocaleString()}</p>
  <p><strong>Total Cookies:</strong> ${cookies.length}</p>
  <p><strong>Require Consent:</strong> ${statistics.requiresConsent}</p>
  
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Domain</th>
        <th>Category</th>
        <th>Type</th>
        <th>Purpose</th>
        <th>Requires Consent</th>
      </tr>
    </thead>
    <tbody>
      ${cookies.map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.domain}</td>
          <td>${c.category}</td>
          <td>${c.type}</td>
          <td>${c.purpose}</td>
          <td>${c.requiresConsent ? 'Yes' : 'No'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
  }
}

export default CookieScanner;
