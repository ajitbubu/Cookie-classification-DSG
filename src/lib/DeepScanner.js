/**
 * Deep Scanner Module - Backend Integration
 * Uses Python backend API for server-side parallel scanning
 */

export class DeepScanner {
  constructor(options = {}) {
    this.options = {
      maxPages: 20000,  // Industry-grade: 20K pages
      maxDepth: 500,    // Industry-grade: deep crawling
      concurrency: 50,  // High-performance parallel scanning
      backendUrl: 'http://localhost:8001',  // Updated to match running backend
      ...options
    };

    this.cancelled = false;
    this.eventSource = null;
  }

  /**
   * Perform deep scan using backend API with SSE streaming
   */
  async deepScan(startUrl, cookieScanner, onProgress) {
    this.cancelled = false;
    const startTime = Date.now();
    let lastUpdateTime = startTime;

    // Deep Scan timeout: 600 seconds (10 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error('⏱️ Deep scan timeout after 10 minutes');
    }, 600000); // 10 minutes

    try {
      // Prepare scan request
      const scanRequest = {
        url: startUrl,
        scanType: 'deep',
        maxPages: this.options.maxPages,
        concurrency: this.options.concurrency,
        maxDepth: this.options.maxDepth
      };

      console.log('Starting backend deep scan:', scanRequest);

      // Use fetch with streaming for SSE
      const response = await fetch(`${this.options.backendUrl}/api/scan-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scanRequest),
        signal: controller.signal
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;

      while (true) {
        if (this.cancelled) {
          clearTimeout(timeoutId);
          reader.cancel();
          throw new Error('Scan cancelled by user');
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                const now = Date.now();
                const elapsed = now - startTime;
                const current = data.current || 0;
                const avgTimePerPage = current > 0 ? Math.round(elapsed / current / 1000) : 4;
                
                // Calculate total duration
                const totalSeconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const totalDuration = `${minutes} min, ${seconds} sec`;

                // Forward progress update to callback
                if (onProgress) {
                  onProgress({
                    current: current,
                    total: data.total || this.options.maxPages,
                    currentUrl: data.currentUrl || '',
                    status: data.status || 'scanning',
                    message: data.message || '',
                    batchProgress: data.batchProgress,
                    batchSize: data.batchSize,
                    currentBatch: data.currentBatch,
                    totalBatches: data.totalBatches,
                    activeScanUrls: data.activeScanUrls || [],
                    avgTimePerPage: `${avgTimePerPage} sec`,
                    totalDuration: totalDuration
                  });
                }
                lastUpdateTime = now;
              } else if (data.type === 'complete') {
                // Scan complete
                finalResult = data.result;
                console.log('Scan complete:', finalResult);
                
                // Send final progress update
                if (onProgress) {
                  const elapsed = Date.now() - startTime;
                  const totalSeconds = Math.floor(elapsed / 1000);
                  const minutes = Math.floor(totalSeconds / 60);
                  const seconds = totalSeconds % 60;
                  
                  onProgress({
                    current: data.result.totalPagesScanned || this.options.maxPages,
                    total: this.options.maxPages,
                    status: 'complete',
                    totalDuration: `${minutes} min, ${seconds} sec`,
                    avgTimePerPage: `${Math.round(elapsed / (data.result.totalPagesScanned || 1) / 1000)} sec`
                  });
                }
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Scan failed');
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      if (!finalResult) {
        clearTimeout(timeoutId);
        throw new Error('No result received from backend');
      }

      clearTimeout(timeoutId);
      return this.formatBackendResult(finalResult);

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Deep scan timeout after 10 minutes');
        throw new Error('Deep scan timeout after 10 minutes. Try reducing the number of pages or increasing concurrency.');
      }
      console.error('Deep scan error:', error);
      throw error;
    }
  }

  /**
   * Format backend result to match expected frontend format
   */
  formatBackendResult(backendResult) {
    return {
      totalPages: backendResult.totalPagesScanned || backendResult.pageResults?.length || 0,
      totalCookies: backendResult.totalCount || 0,
      uniqueCookies: backendResult.totalCount || 0,
      cookies: backendResult.cookies || [],
      pageResults: backendResult.pageResults || [],
      statistics: backendResult.statistics || {},
      domain: backendResult.domain,
      scannedUrl: backendResult.scannedUrl,
      scannedAt: backendResult.scannedAt,
      maxDepthReached: backendResult.maxDepthReached,
      errorPages: backendResult.errorPages,

      // Category breakdown
      byCategory: this.groupByCategory(backendResult.cookies || []),
      byType: this.groupByType(backendResult.cookies || []),

      // Compliance info
      requiresConsent: (backendResult.cookies || []).filter(c => c.requiresConsent).length,
      thirdParty: (backendResult.cookies || []).filter(c => c.isThirdParty).length
    };
  }

  /**
   * Group cookies by category
   */
  groupByCategory(cookies) {
    const categories = {};
    cookies.forEach(cookie => {
      const category = cookie.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(cookie);
    });
    return categories;
  }

  /**
   * Group cookies by type
   */
  groupByType(cookies) {
    const types = {
      session: [],
      persistent: []
    };
    cookies.forEach(cookie => {
      const type = cookie.type || 'session';
      if (types[type]) {
        types[type].push(cookie);
      }
    });
    return types;
  }

  /**
   * Cancel ongoing scan
   */
  cancel() {
    this.cancelled = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Aggregate results (for compatibility)
   */
  aggregateResults() {
    // This is now handled by the backend
    return {
      totalPages: 0,
      totalCookies: 0,
      uniqueCookies: 0,
      cookies: [],
      pageResults: []
    };
  }
}

export default DeepScanner;
