import React, { useState, useEffect, useRef } from 'react';
import { Shield, Cookie, AlertCircle, Download, RefreshCw, Eye, EyeOff, Globe, Clock, Calendar, Play, Pause, Trash2, Bookmark, Copy, Check, Zap, Layers, X } from 'lucide-react';
import CookieScanner from './lib/CookieScanner';
import DeepScanner from './lib/DeepScanner';
import { generateBookmarklet, copyToClipboard } from './lib/utils';
import ScanHistory from './components/ScanHistory';
import './App.css';

function App() {
  const [scanner] = useState(() => new CookieScanner());
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRegulation, setFilterRegulation] = useState('all');
  const [complianceReport, setComplianceReport] = useState(null);

  // URL Scanning
  const [targetUrl, setTargetUrl] = useState('');
  const [scanMode, setScanMode] = useState('quick');

  // Deep Scan
  const [deepScanner] = useState(() => new DeepScanner());
  const [maxPages, setMaxPages] = useState(10);
  const [deepScanProgress, setDeepScanProgress] = useState(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Scheduled Scanning
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(30);
  const [scheduleUnit, setScheduleUnit] = useState('minutes');
  const [scanHistory, setScanHistory] = useState(() => {
    // Load history from localStorage on initial render
    try {
      const saved = localStorage.getItem('cookieScanHistory');
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        console.warn('Invalid scan history format, resetting');
        localStorage.removeItem('cookieScanHistory');
        return [];
      }
      return parsed;
    } catch (e) {
      console.error('Failed to load scan history:', e);
      // Clear corrupted data
      localStorage.removeItem('cookieScanHistory');
      return [];
    }
  });
  const [nextScanTime, setNextScanTime] = useState(null);
  const scheduleTimerRef = useRef(null);

  // Bookmarklet
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);

  // Comparison notification
  const [comparisonNotification, setComparisonNotification] = useState(null);

  const handleCopyBookmarklet = async () => {
    try {
      await copyToClipboard(generateBookmarklet());
      setBookmarkletCopied(true);
      setTimeout(() => setBookmarkletCopied(false), 3000);
    } catch (err) {
      alert('Failed to copy. Please try dragging the button instead.');
    }
  };

  const handleQuickScan = (url = null) => {
    setScanning(true);
    setDeepScanProgress(null);

    setTimeout(() => {
      const results = scanner.scan();
      const scannedUrl = url || window.location.href;

      // Extract domain from the scanned URL
      let domain;
      try {
        domain = new URL(scannedUrl).hostname;
      } catch (e) {
        domain = window.location.hostname;
      }

      const enhancedResults = {
        ...results,
        domain: domain, // Override with actual scanned domain
        scannedUrl: scannedUrl,
        scanType: 'quick'
      };

      setScanResult(enhancedResults);
      const compliance = scanner.generateComplianceReport(enhancedResults);
      setComplianceReport(compliance);
      addToHistory(enhancedResults);
      setScanning(false);
    }, 500);
  };

  const handleDeepScan = async (url = null) => {
    setIsDeepScanning(true);
    setScanning(true);
    setDeepScanProgress({ current: 0, total: maxPages, status: 'starting' });

    try {
      const targetUrl = url || window.location.href;
      const deepScannerInstance = new DeepScanner({ maxPages });

      const results = await deepScannerInstance.deepScan(
        targetUrl,
        scanner,
        (progress) => {
          setDeepScanProgress(progress);
        }
      );

      // Extract domain from the scanned URL
      let domain;
      try {
        domain = new URL(targetUrl).hostname;
      } catch (e) {
        domain = window.location.hostname;
      }

      const enhancedResults = {
        ...results,
        domain: domain, // Override with actual scanned domain
        scannedUrl: targetUrl,
        scanType: 'deep'
      };

      setScanResult(enhancedResults);
      const compliance = scanner.generateComplianceReport(enhancedResults);
      setComplianceReport(compliance);
      addToHistory(enhancedResults);
    } catch (error) {
      console.error('Deep scan failed:', error);
      alert('Deep scan failed: ' + error.message);
    } finally {
      setIsDeepScanning(false);
      setScanning(false);
      setDeepScanProgress(null);
    }
  };

  const handleUrlScan = () => {
    if (!targetUrl) {
      alert('Please enter a URL to scan');
      return;
    }

    try {
      new URL(targetUrl);
      if (scanMode === 'deep') {
        handleDeepScan(targetUrl);
      } else {
        handleQuickScan(targetUrl);
      }
    } catch (e) {
      alert('Please enter a valid URL (e.g., https://example.com)');
    }
  };

  const compareScanResults = (newResults, previousScan) => {
    if (!previousScan) {
      console.log('No previous scan to compare');
      return null;
    }

    console.log('Comparing scans:', {
      newTotal: newResults.totalCount,
      oldTotal: previousScan.totalCookies,
      newCategories: newResults.statistics.byCategory,
      oldCategories: previousScan.categories
    });

    const differences = {
      totalCookies: newResults.totalCount - previousScan.totalCookies,
      requiresConsent: newResults.statistics.requiresConsent - previousScan.requiresConsent,
      thirdParty: newResults.statistics.thirdParty - (previousScan.thirdParty || 0),
      categories: {},
      types: {},
      newCookies: [],
      removedCookies: []
    };

    // Compare categories
    const allCategories = new Set([
      ...Object.keys(newResults.statistics.byCategory || {}),
      ...Object.keys(previousScan.categories || {})
    ]);

    allCategories.forEach(cat => {
      const newCount = newResults.statistics.byCategory[cat] || 0;
      const oldCount = previousScan.categories?.[cat] || 0;
      if (newCount !== oldCount) {
        differences.categories[cat] = newCount - oldCount;
        console.log(`Category ${cat}: ${oldCount} -> ${newCount} (${differences.categories[cat]})`);
      }
    });

    // Compare types
    const allTypes = new Set([
      ...Object.keys(newResults.statistics.byType || {}),
      ...Object.keys(previousScan.types || {})
    ]);

    allTypes.forEach(type => {
      const newCount = newResults.statistics.byType[type] || 0;
      const oldCount = previousScan.types?.[type] || 0;
      if (newCount !== oldCount) {
        differences.types[type] = newCount - oldCount;
        console.log(`Type ${type}: ${oldCount} -> ${newCount} (${differences.types[type]})`);
      }
    });

    // Find new and removed cookies
    const previousCookieNames = new Set(previousScan.fullResults?.cookies?.map(c => c.name) || []);
    const currentCookieNames = new Set(newResults.cookies?.map(c => c.name) || []);

    differences.newCookies = newResults.cookies?.filter(c => !previousCookieNames.has(c.name)) || [];
    differences.removedCookies = previousScan.fullResults?.cookies?.filter(c => !currentCookieNames.has(c.name)) || [];

    console.log('Differences found:', {
      totalCookies: differences.totalCookies,
      newCookies: differences.newCookies.length,
      removedCookies: differences.removedCookies.length,
      categories: Object.keys(differences.categories).length,
      types: Object.keys(differences.types).length
    });

    return differences;
  };

  const cleanResultsForStorage = (results) => {
    // Create a clean copy without circular references or complex objects
    return {
      cookies: results.cookies.map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        value: cookie.value,
        category: cookie.category,
        type: cookie.type,
        purpose: cookie.purpose,
        requiresConsent: cookie.requiresConsent,
        isThirdParty: cookie.isThirdParty,
        size: cookie.size
      })),
      statistics: {
        byCategory: { ...results.statistics.byCategory },
        byType: { ...results.statistics.byType },
        requiresConsent: results.statistics.requiresConsent,
        thirdParty: results.statistics.thirdParty,
        totalSize: results.statistics.totalSize
      },
      domain: results.domain,
      scannedAt: results.scannedAt,
      totalCount: results.totalCount,
      scannedUrl: results.scannedUrl,
      scanType: results.scanType
    };
  };

  const addToHistory = (results) => {
    const cleanResults = cleanResultsForStorage(results);

    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      domain: results.domain,
      url: results.scannedUrl,
      totalCookies: results.totalCount,
      requiresConsent: results.statistics.requiresConsent,
      thirdParty: results.statistics.thirdParty,
      categories: { ...results.statistics.byCategory },
      types: { ...results.statistics.byType },
      gdprRisk: results.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW',
      ccpaRisk: results.cookies.some(c => c.category === 'Marketing') ? 'HIGH' : results.cookies.some(c => c.category === 'Analytics') ? 'MEDIUM' : 'LOW',
      dpdpRisk: results.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW',
      fullResults: cleanResults // Store cleaned results for detailed view
    };

    setScanHistory(prev => {
      // Find previous scan for the same domain (most recent one)
      const previousScan = prev.find(scan => scan.domain === results.domain);

      console.log('Previous scan found:', previousScan);
      console.log('Current results:', results);

      if (previousScan) {
        const comparison = compareScanResults(results, previousScan);
        console.log('Comparison result:', comparison);

        // Show notification if there are differences
        if (comparison && (
          comparison.totalCookies !== 0 ||
          comparison.newCookies.length > 0 ||
          comparison.removedCookies.length > 0 ||
          Object.keys(comparison.categories).length > 0 ||
          Object.keys(comparison.types).length > 0
        )) {
          console.log('Showing comparison notification');
          showScanComparison(comparison);
        } else {
          console.log('No significant differences found');
        }
      } else {
        console.log('No previous scan found for domain:', results.domain);
      }

      const updated = [historyEntry, ...prev];
      // Persist to localStorage with error handling
      try {
        const jsonString = JSON.stringify(updated);
        localStorage.setItem('cookieScanHistory', jsonString);
      } catch (e) {
        console.error('Failed to save scan history:', e);
        // If storage fails, try to save without fullResults
        try {
          const minimalHistory = updated.map(entry => ({
            ...entry,
            fullResults: null
          }));
          localStorage.setItem('cookieScanHistory', JSON.stringify(minimalHistory));
        } catch (e2) {
          console.error('Failed to save minimal scan history:', e2);
        }
      }
      return updated;
    });
  };

  const showScanComparison = (comparison) => {
    setComparisonNotification(comparison);
    // Auto-hide after 10 seconds
    setTimeout(() => setComparisonNotification(null), 10000);
  };

  const getIntervalInMs = () => {
    const multipliers = {
      'minutes': 60 * 1000,
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };
    return scheduleInterval * multipliers[scheduleUnit];
  };

  const startScheduledScanning = () => {
    setScheduleEnabled(true);
    const intervalMs = getIntervalInMs();
    const nextScan = new Date(Date.now() + intervalMs);
    setNextScanTime(nextScan);

    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current);
    }

    scheduleTimerRef.current = setInterval(() => {
      handleQuickScan();
      const nextScan = new Date(Date.now() + intervalMs);
      setNextScanTime(nextScan);
    }, intervalMs);
  };

  const stopScheduledScanning = () => {
    setScheduleEnabled(false);
    setNextScanTime(null);

    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all scan history?')) {
      setScanHistory([]);
      try {
        localStorage.removeItem('cookieScanHistory');
      } catch (e) {
        console.error('Failed to clear scan history:', e);
      }
    }
  };

  const deleteScan = (id) => {
    setScanHistory(prev => {
      const updated = prev.filter(scan => scan.id !== id);
      // Persist to localStorage
      try {
        localStorage.setItem('cookieScanHistory', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update scan history:', e);
      }
      return updated;
    });
  };

  const viewScan = (scan) => {
    if (scan.fullResults) {
      setScanResult(scan.fullResults);
      const compliance = scanner.generateComplianceReport(scan.fullResults);
      setComplianceReport(compliance);
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    handleQuickScan();

    return () => {
      if (scheduleTimerRef.current) {
        clearInterval(scheduleTimerRef.current);
      }
    };
  }, []);

  const handleExport = (format) => {
    if (!scanResult) return;

    const content = scanner.export(scanResult, format);
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' :
        format === 'csv' ? 'text/csv' : 'text/html'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookies-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRegulationRisk = (cookie) => {
    const risks = [];

    if (cookie.requiresConsent) {
      risks.push({ regulation: 'GDPR', level: 'HIGH', reason: 'Requires explicit consent' });
    }

    if (cookie.category === 'Marketing') {
      risks.push({ regulation: 'CCPA', level: 'HIGH', reason: 'Requires opt-out mechanism' });
    } else if (cookie.category === 'Analytics') {
      risks.push({ regulation: 'CCPA', level: 'MEDIUM', reason: 'May require disclosure' });
    }

    if (cookie.requiresConsent) {
      risks.push({ regulation: 'DPDP', level: 'HIGH', reason: 'Prior consent required' });
    }

    return risks;
  };

  const filteredCookies = scanResult?.cookies.filter(c => {
    const categoryMatch = filterCategory === 'all' || c.category === filterCategory;

    if (filterRegulation === 'all') return categoryMatch;

    const risks = getRegulationRisk(c);
    return categoryMatch && risks.some(r => r.regulation === filterRegulation);
  }) || [];

  const categories = scanResult ?
    ['all', ...Object.keys(scanResult.statistics.byCategory)] :
    ['all'];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo-container">
            <Shield className="logo-icon" />
            <span className="logo-text">Data Safeguard</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <Cookie className="badge-icon" />
              <span>Cookie Compliance Scanner</span>
            </div>
            <h1 className="hero-title">Cookie Scanner & Analyzer</h1>
            <p className="hero-subtitle">Privacy compliance tool for GDPR, CCPA, and DPDP regulations</p>
            <div className="hero-features">
              <div className="hero-feature">
                <Shield className="feature-icon" size={20} />
                <span>GDPR Compliant</span>
              </div>
              <div className="hero-feature">
                <Globe className="feature-icon" size={20} />
                <span>Multi-Region Support</span>
              </div>
              <div className="hero-feature">
                <RefreshCw className="feature-icon" size={20} />
                <span>Real-time Scanning</span>
              </div>
            </div>
          </div>
        </section>

        {comparisonNotification && (
          <div className="comparison-notification">
            <div className="notification-header">
              <AlertCircle className="notification-icon" />
              <h3>Scan Comparison Detected</h3>
              <button onClick={() => setComparisonNotification(null)} className="notification-close">
                <X size={20} />
              </button>
            </div>
            <div className="notification-body">
              {comparisonNotification.totalCookies !== 0 && (
                <div className={`notification-item ${comparisonNotification.totalCookies > 0 ? 'increase' : 'decrease'}`}>
                  <span className="item-label">Total Cookies:</span>
                  <span className="item-value">
                    {comparisonNotification.totalCookies > 0 ? '+' : ''}{comparisonNotification.totalCookies}
                  </span>
                </div>
              )}

              {comparisonNotification.requiresConsent !== 0 && (
                <div className={`notification-item ${comparisonNotification.requiresConsent > 0 ? 'increase' : 'decrease'}`}>
                  <span className="item-label">Requires Consent:</span>
                  <span className="item-value">
                    {comparisonNotification.requiresConsent > 0 ? '+' : ''}{comparisonNotification.requiresConsent}
                  </span>
                </div>
              )}

              {comparisonNotification.newCookies.length > 0 && (
                <div className="notification-section">
                  <h4>New Cookies ({comparisonNotification.newCookies.length})</h4>
                  <div className="cookie-list">
                    {comparisonNotification.newCookies.slice(0, 5).map((cookie, idx) => (
                      <div key={idx} className="cookie-chip">
                        <Cookie size={14} />
                        <span>{cookie.name}</span>
                        <span className={`chip-category ${cookie.category.toLowerCase().replace(/\s+/g, '-')}`}>
                          {cookie.category}
                        </span>
                      </div>
                    ))}
                    {comparisonNotification.newCookies.length > 5 && (
                      <span className="more-indicator">+{comparisonNotification.newCookies.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}

              {comparisonNotification.removedCookies.length > 0 && (
                <div className="notification-section">
                  <h4>Removed Cookies ({comparisonNotification.removedCookies.length})</h4>
                  <div className="cookie-list">
                    {comparisonNotification.removedCookies.slice(0, 5).map((cookie, idx) => (
                      <div key={idx} className="cookie-chip removed">
                        <Trash2 size={14} />
                        <span>{cookie.name}</span>
                      </div>
                    ))}
                    {comparisonNotification.removedCookies.length > 5 && (
                      <span className="more-indicator">+{comparisonNotification.removedCookies.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}

              {Object.keys(comparisonNotification.categories).length > 0 && (
                <div className="notification-section">
                  <h4>Category Changes</h4>
                  <div className="changes-grid">
                    {Object.entries(comparisonNotification.categories).map(([cat, diff]) => (
                      <div key={cat} className={`change-item ${diff > 0 ? 'increase' : 'decrease'}`}>
                        <span className="change-label">{cat}:</span>
                        <span className="change-value">{diff > 0 ? '+' : ''}{diff}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(comparisonNotification.types).length > 0 && (
                <div className="notification-section">
                  <h4>Type Changes</h4>
                  <div className="changes-grid">
                    {Object.entries(comparisonNotification.types).map(([type, diff]) => (
                      <div key={type} className={`change-item ${diff > 0 ? 'increase' : 'decrease'}`}>
                        <span className="change-label">{type}:</span>
                        <span className="change-value">{diff > 0 ? '+' : ''}{diff}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="content-grid">
          <div className="main-column">
            <section className="scan-controls">
              <div className="scan-controls-header">
                <h2>Scan Configuration</h2>
                <button
                  onClick={() => scanMode === 'deep' ? handleDeepScan() : handleQuickScan()}
                  disabled={scanning}
                  className="btn btn-primary btn-scan-now"
                >
                  <RefreshCw className={`icon ${scanning ? 'spinning' : ''}`} />
                  {scanning ? (scanMode === 'deep' ? 'Deep Scanning...' : 'Scanning...') : 'Scan Now'}
                </button>
              </div>

              <div className="scan-mode-tabs">
                <button
                  className={`tab ${scanMode === 'quick' ? 'active' : ''}`}
                  onClick={() => setScanMode('quick')}
                  disabled={scanning}
                >
                  <Zap className="icon" />
                  Quick Scan
                </button>
                <button
                  className={`tab ${scanMode === 'deep' ? 'active' : ''}`}
                  onClick={() => setScanMode('deep')}
                  disabled={scanning}
                >
                  <Layers className="icon" />
                  Deep Scan
                </button>
                <button
                  className={`tab ${scanMode === 'schedule' ? 'active' : ''}`}
                  onClick={() => setScanMode('schedule')}
                  disabled={scanning}
                >
                  <Clock className="icon" />
                  Scheduled Scan
                </button>
              </div>

              {scanMode === 'quick' && (
                <div className="scan-panel">
                  <div className="scan-info-box">
                    <Zap className="info-icon" />
                    <div className="scan-info-content">
                      <h3>Quick Scan</h3>
                      <p>Instantly scans cookies on the current page only. Fast and efficient for immediate compliance checks.</p>
                    </div>
                  </div>

                  <div className="url-input-group">
                    <input
                      type="text"
                      placeholder="Enter website URL (e.g., https://example.com) or leave empty for current page"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="url-input"
                      onKeyPress={(e) => e.key === 'Enter' && !scanning && (targetUrl ? handleUrlScan() : handleQuickScan())}
                      disabled={scanning}
                    />
                    <button
                      onClick={() => targetUrl ? handleUrlScan() : handleQuickScan()}
                      className="btn btn-primary"
                      disabled={scanning}
                    >
                      <Zap className="icon" />
                      {scanning ? 'Scanning...' : 'Quick Scan'}
                    </button>
                  </div>

                  <div className="current-domain-info">
                    <Globe className="icon" />
                    <div>
                      <p className="domain-label">{targetUrl ? 'Target Domain' : 'Current Domain'}</p>
                      <p className="domain-value">
                        {targetUrl ? (() => {
                          try {
                            return new URL(targetUrl).hostname;
                          } catch (e) {
                            return 'Invalid URL';
                          }
                        })() : window.location.hostname}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {scanMode === 'deep' && (
                <div className="scan-panel">
                  <div className="scan-info-box deep-scan">
                    <Layers className="info-icon" />
                    <div className="scan-info-content">
                      <h3>Deep Scan</h3>
                      <p>Crawls multiple pages on the website to discover all cookies across different sections. Provides comprehensive coverage.</p>
                    </div>
                  </div>

                  <div className="deep-scan-config">
                    <div className="pages-config-card">
                      <div className="pages-config-header">
                        <Layers className="config-icon" />
                        <div>
                          <label htmlFor="maxPages">Pages to Scan</label>
                          <p className="config-description">Select how many pages to crawl (1-50)</p>
                        </div>
                      </div>
                      <div className="pages-config-body">
                        <input
                          type="range"
                          id="maxPages"
                          min="1"
                          max="50"
                          value={maxPages}
                          onChange={(e) => setMaxPages(parseInt(e.target.value))}
                          className="pages-slider"
                          disabled={scanning}
                        />
                        <div className="pages-value-display">
                          <span className="pages-number">{maxPages}</span>
                          <span className="pages-label">page{maxPages !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="url-input-group">
                      <input
                        type="text"
                        placeholder="Enter website URL (e.g., https://example.com)"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        className="url-input"
                        onKeyPress={(e) => e.key === 'Enter' && !scanning && handleUrlScan()}
                        disabled={scanning}
                      />
                      <button
                        onClick={handleUrlScan}
                        className="btn btn-primary"
                        disabled={scanning}
                      >
                        <Layers className="icon" />
                        {isDeepScanning ? 'Scanning...' : 'Start Deep Scan'}
                      </button>
                    </div>
                  </div>

                  {deepScanProgress && (
                    <div className="deep-scan-progress">
                      <div className="progress-header">
                        <span className="progress-label">Scanning Progress</span>
                        <span className="progress-count">
                          {deepScanProgress.current} / {deepScanProgress.total} pages
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${(deepScanProgress.current / deepScanProgress.total) * 100}%` }}
                        />
                      </div>
                      {deepScanProgress.currentUrl && (
                        <div className="progress-current-url">
                          Currently scanning: <code>{deepScanProgress.currentUrl}</code>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="deep-scan-features">
                    <div className="features-header">
                      <Layers className="features-icon" />
                      <h4>Deep Scan Features</h4>
                    </div>
                    <div className="features-grid">
                      <div className="feature-item">
                        <div className="feature-icon-wrapper">
                          <Globe className="feature-icon" />
                        </div>
                        <div className="feature-content">
                          <h5>Multi-Page Scanning</h5>
                          <p>Scans multiple pages on the website</p>
                        </div>
                      </div>
                      <div className="feature-item">
                        <div className="feature-icon-wrapper">
                          <Cookie className="feature-icon" />
                        </div>
                        <div className="feature-content">
                          <h5>Cross-Section Discovery</h5>
                          <p>Discovers cookies across different sections</p>
                        </div>
                      </div>
                      <div className="feature-item">
                        <div className="feature-icon-wrapper">
                          <Eye className="feature-icon" />
                        </div>
                        <div className="feature-content">
                          <h5>Unique Cookie Detection</h5>
                          <p>Identifies cookies unique to specific pages</p>
                        </div>
                      </div>
                      <div className="feature-item">
                        <div className="feature-icon-wrapper">
                          <Shield className="feature-icon" />
                        </div>
                        <div className="feature-content">
                          <h5>Comprehensive Coverage</h5>
                          <p>Provides complete cookie coverage</p>
                        </div>
                      </div>
                      <div className="feature-item">
                        <div className="feature-icon-wrapper">
                          <Layers className="feature-icon" />
                        </div>
                        <div className="feature-content">
                          <h5>Page-Level Tracking</h5>
                          <p>Shows which cookies appear on which pages</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {scanMode === 'bookmarklet' && (
                <div className="scan-panel">
                  <div className="url-input-group">
                    <input
                      type="text"
                      placeholder="Enter website URL (e.g., https://example.com)"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="url-input"
                      onKeyPress={(e) => e.key === 'Enter' && handleUrlScan()}
                    />
                    <button onClick={handleUrlScan} className="btn btn-primary">
                      <Globe className="icon" />
                      Scan URL
                    </button>
                  </div>

                  <div className="cors-warning">
                    <AlertCircle className="icon-small" />
                    <div>
                      <p className="warning-title">⚠️ Note: Remote URL scanning requires CORS permissions</p>
                      <p className="warning-text">Most websites block cross-origin requests for security. For scanning any website, use the bookmarklet below.</p>
                    </div>
                  </div>

                  <div className="bookmarklet-section">
                    <div className="bookmarklet-header">
                      <Bookmark className="icon" />
                      <h3>Cross-Domain Scanner (Bookmarklet)</h3>
                    </div>
                    <p className="bookmarklet-description">
                      Use either method below to scan any website:
                    </p>

                    <div className="bookmarklet-methods">
                      <div className="method">
                        <p className="method-title">Method 1: Drag to Bookmarks</p>
                        <div className="bookmarklet-container">
                          <a
                            href={generateBookmarklet()}
                            className="bookmarklet-link"
                            onClick={(e) => e.preventDefault()}
                          >
                            🍪 Cookie Scanner
                          </a>
                          <p className="bookmarklet-hint">← Drag this to your bookmarks bar</p>
                        </div>
                      </div>

                      <div className="method">
                        <p className="method-title">Method 2: Copy & Create Bookmark</p>
                        <button
                          onClick={handleCopyBookmarklet}
                          className="btn btn-secondary copy-btn"
                        >
                          {bookmarkletCopied ? (
                            <>
                              <Check className="icon" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="icon" />
                              Copy Bookmarklet Code
                            </>
                          )}
                        </button>
                        {bookmarkletCopied && (
                          <p className="copy-hint">Now create a new bookmark and paste this as the URL</p>
                        )}
                      </div>
                    </div>

                    <div className="bookmarklet-steps">
                      <p className="steps-title">How to use:</p>
                      <ol>
                        <li><strong>Get the bookmarklet:</strong> Either drag the button above OR copy the code</li>
                        <li><strong>Visit any website</strong> you want to scan</li>
                        <li><strong>Click the bookmarklet</strong> from your bookmarks</li>
                        <li><strong>View the report</strong> that opens in a new window</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {scanMode === 'schedule' && (
                <div className="scan-panel">
                  <div className="scan-info-box schedule-scan">
                    <Clock className="info-icon" />
                    <div className="scan-info-content">
                      <h3>Scheduled Scan</h3>
                      <p>Automatically scans the current page at regular intervals. Perfect for monitoring cookie changes over time.</p>
                    </div>
                  </div>

                  <div className="url-input-group">
                    <input
                      type="text"
                      placeholder="Enter website URL (e.g., https://example.com) or leave empty for current page"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="url-input"
                      disabled={scheduleEnabled}
                    />
                  </div>

                  <div className="scheduled-url-info">
                    <Globe className="icon" />
                    <div>
                      <p className="domain-label">Scheduled URL</p>
                      <p className="domain-value">
                        {targetUrl ? (() => {
                          try {
                            return new URL(targetUrl).href;
                          } catch (e) {
                            return targetUrl || 'Invalid URL';
                          }
                        })() : window.location.href}
                      </p>
                    </div>
                  </div>

                  <div className="schedule-controls-grid">
                    <div className="schedule-config-card">
                      <div className="schedule-config-header">
                        <Clock className="config-icon" />
                        <div>
                          <label>Scan Frequency</label>
                          <p className="config-description">Set how often to automatically scan</p>
                        </div>
                      </div>

                      <div className="schedule-inputs">
                        <div className="schedule-input-wrapper">
                          <label htmlFor="scheduleInterval">Every</label>
                          <input
                            type="number"
                            id="scheduleInterval"
                            min="1"
                            max="100"
                            value={scheduleInterval}
                            onChange={(e) => setScheduleInterval(parseInt(e.target.value) || 1)}
                            className="schedule-input"
                            disabled={scheduleEnabled}
                          />
                        </div>

                        <div className="schedule-unit-wrapper">
                          <label htmlFor="scheduleUnit">Unit</label>
                          <select
                            id="scheduleUnit"
                            value={scheduleUnit}
                            onChange={(e) => setScheduleUnit(e.target.value)}
                            className="schedule-select"
                            disabled={scheduleEnabled}
                          >
                            <option value="minutes">Minute(s)</option>
                            <option value="hourly">Hour(s)</option>
                            <option value="daily">Day(s)</option>
                            <option value="weekly">Week(s)</option>
                            <option value="monthly">Month(s)</option>
                          </select>
                        </div>
                      </div>

                      <div className="schedule-preview">
                        <span className="preview-label">Frequency:</span>
                        <span className="preview-value">
                          Every {scheduleInterval} {scheduleUnit === 'hourly' ? 'hour' : scheduleUnit === 'daily' ? 'day' : scheduleUnit === 'weekly' ? 'week' : scheduleUnit === 'monthly' ? 'month' : 'minute'}{scheduleInterval !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="schedule-action-card">
                      <div className="action-card-content">
                        <div className="action-icon-wrapper">
                          {scheduleEnabled ? <Pause className="action-icon" /> : <Play className="action-icon" />}
                        </div>
                        <div className="action-info">
                          <h4>{scheduleEnabled ? 'Schedule Active' : 'Ready to Schedule'}</h4>
                          <p>{scheduleEnabled ? 'Automatic scans are running' : 'Start automated scanning'}</p>
                        </div>
                      </div>
                      {!scheduleEnabled ? (
                        <button onClick={startScheduledScanning} className="btn btn-success btn-block">
                          <Play className="icon" />
                          Start Schedule
                        </button>
                      ) : (
                        <button onClick={stopScheduledScanning} className="btn btn-danger btn-block">
                          <Pause className="icon" />
                          Stop Schedule
                        </button>
                      )}
                    </div>
                  </div>

                  {scheduleEnabled && nextScanTime && (
                    <div className="schedule-status">
                      <Calendar className="icon" />
                      <div>
                        <p className="status-label">Next Scan Scheduled</p>
                        <p className="status-value">{nextScanTime.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {scanResult && scheduleEnabled && (
                    <div className="schedule-results-preview">
                      <div className="preview-header">
                        <Cookie className="icon" />
                        <h4>Latest Scan Results</h4>
                      </div>
                      <div className="preview-stats">
                        <div className="preview-stat">
                          <span className="stat-label">Domain:</span>
                          <span className="stat-value">{scanResult.domain}</span>
                        </div>
                        <div className="preview-stat">
                          <span className="stat-label">Total Cookies:</span>
                          <span className="stat-value highlight">{scanResult.totalCount}</span>
                        </div>
                        <div className="preview-stat">
                          <span className="stat-label">Requires Consent:</span>
                          <span className={`stat-value ${scanResult.statistics.requiresConsent > 0 ? 'warning' : 'success'}`}>
                            {scanResult.statistics.requiresConsent}
                          </span>
                        </div>
                        <div className="preview-stat">
                          <span className="stat-label">Third Party:</span>
                          <span className={`stat-value ${scanResult.statistics.thirdParty > 0 ? 'warning' : 'success'}`}>
                            {scanResult.statistics.thirdParty}
                          </span>
                        </div>
                        <div className="preview-stat">
                          <span className="stat-label">Last Scanned:</span>
                          <span className="stat-value">{new Date(scanResult.scannedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <p className="preview-note">
                        <AlertCircle size={14} />
                        Scroll down to see detailed scan results and compliance analysis
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {scanResult && (
              <>
                <section className="stats-section">
                  <div className="section-header-with-badge">
                    <h2>Cookie Summary & Regulation Risk</h2>
                    <div className="scan-type-badges">
                      <div className={`scan-type-badge ${scanResult.scanType === 'quick' ? 'quick' : scanResult.scanType === 'deep' ? 'deep' : 'scheduled'}`}>
                        {scanResult.scanType === 'quick' && <Zap size={16} />}
                        {scanResult.scanType === 'deep' && <Layers size={16} />}
                        {!scanResult.scanType && <Clock size={16} />}
                        <span>{scanResult.scanType === 'deep' ? 'Deep Scan' : scanResult.scanType === 'quick' ? 'Quick Scan' : 'Scheduled Scan'}</span>
                      </div>
                      <div className="scan-info-badge">
                        <Globe size={14} />
                        <span>{scanResult.domain}</span>
                      </div>
                      <div className="scan-info-badge">
                        <Clock size={14} />
                        <span>{new Date(scanResult.scannedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <StatCard label="Total Cookies" value={scanResult.totalCount} color="blue" />
                    <StatCard label="Require Consent" value={scanResult.statistics.requiresConsent} color="orange" />
                    <StatCard label="Third Party" value={scanResult.statistics.thirdParty} color="red" />

                    <RegulationRiskCard
                      regulation="GDPR"
                      risk={scanResult.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW'}
                      count={scanResult.statistics.requiresConsent}
                    />
                    <RegulationRiskCard
                      regulation="CCPA"
                      risk={scanResult.cookies.some(c => c.category === 'Marketing') ? 'HIGH' : 'LOW'}
                      count={scanResult.cookies.filter(c => c.category === 'Marketing').length}
                    />
                    <RegulationRiskCard
                      regulation="DPDP"
                      risk={scanResult.statistics.requiresConsent > 0 ? 'HIGH' : 'LOW'}
                      count={scanResult.statistics.requiresConsent}
                    />
                  </div>

                  {/* Categories Breakdown */}
                  <div className="breakdown-section">
                    <h3 className="breakdown-title">
                      <Layers className="icon" size={20} />
                      Cookie Categories
                    </h3>
                    <div className="breakdown-grid">
                      {Object.entries(scanResult.statistics.byCategory).map(([category, count]) => (
                        <div key={category} className={`breakdown-card category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                          <div className="breakdown-header">
                            <span className="breakdown-name">{category}</span>
                            <span className="breakdown-count">{count}</span>
                          </div>
                          <div className="breakdown-bar">
                            <div
                              className="breakdown-fill"
                              style={{ width: `${(count / scanResult.totalCount) * 100}%` }}
                            />
                          </div>
                          <div className="breakdown-percentage">
                            {Math.round((count / scanResult.totalCount) * 100)}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cookie Types & Party Breakdown */}
                  <div className="breakdown-section">
                    <h3 className="breakdown-title">
                      <Cookie className="icon" size={20} />
                      Cookie Types & Origin
                    </h3>
                    <div className="breakdown-grid-two">
                      {/* Cookie Types */}
                      <div className="breakdown-group">
                        <h4 className="breakdown-subtitle">By Type</h4>
                        <div className="breakdown-items">
                          {Object.entries(scanResult.statistics.byType).map(([type, count]) => (
                            <div key={type} className="breakdown-item">
                              <div className="item-header">
                                <span className={`item-badge type-${type.toLowerCase()}`}>{type}</span>
                                <span className="item-count">{count}</span>
                              </div>
                              <div className="item-bar">
                                <div
                                  className={`item-fill type-${type.toLowerCase()}`}
                                  style={{ width: `${(count / scanResult.totalCount) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Party Type */}
                      <div className="breakdown-group">
                        <h4 className="breakdown-subtitle">By Origin</h4>
                        <div className="breakdown-items">
                          <div className="breakdown-item">
                            <div className="item-header">
                              <span className="item-badge party-first">First Party</span>
                              <span className="item-count">{scanResult.totalCount - scanResult.statistics.thirdParty}</span>
                            </div>
                            <div className="item-bar">
                              <div
                                className="item-fill party-first"
                                style={{ width: `${((scanResult.totalCount - scanResult.statistics.thirdParty) / scanResult.totalCount) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="breakdown-item">
                            <div className="item-header">
                              <span className="item-badge party-third">Third Party</span>
                              <span className="item-count">{scanResult.statistics.thirdParty}</span>
                            </div>
                            <div className="item-bar">
                              <div
                                className="item-fill party-third"
                                style={{ width: `${(scanResult.statistics.thirdParty / scanResult.totalCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="table-section">
                  <div className="table-header">
                    <h2>Cookie Details & Regulation Analysis</h2>
                    <div className="table-actions">
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="filter-select"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat === 'all' ? 'All Categories' : cat}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterRegulation}
                        onChange={(e) => setFilterRegulation(e.target.value)}
                        className="filter-select"
                      >
                        <option value="all">All Regulations</option>
                        <option value="GDPR">GDPR Risk</option>
                        <option value="CCPA">CCPA Risk</option>
                        <option value="DPDP">DPDP Risk</option>
                      </select>

                      <button onClick={() => handleExport('json')} className="btn btn-secondary">
                        <Download className="icon" />
                        JSON
                      </button>
                      <button onClick={() => handleExport('csv')} className="btn btn-secondary">
                        <Download className="icon" />
                        CSV
                      </button>
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="cookie-table">
                      <thead>
                        <tr>
                          <th>Cookie Name</th>
                          <th>Domain</th>
                          <th>Category</th>
                          <th>Type</th>
                          <th>Regulation Risks</th>
                          <th>Purpose</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCookies.map((cookie, index) => (
                          <CookieRowEnhanced
                            key={index}
                            cookie={cookie}
                            getRegulationRisk={getRegulationRisk}
                            filterRegulation={filterRegulation}
                          />
                        ))}
                      </tbody>
                    </table>
                    {filteredCookies.length === 0 && (
                      <div className="empty-state">
                        <Cookie className="empty-icon" />
                        <p>No cookies found matching the selected filters</p>
                      </div>
                    )}
                  </div>
                </section>

                {scanHistory.length > 0 && (
                  <section className="history-section">
                    <ScanHistory
                      history={scanHistory}
                      onClearHistory={clearHistory}
                      onViewScan={viewScan}
                      onDeleteScan={deleteScan}
                    />
                  </section>
                )}

                {complianceReport && (
                  <section className="compliance-section">
                    <h2>Detailed Compliance Analysis</h2>

                    <div className="compliance-grid">
                      <DetailedComplianceCard
                        title="GDPR (EU) Compliance"
                        regulation="GDPR"
                        status={complianceReport.gdprCompliance.status}
                        details={complianceReport.gdprCompliance}
                        cookies={scanResult.cookies}
                      />

                      <DetailedComplianceCard
                        title="CCPA/CPRA (California) Compliance"
                        regulation="CCPA"
                        status={complianceReport.ccpaCompliance.status}
                        details={complianceReport.ccpaCompliance}
                        cookies={scanResult.cookies}
                      />

                      <DetailedComplianceCard
                        title="DPDP (India) Compliance"
                        regulation="DPDP"
                        status={complianceReport.gdprCompliance.status}
                        details={complianceReport.gdprCompliance}
                        cookies={scanResult.cookies}
                      />
                    </div>

                    {complianceReport.recommendations.length > 0 && (
                      <div className="recommendations">
                        <h3>Action Items & Recommendations</h3>
                        {complianceReport.recommendations.map((rec, index) => (
                          <div key={index} className={`recommendation recommendation-${rec.severity.toLowerCase()}`}>
                            <AlertCircle className="icon" />
                            <div>
                              <p className="rec-message"><strong>{rec.message}</strong></p>
                              <p className="rec-action">{rec.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {scanning && (
              <div className="loading-state">
                <RefreshCw className="spinning icon-large" />
                <p>Scanning cookies...</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-card info-card">
              <div className="card-header">
                <AlertCircle className="card-icon" />
                <h3>Quick Guide</h3>
              </div>
              <div className="card-content">
                <div className="guide-item">
                  <Zap className="guide-icon" />
                  <div>
                    <h4>Quick Scan</h4>
                    <p>Instant analysis of current page cookies</p>
                  </div>
                </div>
                <div className="guide-item">
                  <Layers className="guide-icon" />
                  <div>
                    <h4>Deep Scan</h4>
                    <p>Crawl multiple pages for comprehensive coverage</p>
                  </div>
                </div>
                <div className="guide-item">
                  <Clock className="guide-icon" />
                  <div>
                    <h4>Scheduled Scan</h4>
                    <p>Automate scans at regular intervals</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sidebar-card regulation-info-card">
              <div className="card-header">
                <Shield className="card-icon" />
                <h3>Regulations</h3>
              </div>
              <div className="card-content">
                <div className="regulation-item">
                  <div className="regulation-badge gdpr">GDPR</div>
                  <p>EU General Data Protection Regulation requires explicit consent for non-essential cookies</p>
                </div>
                <div className="regulation-item">
                  <div className="regulation-badge ccpa">CCPA</div>
                  <p>California Consumer Privacy Act requires opt-out mechanisms for data selling</p>
                </div>
                <div className="regulation-item">
                  <div className="regulation-badge dpdp">DPDP</div>
                  <p>India's Digital Personal Data Protection Act mandates prior consent for data processing</p>
                </div>
              </div>
            </div>

            {scanResult && (
              <div className="sidebar-card stats-card">
                <div className="card-header">
                  <Cookie className="card-icon" />
                  <h3>Scan Summary</h3>
                </div>
                <div className="card-content">
                  <div className="summary-stat">
                    <span className="stat-label">Domain</span>
                    <span className="stat-value">{scanResult.domain}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Scan Type</span>
                    <span className="stat-value">{scanResult.scanType === 'deep' ? 'Deep Scan' : 'Quick Scan'}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Total Cookies</span>
                    <span className="stat-value highlight">{scanResult.totalCount}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-label">Categories</span>
                    <span className="stat-value">{Object.keys(scanResult.statistics.byCategory).length}</span>
                  </div>
                </div>
              </div>
            )}

            {scanHistory.length >= 2 && (
              <div className="sidebar-card test-card">
                <div className="card-header">
                  <RefreshCw className="card-icon" />
                  <h3>Comparison Test</h3>
                </div>
                <div className="card-content">
                  <p style={{ fontSize: '12px', marginBottom: '12px', color: 'var(--gray-600)' }}>
                    Test the comparison between your last two scans
                  </p>
                  <button
                    onClick={() => {
                      const latest = scanHistory[0];
                      const previous = scanHistory[1];
                      if (latest && previous && latest.fullResults && previous.fullResults) {
                        const comparison = compareScanResults(latest.fullResults, previous);
                        if (comparison) {
                          showScanComparison(comparison);
                        }
                      }
                    }}
                    className="btn btn-secondary btn-block"
                    style={{ fontSize: '13px' }}
                  >
                    <AlertCircle className="icon" size={16} />
                    Show Last Comparison
                  </button>
                </div>
              </div>
            )}

            <div className="sidebar-card tips-card">
              <div className="card-header">
                <AlertCircle className="card-icon" />
                <h3>Best Practices</h3>
              </div>
              <div className="card-content">
                <ul className="tips-list">
                  <li>Always obtain consent before setting non-essential cookies</li>
                  <li>Provide clear cookie policies and privacy notices</li>
                  <li>Allow users to withdraw consent easily</li>
                  <li>Regularly audit your cookies for compliance</li>
                  <li>Document your data processing activities</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function RegulationRiskCard({ regulation, risk, count }) {
  const riskColors = {
    'HIGH': 'red',
    'MEDIUM': 'orange',
    'LOW': 'green'
  };

  return (
    <div className={`stat-card stat-${riskColors[risk]} regulation-card`}>
      <div className="regulation-name">{regulation}</div>
      <div className={`risk-badge risk-${risk.toLowerCase()}`}>{risk} RISK</div>
      <div className="risk-count">{count} cookies affected</div>
    </div>
  );
}

function CookieRowEnhanced({ cookie, getRegulationRisk, filterRegulation }) {
  const [showFullValue, setShowFullValue] = useState(false);
  const truncatedValue = cookie.value.length > 30 ?
    cookie.value.substring(0, 30) + '...' :
    cookie.value;

  const allRisks = getRegulationRisk(cookie);
  const displayRisks = filterRegulation === 'all'
    ? allRisks
    : allRisks.filter(r => r.regulation === filterRegulation);

  return (
    <tr>
      <td className="cookie-name">{cookie.name}</td>
      <td>
        {cookie.domain}
        {cookie.isThirdParty && (
          <span className="third-party-badge">3rd Party</span>
        )}
      </td>
      <td>
        <span className={`category-badge category-${cookie.category.toLowerCase().replace(/\s+/g, '-')}`}>
          {cookie.category}
        </span>
      </td>
      <td>
        <span className="type-badge">{cookie.type}</span>
      </td>
      <td>
        <div className="risk-badges">
          {displayRisks.map((risk, idx) => (
            <div key={idx} className={`risk-tag risk-${risk.level.toLowerCase()}`} title={risk.reason}>
              {risk.regulation}: {risk.level}
            </div>
          ))}
          {displayRisks.length === 0 && <span className="risk-tag risk-low">COMPLIANT</span>}
        </div>
      </td>
      <td>{cookie.purpose}</td>
      <td className="cookie-value">
        <div className="value-container">
          <span className="value-text">
            {showFullValue ? cookie.value : truncatedValue}
          </span>
          {cookie.value.length > 30 && (
            <button
              onClick={() => setShowFullValue(!showFullValue)}
              className="btn-icon"
              title={showFullValue ? 'Show less' : 'Show more'}
            >
              {showFullValue ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function HistoryCard({ entry }) {
  return (
    <div className="history-card">
      <div className="history-header">
        <div>
          <p className="history-domain">{entry.domain}</p>
          <p className="history-time">{new Date(entry.timestamp).toLocaleString()}</p>
        </div>
      </div>
      <div className="history-stats">
        <div className="history-stat">
          <span className="stat-label">Cookies</span>
          <span className="stat-value">{entry.totalCookies}</span>
        </div>
        <div className="history-stat">
          <span className="stat-label">Require Consent</span>
          <span className="stat-value">{entry.requiresConsent}</span>
        </div>
      </div>
      <div className="history-risks">
        <span className={`risk-badge-small risk-${entry.gdprRisk.toLowerCase()}`}>GDPR: {entry.gdprRisk}</span>
        <span className={`risk-badge-small risk-${entry.ccpaRisk.toLowerCase()}`}>CCPA: {entry.ccpaRisk}</span>
        <span className={`risk-badge-small risk-${entry.dpdpRisk.toLowerCase()}`}>DPDP: {entry.dpdpRisk}</span>
      </div>
    </div>
  );
}

function DetailedComplianceCard({ title, regulation, status, details, cookies }) {
  const isCompliant = status === 'COMPLIANT';

  const affectedCookies = cookies.filter(c => {
    if (regulation === 'GDPR' || regulation === 'DPDP') {
      return c.requiresConsent;
    } else if (regulation === 'CCPA') {
      return c.category === 'Marketing' || c.category === 'Analytics';
    }
    return false;
  });

  return (
    <div className={`compliance-card-detailed ${isCompliant ? 'compliant' : 'non-compliant'}`}>
      <div className="compliance-header">
        <h3>{title}</h3>
        <span className={`compliance-status status-${isCompliant ? 'compliant' : 'risk'}`}>
          {status}
        </span>
      </div>

      <div className="compliance-body">
        <div className="compliance-stat">
          <span className="label">Affected Cookies:</span>
          <span className="value">{affectedCookies.length}</span>
        </div>

        <div className="compliance-stat">
          <span className="label">Compliance Level:</span>
          <span className={`value ${isCompliant ? 'text-success' : 'text-warning'}`}>
            {isCompliant ? '✓ Compliant' : '⚠ Action Required'}
          </span>
        </div>

        {!isCompliant && (
          <div className="compliance-actions">
            <p className="action-title">Required Actions:</p>
            <ul className="action-list">
              {regulation === 'GDPR' && (
                <>
                  <li>Implement consent banner before loading cookies</li>
                  <li>Provide granular consent options</li>
                  <li>Allow users to withdraw consent</li>
                </>
              )}
              {regulation === 'CCPA' && (
                <>
                  <li>Implement "Do Not Sell My Data" link</li>
                  <li>Honor Global Privacy Control (GPC) signals</li>
                  <li>Provide opt-out mechanism</li>
                </>
              )}
              {regulation === 'DPDP' && (
                <>
                  <li>Obtain prior consent before data collection</li>
                  <li>Disclose data processing purposes</li>
                  <li>Maintain consent records</li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
