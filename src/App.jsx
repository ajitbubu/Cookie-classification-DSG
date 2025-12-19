import React, { useState, useEffect, useRef } from 'react';
import { Shield, Cookie, AlertCircle, Download, RefreshCw, Eye, EyeOff, Globe, Clock, Play, Pause, Trash2, Bookmark, Copy, Check, Zap, Layers, X } from 'lucide-react';
import CookieScanner from './lib/CookieScanner';
import DeepScanner from './lib/DeepScanner';
import { generateBookmarklet, copyToClipboard } from './lib/utils';
import { calculateComplianceRisks } from './lib/riskCalculator';
import ScanHistory from './components/ScanHistory';
import DomainScanHistory from './components/DomainScanHistory';
import MLClassificationDropdown from './components/MLClassificationDropdown';
import ConfidenceBadge from './components/ConfidenceBadge';
import './App.css';

function App() {
  const [scanner] = useState(() => new CookieScanner());
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRegulation, setFilterRegulation] = useState('all');

  // URL Scanning
  const [targetUrl, setTargetUrl] = useState('');
  const [scanMode, setScanMode] = useState('quick');

  // Deep Scan - Industry Grade Configuration
  const [deepScanner] = useState(() => new DeepScanner());
  const [maxPages, setMaxPages] = useState(100);  // Default to 100 pages
  const [concurrency, setConcurrency] = useState(20);  // Default to 20 concurrent
  const [maxDepth, setMaxDepth] = useState(500);  // Default depth 500
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
  const [timeUntilNextScan, setTimeUntilNextScan] = useState(null);
  const scheduleTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Domain-based scan history
  const [domainHistory, setDomainHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('domainScanHistory');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      console.error('Failed to load domain history:', e);
      return {};
    }
  });

  // Bookmarklet
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);

  // Comparison notification
  const [comparisonNotification, setComparisonNotification] = useState(null);

  // Results view tab
  const [resultsTab, setResultsTab] = useState('cookies'); // cookies, categories, vendors, compliance

  // Accessibility - aria-live announcements
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');

  const handleCopyBookmarklet = async () => {
    try {
      await copyToClipboard(generateBookmarklet());
      setBookmarkletCopied(true);
      setTimeout(() => setBookmarkletCopied(false), 3000);
    } catch (err) {
      alert('Failed to copy. Please try dragging the button instead.');
    }
  };

  // Confidence action handlers
  const handleConfidenceConfirm = (cookieName, classification, confidence) => {
    console.log(`✓ Confirmed: ${cookieName} as ${classification} (${Math.round(confidence * 100)}%)`);
    
    // Save to localStorage for future reference
    try {
      const confirmed = JSON.parse(localStorage.getItem('confirmedClassifications') || '{}');
      confirmed[cookieName] = {
        classification,
        confidence,
        confirmedAt: new Date().toISOString()
      };
      localStorage.setItem('confirmedClassifications', JSON.stringify(confirmed));
    } catch (e) {
      console.error('Failed to save confirmation:', e);
    }
  };

  const handleConfidenceIgnore = (cookieName) => {
    console.log(`⊘ Ignored: ${cookieName}`);
    
    // Save to localStorage to always ignore this cookie's confidence
    try {
      const ignored = JSON.parse(localStorage.getItem('ignoredConfidence') || '[]');
      if (!ignored.includes(cookieName)) {
        ignored.push(cookieName);
        localStorage.setItem('ignoredConfidence', JSON.stringify(ignored));
      }
    } catch (e) {
      console.error('Failed to save ignore preference:', e);
    }
  };

  // Helper function to recalculate statistics based on updated cookie categories
  const calculateStatistics = (cookies) => {
    const stats = {
      byCategory: {},
      byType: {},
      requiresConsent: 0,
      thirdParty: 0,
      totalSize: 0
    };

    cookies.forEach(cookie => {
      // Count by category
      const category = cookie.category || 'Uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Count by type
      const type = cookie.type || 'session';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count consent requirements
      if (cookie.requiresConsent) {
        stats.requiresConsent++;
      }

      // Count third-party
      if (cookie.isThirdParty) {
        stats.thirdParty++;
      }

      // Sum sizes
      stats.totalSize += cookie.size || 0;
    });

    return stats;
  };

  // Helper function to create fetch with timeout
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    }
  };

  // Helper function to adjust ML confidence when rules and ML agree
  const adjustMLConfidence = (cookie, mlData) => {
    let adjustedConfidence = mlData.confidence_score;
    let adjustedLevel = mlData.confidence_level;
    
    // Hybrid confidence boost: If rule-based and ML agree, boost confidence
    if (cookie.category !== 'Uncategorized' && 
        cookie.category === mlData.predicted_category) {
      // Both agree! Boost confidence by 25% (max 95%)
      adjustedConfidence = Math.min(0.95, mlData.confidence_score + 0.25);
      if (adjustedConfidence >= 0.85) {
        adjustedLevel = 'High';
      } else if (adjustedConfidence >= 0.65) {
        adjustedLevel = 'Medium';
      }
    }
    
    return { adjustedConfidence, adjustedLevel };
  };

  // ML Classification function
  const classifyCookiesWithML = async (cookies) => {
    try {
      const requestBody = {
        cookies: cookies.map(cookie => ({
          id: `${cookie.name}-${cookie.domain}`,
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path || '/',
          expiry_days: cookie.expiry_days,
          http_only: cookie.httpOnly || false,
          secure: cookie.secure || false,
          same_site: cookie.sameSite,
          value_sample: cookie.value ? cookie.value.substring(0, 50) : '',
        })),
        options: {
          return_explanation: false,
          find_similar: false,
        }
      };
      
      console.log(`🤖 Calling ML API for ${cookies.length} cookies...`);
      
      // ML Classification timeout: 30 seconds
      const response = await fetchWithTimeout(
        'http://localhost:8001/api/v1/ml/classify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        },
        30000 // 30 seconds timeout
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ ML API Response:', data.summary);
        console.log('Sample classification:', data.classifications[0]);
        console.log('All classifications:', data.classifications.map(c => ({
          category: c.predicted_category,
          confidence: c.confidence_score,
          level: c.confidence_level
        })));
        
        // Always use ML predictions (even if confidence is low)
        return data.classifications;
      } else {
        console.error('❌ ML API returned error:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error('❌ ML API timeout after 30 seconds');
      } else {
        console.error('❌ ML API failed:', error);
      }
    }
    
    // Return mock data for demonstration when API fails or model is untrained
    console.log('Generating mock data for', cookies.length, 'cookies');
    return cookies.map(cookie => {
      // Generate mock ML classification based on cookie name patterns
      let predicted_category = 'Functional'; // Default to Functional instead of Unknown
      let confidence_score = 0.6;
      let confidence_level = 'Medium';
      
      const name = cookie.name.toLowerCase();
        
      if (name.includes('_ga') || name.includes('analytics') || name.includes('_gid')) {
          predicted_category = 'Analytics';
          confidence_score = 0.92;
          confidence_level = 'High';
        } else if (name.includes('_fb') || name.includes('ads') || name.includes('marketing')) {
          predicted_category = 'Marketing';
          confidence_score = 0.88;
          confidence_level = 'High';
        } else if (name.includes('session') || name.includes('csrf') || name.includes('auth')) {
          predicted_category = 'Strictly Necessary';
          confidence_score = 0.95;
          confidence_level = 'High';
        } else if (name.includes('pref') || name.includes('lang') || name.includes('theme')) {
          predicted_category = 'Functional';
          confidence_score = 0.78;
          confidence_level = 'Medium';
        } else {
          // Random confidence for unknown
          confidence_score = 0.45 + Math.random() * 0.3;
          if (confidence_score >= 0.85) {
            confidence_level = 'High';
          } else if (confidence_score >= 0.65) {
            confidence_level = 'Medium';
          } else {
            confidence_level = 'Low';
          }
        }
        
        return {
          cookie_id: `${cookie.name}-${cookie.domain}`,
          predicted_category,
          confidence_score,
          confidence_level,
          auto_classified: confidence_score >= 0.85,
          requires_review: confidence_score < 0.85,
        };
      });
  };

  const handleQuickScan = async (url = null) => {
    const scanStartTime = Date.now();
    setScanning(true);
    setDeepScanProgress(null);

    // Use async/await properly instead of setTimeout
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results = scanner.scan();
    const scannedUrl = url || window.location.href;

    // Extract domain from the scanned URL
    let domain;
    try {
      domain = new URL(scannedUrl).hostname;
    } catch (e) {
      domain = window.location.hostname;
    }

    // Calculate scan duration
    const scanEndTime = Date.now();
    const scanDuration = scanEndTime - scanStartTime;

    const enhancedResults = {
      ...results,
      domain: domain,
      scannedUrl: scannedUrl,
      scanType: 'quick',
      scanDuration: scanDuration
    };

    setScanResult(enhancedResults);
    addToHistory(enhancedResults);
    setScanning(false);

    // Classify cookies with ML in the background
    if (results.cookies && results.cookies.length > 0) {
      const mlClassifications = await classifyCookiesWithML(results.cookies);
      
      if (mlClassifications && mlClassifications.length > 0) {
        const updatedCookies = results.cookies.map((cookie, idx) => {
          const mlData = mlClassifications[idx];
          
          // Keep original category from scan, add ML prediction separately
          if (mlData && mlData.predicted_category) {
            // Only update category if it was Uncategorized from the scan
            const finalCategory = cookie.category === 'Uncategorized' 
              ? mlData.predicted_category 
              : cookie.category;
            
            // Hybrid confidence boost: If rule-based and ML agree, boost confidence
            const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);
            
            return {
              ...cookie,
              originalCategory: cookie.category, // Store original scan result
              category: finalCategory, // Update only if Uncategorized
              mlClassification: mlData.predicted_category, // Always show ML prediction
              mlConfidence: adjustedConfidence,
              mlConfidenceLevel: adjustedLevel,
              websiteProvided: false,
              categorySource: cookie.category === 'Uncategorized' ? 'ml' : 'rules'
            };
          } else {
            // No ML data available
            return {
              ...cookie,
              originalCategory: cookie.category,
              mlClassification: 'Unclassified',
              mlConfidence: 0.0,
              mlConfidenceLevel: 'Low',
              websiteProvided: false,
              categorySource: 'rules'
            };
          }
        });
        
        const updatedResults = {
          ...enhancedResults,
          cookies: updatedCookies
        };
        
        setScanResult(updatedResults);
        
        // Re-calculate statistics with updated categories
        const updatedStats = calculateStatistics(updatedCookies);
        const finalResults = {
          ...updatedResults,
          statistics: updatedStats
        };
        
        setScanResult(finalResults);
        // Update history with corrected statistics
        addToHistory(finalResults);
      }
    }
  };

  const handleDeepScan = async (url = null) => {
    const scanStartTime = Date.now();
    setIsDeepScanning(true);
    setScanning(true);
    setDeepScanProgress({ current: 0, total: maxPages, status: 'starting' });

    try {
      const targetUrl = url || window.location.href;
      const deepScannerInstance = new DeepScanner({
        maxPages,
        concurrency,
        maxDepth  // Pass maxDepth to backend
      });

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

      // Calculate scan duration
      const scanEndTime = Date.now();
      const scanDuration = scanEndTime - scanStartTime;

      const enhancedResults = {
        ...results,
        domain: domain, // Override with actual scanned domain
        scannedUrl: targetUrl,
        scanType: 'deep',
        scanDuration: scanDuration
      };

      setScanResult(enhancedResults);
      addToHistory(enhancedResults);

      // Classify cookies with ML in the background
      if (results.cookies && results.cookies.length > 0) {
        const mlClassifications = await classifyCookiesWithML(results.cookies);
        
        if (mlClassifications && mlClassifications.length > 0) {
          const updatedCookies = results.cookies.map((cookie, idx) => {
            const mlData = mlClassifications[idx];
            
            // Keep original category from scan, add ML prediction separately
            if (mlData && mlData.predicted_category) {
              // Only update category if it was Uncategorized from the scan
              const finalCategory = cookie.category === 'Uncategorized' 
                ? mlData.predicted_category 
                : cookie.category;
              
              // Hybrid confidence boost: If rule-based and ML agree, boost confidence
              const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);
              
              return {
                ...cookie,
                originalCategory: cookie.category, // Store original scan result
                category: finalCategory, // Update only if Uncategorized
                mlClassification: mlData.predicted_category, // Always show ML prediction
                mlConfidence: adjustedConfidence,
                mlConfidenceLevel: adjustedLevel,
                websiteProvided: false,
                categorySource: cookie.category === 'Uncategorized' ? 'ml' : 'rules'
              };
            } else {
              // No ML data available
              return {
                ...cookie,
                originalCategory: cookie.category,
                mlClassification: 'Unclassified',
                mlConfidence: 0.0,
                mlConfidenceLevel: 'Low',
                websiteProvided: false,
                categorySource: 'rules'
              };
            }
          });
          
          const updatedResults = {
            ...enhancedResults,
            cookies: updatedCookies
          };
          
          setScanResult(updatedResults);
          
          // Re-calculate statistics with updated categories
          const updatedStats = calculateStatistics(updatedCookies);
          const finalResults = {
            ...updatedResults,
            statistics: updatedStats
          };
          
          setScanResult(finalResults);
        }
      }
    } catch (error) {
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
      // Always use deep scan for remote URLs since quick scan only works on current page
      if (scanMode === 'deep') {
        handleDeepScan(targetUrl);
      } else {
        // For quick scan with URL, use backend with single page scan
        handleQuickScanRemote(targetUrl);
      }
    } catch (e) {
      alert('Please enter a valid URL (e.g., https://example.com)');
    }
  };

  const handleQuickScanRemote = async (url) => {
    const scanStartTime = Date.now();
    setScanning(true);
    setDeepScanProgress(null);

    try {
      // Use backend API for remote URL scanning
      // Quick Scan timeout: 120 seconds (2 minutes)
      const response = await fetchWithTimeout(
        'http://localhost:8001/api/scan',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            scanType: 'quick',
            maxPages: 1,
            concurrency: 1,
            maxDepth: 1
          })
        },
        120000 // 120 seconds (2 minutes) timeout
      );

      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }

      const results = await response.json();

      // Calculate scan duration
      const scanEndTime = Date.now();
      const scanDuration = scanEndTime - scanStartTime;

      const enhancedResults = {
        ...results,
        scanDuration: scanDuration
      };

      setScanResult(enhancedResults);
      addToHistory(enhancedResults);
      setScanning(false);

      // Classify cookies with ML in the background
      if (results.cookies && results.cookies.length > 0) {
        const mlClassifications = await classifyCookiesWithML(results.cookies);
        
        if (mlClassifications) {
          const updatedCookies = results.cookies.map((cookie, idx) => {
            const mlData = mlClassifications[idx];
            
            // Keep original category from scan, add ML prediction separately
            if (mlData && mlData.predicted_category) {
              // Only update category if it was Uncategorized from the scan
              const finalCategory = cookie.category === 'Uncategorized' 
                ? mlData.predicted_category 
                : cookie.category;
              
              // Hybrid confidence boost: If rule-based and ML agree, boost confidence
              const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);
              
              return {
                ...cookie,
                originalCategory: cookie.category, // Store original scan result
                category: finalCategory, // Update only if Uncategorized
                mlClassification: mlData.predicted_category, // Always show ML prediction
                mlConfidence: adjustedConfidence,
                mlConfidenceLevel: adjustedLevel,
                websiteProvided: false,
                categorySource: cookie.category === 'Uncategorized' ? 'ml' : 'rules'
              };
            } else {
              // No ML data available
              return {
                ...cookie,
                originalCategory: cookie.category,
                mlClassification: 'Unclassified',
                mlConfidence: 0.0,
                mlConfidenceLevel: 'Low',
                websiteProvided: false,
                categorySource: 'rules'
              };
            }
          });
          
          const updatedResults = {
            ...enhancedResults,
            cookies: updatedCookies
          };
          
          setScanResult(updatedResults);
          
          // Re-calculate statistics with updated categories
          const updatedStats = calculateStatistics(updatedCookies);
          const finalResults = {
            ...updatedResults,
            statistics: updatedStats
          };
          
          setScanResult(finalResults);
        }
      }
    } catch (error) {
      alert('Quick scan failed: ' + error.message);
      setScanning(false);
    }
  };

  const compareScanResults = (newResults, previousScan) => {
    if (!previousScan) {
      return null;
    }

    const differences = {
      totalCookies: (newResults.totalCount || 0) - (previousScan.totalCookies || 0),
      requiresConsent: (newResults.statistics?.requiresConsent || 0) - (previousScan.requiresConsent || 0),
      thirdParty: (newResults.statistics?.thirdParty || 0) - (previousScan.thirdParty || 0),
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
      }
    });

    // Find new and removed cookies
    const previousCookieNames = new Set(previousScan.fullResults?.cookies?.map(c => c.name) || []);
    const currentCookieNames = new Set(newResults.cookies?.map(c => c.name) || []);

    differences.newCookies = newResults.cookies?.filter(c => !previousCookieNames.has(c.name)) || [];
    differences.removedCookies = previousScan.fullResults?.cookies?.filter(c => !currentCookieNames.has(c.name)) || [];

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
      ...calculateComplianceRisks(results.cookies, results.statistics),
      scanType: results.scanType || 'quick',
      fullResults: cleanResults // Store cleaned results for detailed view
    };

    // Add to domain-based history
    setDomainHistory(prev => {
      const domain = results.domain;
      const updated = {
        ...prev,
        [domain]: [historyEntry, ...(prev[domain] || [])]
      };
      
      try {
        localStorage.setItem('domainScanHistory', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save domain history:', e);
      }
      
      return updated;
    });

    setScanHistory(prev => {
      // Find previous scan for the same domain (most recent one)
      const previousScan = prev.find(scan => scan.domain === results.domain);

      if (previousScan) {
        const comparison = compareScanResults(results, previousScan);

        // Show notification if there are differences
        if (comparison && (
          comparison.totalCookies !== 0 ||
          comparison.newCookies.length > 0 ||
          comparison.removedCookies.length > 0 ||
          Object.keys(comparison.categories).length > 0 ||
          Object.keys(comparison.types).length > 0
        )) {
          showScanComparison(comparison);
        }
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
  
  const formatCountdown = (ms) => {
    if (!ms || ms <= 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatScanDuration = (ms) => {
    if (!ms || ms <= 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else if (seconds > 0) {
      return `${seconds}s`;
    } else {
      return `${ms}ms`;
    }
  };

  const startScheduledScanning = () => {
    // Validate URL is provided
    if (!targetUrl) {
      alert('Please enter a URL to scan');
      return;
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch (e) {
      alert('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setScheduleEnabled(true);
    const intervalMs = getIntervalInMs();
    const nextScan = new Date(Date.now() + intervalMs);
    setNextScanTime(nextScan);

    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current);
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Update countdown every second
    countdownTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeLeft = nextScan.getTime() - now;
      if (timeLeft > 0) {
        setTimeUntilNextScan(timeLeft);
      } else {
        setTimeUntilNextScan(0);
      }
    }, 1000);

    // Run first scan immediately
    console.log(`🕐 Starting scheduled scan for ${targetUrl}`);
    handleQuickScanRemote(targetUrl);

    // Schedule recurring scans
    scheduleTimerRef.current = setInterval(() => {
      console.log(`🕐 Running scheduled scan for ${targetUrl}`);
      handleQuickScanRemote(targetUrl);
      const nextScan = new Date(Date.now() + intervalMs);
      setNextScanTime(nextScan);
    }, intervalMs);
  };

  const stopScheduledScanning = () => {
    setScheduleEnabled(false);
    setNextScanTime(null);
    setTimeUntilNextScan(null);

    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
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
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Domain history functions
  const deleteScanFromDomain = (scanId) => {
    setDomainHistory(prev => {
      const updated = { ...prev };
      
      // Find and remove the scan from its domain
      for (const domain in updated) {
        updated[domain] = updated[domain].filter(scan => scan.id !== scanId);
        // Remove domain if no scans left
        if (updated[domain].length === 0) {
          delete updated[domain];
        }
      }
      
      try {
        localStorage.setItem('domainScanHistory', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update domain history:', e);
      }
      
      return updated;
    });
    
    // Also remove from regular history
    deleteScan(scanId);
  };

  const deleteDomain = (domain) => {
    setDomainHistory(prev => {
      const updated = { ...prev };
      const scansToDelete = updated[domain] || [];
      
      // Remove from regular history too
      scansToDelete.forEach(scan => deleteScan(scan.id));
      
      delete updated[domain];
      
      try {
        localStorage.setItem('domainScanHistory', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update domain history:', e);
      }
      
      return updated;
    });
  };

  /**
   * Category update handler for ML Classification dropdown
   * 
   * This function handles category updates initiated from the ML Classification dropdown.
   * It implements optimistic UI updates for better UX, then persists the change to the backend.
   * If the API call fails, it reverts the UI to the previous state.
   * 
   * @param {string} cookieName - Name of the cookie to update
   * @param {string} cookieDomain - Domain of the cookie to update
   * @param {string} newCategory - The new category to assign to the cookie
   */
  const handleMLCategoryUpdate = async (cookieName, cookieDomain, newCategory) => {
    // Find the cookie in the current scan results
    const cookie = scanResult.cookies.find(
      c => c.name === cookieName && c.domain === cookieDomain
    );
    
    // Guard: Cookie not found in results
    if (!cookie) {
      return;
    }
    
    const oldCategory = cookie.category;
    
    // Guard: Skip update if category hasn't changed
    if (oldCategory === newCategory) {
      return;
    }
    
    // Announce update start for screen readers (accessibility)
    setAriaLiveMessage(`Updating category for ${cookieName} from ${oldCategory} to ${newCategory}`);
    
    // Step 1: Optimistically update UI immediately for better perceived performance
    // This makes the UI feel responsive while the API call is in progress
    const updatedCookies = scanResult.cookies.map(c => {
      if (c.name === cookieName && c.domain === cookieDomain) {
        return { ...c, category: newCategory };
      }
      return c;
    });
    
    setScanResult({ ...scanResult, cookies: updatedCookies });
    
    // Step 2: Persist the change to the backend via API call
    try {
      const response = await fetch('http://localhost:8000/api/categories/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_id: scanResult.scannedAt || Date.now().toString(),
          cookie_name: cookieName,
          cookie_domain: cookieDomain,
          old_category: oldCategory,
          new_category: newCategory
        })
      });
      
      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update category: ${response.status} ${errorText}`);
      }
      
      await response.json();
      
      // Announce success for screen readers
      setAriaLiveMessage(`Category successfully updated to ${newCategory} for ${cookieName}`);
      setTimeout(() => setAriaLiveMessage(''), 3000);
    } catch (error) {
      // Step 3: Revert UI to previous state on error (rollback optimistic update)
      const revertedCookies = scanResult.cookies.map(c => {
        if (c.name === cookieName && c.domain === cookieDomain) {
          return { ...c, category: oldCategory };
        }
        return c;
      });
      setScanResult({ ...scanResult, cookies: revertedCookies });
      
      // Announce error for screen readers
      setAriaLiveMessage(`Failed to update category for ${cookieName}: ${error.message}`);
      setTimeout(() => setAriaLiveMessage(''), 3000);
      
      // Show user-facing error message
      alert('Failed to update category: ' + error.message);
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
            <img 
              src="https://cdn.prod.website-files.com/646e363f9c29e4860c52c82e/665f4b9f47a7740de833d1c2_Final%20Data%20Safeguard%20Logo.svg" 
              alt="Data Safeguard" 
              className="logo-image"
            />
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
            <section className="scan-controls-compact">
              <div className="scan-compact-wrapper">
                <div className="scan-mode-selector">
                  <button
                    className={`mode-btn ${scanMode === 'quick' ? 'active' : ''}`}
                    onClick={() => setScanMode('quick')}
                    disabled={scanning}
                  >
                    <Zap size={16} />
                    <span>Quick</span>
                  </button>
                  <button
                    className={`mode-btn ${scanMode === 'deep' ? 'active' : ''}`}
                    onClick={() => setScanMode('deep')}
                    disabled={scanning}
                  >
                    <Layers size={16} />
                    <span>Deep</span>
                  </button>
                  <button
                    className={`mode-btn ${scanMode === 'schedule' ? 'active' : ''}`}
                    onClick={() => setScanMode('schedule')}
                    disabled={scanning}
                  >
                    <Clock size={16} />
                    <span>Schedule</span>
                  </button>
                </div>

                <div className="scan-input-row">
                  <input
                    type="text"
                    placeholder={scanMode === 'quick' ? 'Enter URL or leave empty for current page' : 'Enter website URL (e.g., https://example.com)'}
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="scan-url-input"
                    onKeyPress={(e) => e.key === 'Enter' && !scanning && handleUrlScan()}
                    disabled={scanning}
                  />
                  
                  {scanMode === 'deep' && (
                    <input
                      type="number"
                      placeholder="Pages"
                      min="1"
                      max="20000"
                      value={maxPages}
                      onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                      disabled={scanning}
                      className="scan-pages-input"
                      title="Maximum pages to scan"
                    />
                  )}
                  
                  <button
                    onClick={() => scanMode === 'deep' ? handleUrlScan() : (targetUrl ? handleUrlScan() : handleQuickScan())}
                    disabled={scanning}
                    className="btn-scan-compact"
                  >
                    <RefreshCw className={`icon ${scanning ? 'spinning' : ''}`} size={18} />
                    {scanning ? 'Scanning...' : 'Scan'}
                  </button>
                </div>

                {!scanning && !targetUrl && scanMode === 'quick' && (
                  <div className="scan-hint">
                    <Globe size={12} />
                    <span>Current: {window.location.hostname}</span>
                  </div>
                )}

                {scanMode === 'schedule' && (
                  <div className="schedule-compact">
                    {!scheduleEnabled && (
                      <div className="schedule-url-hint">
                        <Globe size={14} />
                        <span>Enter a URL above to schedule recurring scans</span>
                      </div>
                    )}
                    <div className="schedule-inputs-row">
                      <span className="schedule-label">Scan every</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={scheduleInterval}
                        onChange={(e) => setScheduleInterval(parseInt(e.target.value) || 1)}
                        className="schedule-number-input"
                        disabled={scheduleEnabled}
                      />
                      <select
                        value={scheduleUnit}
                        onChange={(e) => setScheduleUnit(e.target.value)}
                        className="schedule-unit-select"
                        disabled={scheduleEnabled}
                      >
                        <option value="minutes">Minute(s)</option>
                        <option value="hourly">Hour(s)</option>
                        <option value="daily">Day(s)</option>
                        <option value="weekly">Week(s)</option>
                        <option value="monthly">Month(s)</option>
                      </select>
                      {!scheduleEnabled ? (
                        <button 
                          onClick={startScheduledScanning} 
                          className="btn-schedule-action start"
                          disabled={!targetUrl}
                          title={!targetUrl ? "Enter a URL first" : "Start scheduled scanning"}
                        >
                          <Play size={16} />
                          Start
                        </button>
                      ) : (
                        <button onClick={stopScheduledScanning} className="btn-schedule-action stop">
                          <Pause size={16} />
                          Stop
                        </button>
                      )}
                    </div>
                    {scheduleEnabled && nextScanTime && (
                      <div className="schedule-next-scan">
                        <Clock size={12} />
                        <div className="schedule-countdown-info">
                          <span className="countdown-label">Next scan in:</span>
                          <span className="countdown-timer">{formatCountdown(timeUntilNextScan)}</span>
                          <span className="countdown-date">({nextScanTime.toLocaleString()})</span>
                        </div>
                      </div>
                    )}
                    {scheduleEnabled && targetUrl && (
                      <div className="schedule-active-url">
                        <Globe size={12} />
                        <span>Scanning: <strong>{targetUrl}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {deepScanProgress && (
                    <div className="audit-progress-slim">
                      <div className="audit-slim-header">
                        <div className="audit-slim-status">
                          <div className="status-indicator"></div>
                          <span className="status-text">Auto-refreshing</span>
                        </div>
                        <div className="audit-slim-stats">
                          <div className="stat-item">
                            <span className="stat-label">Scan Duration per Page:</span>
                            <span className="stat-value">{deepScanProgress.avgTimePerPage || '0.5 sec'}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Scan Duration:</span>
                            <span className="stat-value">{deepScanProgress.totalDuration || '0 min, 0 sec'}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Pages scanned:</span>
                            <span className="stat-value-large">{deepScanProgress.current}</span>
                          </div>
                        </div>
                      </div>

                      <div className="audit-slim-content">
                        <h3 className="audit-slim-title">
                          {deepScanProgress.status === 'complete' 
                            ? 'Congrats, your audit is complete - here are the results' 
                            : 'Congrats, your audit is underway - here are the preliminary results'}
                        </h3>
                        <p className="audit-slim-subtitle">
                          Digging into the tags - they're telling quite a story.
                        </p>
                      </div>

                      <div className="audit-slim-progress">
                        <div className="progress-info">
                          <span className="progress-label">Scanning Pages</span>
                          <span className="progress-count">{deepScanProgress.current} / {deepScanProgress.total}</span>
                        </div>
                        <div className="progress-bar-track">
                          <div 
                            className="progress-bar-fill"
                            style={{ width: `${(deepScanProgress.current / deepScanProgress.total) * 100}%` }}
                          >
                            <div className="progress-indicator-dot"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

            </section>

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



            {scanResult && (
              <>
                {/* Slim Results Header */}
                <section className="results-header-slim">
                  <div className="results-title-row">
                    <h2 className="results-title">
                      {scanning ? 'Scan in progress - here are the preliminary results' : 'Scan complete - here are your results'}
                    </h2>
                  </div>
                  
                  <div className="results-meta-row">
                    <span className="meta-item">
                      <span className="meta-label">Domain:</span>
                      <span className="meta-value">{scanResult.domain}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-label">Scanned:</span>
                      <span className="meta-value">{new Date(scanResult.scannedAt).toLocaleString()}</span>
                    </span>
                    <span className="meta-item">
                      <span className="meta-label">Scan Type:</span>
                      <span className="meta-value">{scanResult.scanType === 'deep' ? 'Deep Scan' : scanResult.scanType === 'quick' ? 'Quick Scan' : 'Scheduled Scan'}</span>
                    </span>
                    {scanResult.scanType === 'deep' && scanResult.pageResults && (
                      <span className="meta-item">
                        <span className="meta-label">Pages Scanned:</span>
                        <span className="meta-value">{scanResult.pageResults.length}</span>
                      </span>
                    )}
                  </div>

                  {/* Slim Stats Grid */}
                  <div className="results-stats-grid">
                    <div className="stat-card-slim">
                      <span className="stat-card-label">TOTAL COOKIES</span>
                      <span className="stat-card-value">{scanResult.totalCount || scanResult.cookies?.length || 0}</span>
                    </div>
                    <div className="stat-card-slim">
                      <span className="stat-card-label">CATEGORIES</span>
                      <span className="stat-card-value">{Object.keys(scanResult.statistics?.byCategory || {}).length}</span>
                    </div>
                    <div className="stat-card-slim">
                      <span className="stat-card-label">THIRD PARTY</span>
                      <span className="stat-card-value">{scanResult.statistics?.thirdParty || 0}</span>
                    </div>
                    <div className="stat-card-slim">
                      <span className="stat-card-label">REQUIRE CONSENT</span>
                      <span className="stat-card-value">{scanResult.statistics?.requiresConsent || 0}</span>
                    </div>
                    {scanResult.scanDuration && (
                      <div className="stat-card-slim">
                        <span className="stat-card-label">TIME TAKEN</span>
                        <span className="stat-card-value">{formatScanDuration(scanResult.scanDuration)}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Tabbed Data Section */}
                <section className="audit-data-section">
                  <div className="audit-tabs">
                    <button
                      className={`audit-tab ${resultsTab === 'cookies' ? 'active' : ''}`}
                      onClick={() => setResultsTab('cookies')}
                    >
                      <Cookie size={18} />
                      <span className="tab-label">COOKIES</span>
                      <span className="tab-count">{scanResult.totalCount || scanResult.cookies?.length || 0}</span>
                    </button>
                    <button
                      className={`audit-tab ${resultsTab === 'categories' ? 'active' : ''}`}
                      onClick={() => setResultsTab('categories')}
                    >
                      <Layers size={18} />
                      <span className="tab-label">CATEGORIES</span>
                      <span className="tab-count">{Object.keys(scanResult.statistics?.byCategory || {}).length}</span>
                    </button>
                    {scanResult.scanType === 'deep' && scanResult.pageResults && (
                      <button
                        className={`audit-tab ${resultsTab === 'pages' ? 'active' : ''}`}
                        onClick={() => setResultsTab('pages')}
                      >
                        <Globe size={18} />
                        <span className="tab-label">PAGES</span>
                        <span className="tab-count">{scanResult.pageResults.length}</span>
                      </button>
                    )}
                    <button
                      className={`audit-tab ${resultsTab === 'vendors' ? 'active' : ''}`}
                      onClick={() => setResultsTab('vendors')}
                    >
                      <Globe size={18} />
                      <span className="tab-label">VENDORS</span>
                      <span className="tab-count">{new Set((scanResult.cookies || []).map(c => c.domain)).size}</span>
                    </button>
                  </div>

                  {/* Cookies Tab */}
                  {resultsTab === 'cookies' && (
                    <div className="audit-table-container">
                      <table className="audit-table">
                        <thead>
                          <tr>
                            <th className="col-icon"></th>
                            <th className="col-name">COOKIE NAME</th>
                            <th className="col-vendor">DOMAIN</th>
                            <th className="col-category">CATEGORY</th>
                            <th className="col-ml-classification">ML CLASSIFICATION</th>
                            <th className="col-confidence">CONFIDENCE</th>
                            <th className="col-type">TYPE</th>
                            <th className="col-consent">CONSENT</th>
                            <th className="col-party">PARTY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scanResult.cookies.map((cookie, idx) => (
                            <tr key={idx} className="audit-table-row">
                              <td className="col-icon">
                                <Cookie size={16} className="cookie-icon" />
                              </td>
                              <td className="col-name">
                                <span className="cookie-name-text">{cookie.name}</span>
                              </td>
                              <td className="col-vendor">{cookie.domain}</td>
                              <td className="col-category">
                                <span 
                                  className={`category-badge category-${((cookie.originalCategory || cookie.category) || 'uncategorized').toLowerCase().replace(/\s+/g, '-')}`}
                                  role="status"
                                  aria-label={`Cookie category: ${(cookie.originalCategory || cookie.category) || 'Uncategorized'}`}
                                >
                                  {(cookie.originalCategory || cookie.category) || 'Uncategorized'}
                                </span>
                              </td>
                              <td className="col-ml-classification">
                                {cookie.mlClassification ? (
                                  <MLClassificationDropdown
                                    currentMLClassification={cookie.mlClassification}
                                    actualCategory={cookie.category}
                                    mlConfidence={cookie.mlConfidence}
                                    mlConfidenceLevel={cookie.mlConfidenceLevel}
                                    cookieName={cookie.name}
                                    cookieDomain={cookie.domain}
                                    scanId={scanResult.scannedAt || Date.now().toString()}
                                    onCategoryUpdate={handleMLCategoryUpdate}
                                  />
                                ) : (
                                  <span className="ml-badge ml-pending">Analyzing...</span>
                                )}
                              </td>
                              <td className="col-confidence">
                                {cookie.mlConfidence !== undefined ? (
                                  <ConfidenceBadge
                                    confidence={cookie.mlConfidence}
                                    confidenceLevel={cookie.mlConfidenceLevel || 'Low'}
                                    cookieName={cookie.name}
                                    mlClassification={cookie.mlClassification}
                                    actualCategory={cookie.originalCategory || cookie.category}
                                    onConfirm={handleConfidenceConfirm}
                                    onIgnore={handleConfidenceIgnore}
                                  />
                                ) : (
                                  <span className="confidence-badge confidence-pending">--</span>
                                )}
                              </td>
                              <td className="col-type">
                                <span className="type-badge">{cookie.type}</span>
                              </td>
                              <td className="col-consent">
                                {cookie.requiresConsent ? (
                                  <span className="consent-yes">Required</span>
                                ) : (
                                  <span className="consent-no">Not Required</span>
                                )}
                              </td>
                              <td className="col-party">
                                {cookie.isThirdParty ? (
                                  <span className="party-third">3rd Party</span>
                                ) : (
                                  <span className="party-first">1st Party</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="audit-table-footer">
                        <span>Total Rows: {scanResult.totalCount}</span>
                      </div>
                    </div>
                  )}

                  {/* Categories Tab */}
                  {resultsTab === 'categories' && (
                    <div className="audit-table-container">
                      <table className="audit-table">
                        <thead>
                          <tr>
                            <th className="col-icon"></th>
                            <th className="col-category-name">CATEGORY</th>
                            <th className="col-count">TOTAL COOKIES</th>
                            <th className="col-consent">REQUIRE CONSENT</th>
                            <th className="col-party">THIRD PARTY</th>
                            <th className="col-percentage">PERCENTAGE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(scanResult.statistics.byCategory).map(([category, count]) => {
                            const categoryCookies = scanResult.cookies.filter(c => c.category === category);
                            const consentCount = categoryCookies.filter(c => c.requiresConsent).length;
                            const thirdPartyCount = categoryCookies.filter(c => c.isThirdParty).length;
                            const percentage = Math.round((count / scanResult.totalCount) * 100);

                            return (
                              <tr key={category} className="audit-table-row">
                                <td className="col-icon">
                                  <Layers size={16} className="category-icon" />
                                </td>
                                <td className="col-category-name">
                                  <span className={`category-badge category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {category}
                                  </span>
                                </td>
                                <td className="col-count">
                                  <span className="count-value">{count}</span>
                                </td>
                                <td className="col-consent">
                                  <span className="count-value">{consentCount}</span>
                                </td>
                                <td className="col-party">
                                  <span className="count-value">{thirdPartyCount}</span>
                                </td>
                                <td className="col-percentage">
                                  <div className="percentage-bar-container">
                                    <div className="percentage-bar" style={{ width: `${percentage}%` }}></div>
                                  </div>
                                  <span className="percentage-text">{percentage}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="audit-table-footer">
                        <span>Total Rows: {Object.keys(scanResult.statistics.byCategory).length}</span>
                      </div>
                    </div>
                  )}

                  {/* Pages Tab */}
                  {resultsTab === 'pages' && scanResult.pageResults && (
                    <div className="audit-table-container">
                      <table className="audit-table">
                        <thead>
                          <tr>
                            <th className="col-icon"></th>
                            <th className="col-page-url">PAGE URL</th>
                            <th className="col-count">COOKIES</th>
                            <th className="col-initiators">INITIATORS</th>
                            <th className="col-duration">DURATION</th>
                            <th className="col-secure">SECURE</th>
                            <th className="col-httponly">HTTPONLY</th>
                            <th className="col-method">METHOD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scanResult.pageResults.map((page, idx) => (
                            <tr key={idx} className="audit-table-row">
                              <td className="col-icon">
                                <Globe size={16} className="page-icon" />
                              </td>
                              <td className="col-page-url">
                                <a href={page.url} target="_blank" rel="noopener noreferrer" className="page-url-link">
                                  {page.url}
                                </a>
                              </td>
                              <td className="col-count">
                                <span className="count-value">{page.cookieCount || page.cookies?.length || 0}</span>
                              </td>
                              <td className="col-initiators">
                                <span className="count-value">{page.initiators?.length || 0}</span>
                              </td>
                              <td className="col-duration">
                                <span className="duration-value">{page.duration || 'N/A'}</span>
                              </td>
                              <td className="col-secure">
                                <span className={page.cookies?.some(c => c.secure) ? 'status-yes' : 'status-no'}>
                                  {page.cookies?.filter(c => c.secure).length || 0}
                                </span>
                              </td>
                              <td className="col-httponly">
                                <span className={page.cookies?.some(c => c.httpOnly) ? 'status-yes' : 'status-no'}>
                                  {page.cookies?.filter(c => c.httpOnly).length || 0}
                                </span>
                              </td>
                              <td className="col-method">
                                <span className="method-badge">{page.method || 'Page Load'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="audit-table-footer">
                        <span>Total Pages: {scanResult.pageResults.length}</span>
                      </div>
                    </div>
                  )}

                  {/* Vendors Tab */}
                  {resultsTab === 'vendors' && (
                    <div className="audit-table-container">
                      <table className="audit-table">
                        <thead>
                          <tr>
                            <th className="col-icon"></th>
                            <th className="col-vendor-name">DOMAIN/VENDOR</th>
                            <th className="col-count">TOTAL COOKIES</th>
                            <th className="col-category">MAIN CATEGORY</th>
                            <th className="col-party">PARTY TYPE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(new Set(scanResult.cookies.map(c => c.domain))).map(domain => {
                            const domainCookies = scanResult.cookies.filter(c => c.domain === domain);
                            const mainCategory = domainCookies.reduce((acc, c) => {
                              acc[c.category] = (acc[c.category] || 0) + 1;
                              return acc;
                            }, {});
                            const topCategory = Object.entries(mainCategory).sort((a, b) => b[1] - a[1])[0][0];
                            const isThirdParty = domainCookies[0].isThirdParty;

                            return (
                              <tr key={domain} className="audit-table-row">
                                <td className="col-icon">
                                  <Globe size={16} className="vendor-icon" />
                                </td>
                                <td className="col-vendor-name">
                                  <span className="vendor-name-text">{domain}</span>
                                </td>
                                <td className="col-count">
                                  <span className="count-value">{domainCookies.length}</span>
                                </td>
                                <td className="col-category">
                                  <span className={`category-badge category-${topCategory.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {topCategory}
                                  </span>
                                </td>
                                <td className="col-party">
                                  {isThirdParty ? (
                                    <span className="party-third">3rd Party</span>
                                  ) : (
                                    <span className="party-first">1st Party</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="audit-table-footer">
                        <span>Total Rows: {new Set(scanResult.cookies.map(c => c.domain)).size}</span>
                      </div>
                    </div>
                  )}

                  {/* Compliance Tab */}
                  {resultsTab === 'compliance' && (
                    <div className="audit-table-container">
                      <div className="stats-grid">
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
                    </div>
                  )}
                </section>

                {Object.keys(domainHistory).length > 0 && (
                  <section className="history-section">
                    <DomainScanHistory
                      domainHistory={domainHistory}
                      onViewScan={viewScan}
                      onDeleteScan={deleteScanFromDomain}
                      onDeleteDomain={deleteDomain}
                    />
                  </section>
                )}

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

      {/* Accessibility - aria-live region for category update announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {ariaLiveMessage}
      </div>
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

export default App;
