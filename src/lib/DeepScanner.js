/**
 * Deep Scanner Module
 * Crawls website to discover and scan multiple pages
 */

export class DeepScanner {
  constructor(options = {}) {
    this.options = {
      maxPages: 10,
      maxDepth: 2,
      respectRobotsTxt: true,
      sameOriginOnly: true,
      timeout: 30000, // 30 seconds per page
      ...options
    };
    
    this.scannedUrls = new Set();
    this.discoveredUrls = new Set();
    this.results = [];
  }

  /**
   * Extract all links from a page
   */
  extractLinks(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a[href]');
    const urls = [];

    links.forEach(link => {
      try {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
          return;
        }

        const absoluteUrl = new URL(href, baseUrl);
        
        // Same origin check
        if (this.options.sameOriginOnly) {
          const baseOrigin = new URL(baseUrl).origin;
          if (absoluteUrl.origin !== baseOrigin) {
            return;
          }
        }

        // Clean URL (remove fragment)
        absoluteUrl.hash = '';
        const cleanUrl = absoluteUrl.toString();
        
        if (!this.scannedUrls.has(cleanUrl) && !this.discoveredUrls.has(cleanUrl)) {
          urls.push(cleanUrl);
          this.discoveredUrls.add(cleanUrl);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    return urls;
  }

  /**
   * Scan a single page for cookies
   */
  async scanPage(url, cookieScanner) {
    try {
      // In a real implementation, this would fetch the page
      // For now, we'll simulate scanning the current page
      // and generate mock data for subpages
      
      this.scannedUrls.add(url);
      
      // Simulate page scan
      const result = cookieScanner.scan();
      
      return {
        url,
        domain: new URL(url).hostname,
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to scan ${url}:`, error);
      return {
        url,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Perform deep scan of website
   */
  async deepScan(startUrl, cookieScanner, onProgress) {
    this.scannedUrls.clear();
    this.discoveredUrls.clear();
    this.results = [];
    
    const urlsToScan = [startUrl];
    let scannedCount = 0;
    
    while (urlsToScan.length > 0 && scannedCount < this.options.maxPages) {
      const url = urlsToScan.shift();
      
      if (this.scannedUrls.has(url)) {
        continue;
      }
      
      // Scan current page
      if (onProgress) {
        onProgress({
          current: scannedCount + 1,
          total: Math.min(this.options.maxPages, urlsToScan.length + scannedCount + 1),
          currentUrl: url,
          status: 'scanning'
        });
      }
      
      const pageResult = await this.scanPage(url, cookieScanner);
      this.results.push(pageResult);
      scannedCount++;
      
      // For demo purposes, generate mock subpages
      if (scannedCount < this.options.maxPages && scannedCount === 1) {
        const mockSubpages = this.generateMockSubpages(startUrl, this.options.maxPages - 1);
        urlsToScan.push(...mockSubpages);
      }
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (onProgress) {
      onProgress({
        current: scannedCount,
        total: scannedCount,
        status: 'complete'
      });
    }
    
    return this.aggregateResults();
  }

  /**
   * Generate mock subpages for demonstration
   */
  generateMockSubpages(baseUrl, count) {
    const base = new URL(baseUrl);
    const commonPaths = [
      '/about',
      '/contact',
      '/products',
      '/services',
      '/blog',
      '/privacy-policy',
      '/terms',
      '/faq',
      '/support',
      '/careers'
    ];
    
    const subpages = [];
    for (let i = 0; i < Math.min(count, commonPaths.length); i++) {
      subpages.push(base.origin + commonPaths[i]);
    }
    
    return subpages;
  }

  /**
   * Aggregate results from all scanned pages
   */
  aggregateResults() {
    const allCookies = new Map(); // Use Map to deduplicate by name+domain
    const pageResults = [];
    let totalPages = 0;
    let errorPages = 0;
    
    this.results.forEach(result => {
      if (result.error) {
        errorPages++;
        return;
      }
      
      totalPages++;
      
      // Add page-specific results
      pageResults.push({
        url: result.url,
        domain: result.domain,
        cookieCount: result.totalCount || 0,
        requiresConsent: result.statistics?.requiresConsent || 0,
        timestamp: result.timestamp
      });
      
      // Aggregate cookies
      if (result.cookies) {
        result.cookies.forEach(cookie => {
          const key = `${cookie.name}::${cookie.domain}`;
          if (!allCookies.has(key)) {
            allCookies.set(key, {
              ...cookie,
              foundOnPages: [result.url]
            });
          } else {
            const existing = allCookies.get(key);
            if (!existing.foundOnPages.includes(result.url)) {
              existing.foundOnPages.push(result.url);
            }
          }
        });
      }
    });
    
    const cookies = Array.from(allCookies.values());
    
    // Calculate statistics
    const statistics = {
      totalPages,
      errorPages,
      totalUniqueCookies: cookies.length,
      requiresConsent: cookies.filter(c => c.requiresConsent).length,
      thirdParty: cookies.filter(c => c.isThirdParty).length,
      byCategory: {},
      byType: {}
    };
    
    cookies.forEach(cookie => {
      statistics.byCategory[cookie.category] = (statistics.byCategory[cookie.category] || 0) + 1;
      statistics.byType[cookie.type] = (statistics.byType[cookie.type] || 0) + 1;
    });
    
    return {
      scanType: 'deep',
      startUrl: this.results[0]?.url || '',
      domain: this.results[0]?.domain || '',
      scannedAt: new Date().toISOString(),
      cookies,
      statistics,
      pageResults,
      totalCount: cookies.length
    };
  }

  /**
   * Cancel ongoing scan
   */
  cancel() {
    this.cancelled = true;
  }
}

export default DeepScanner;
