import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Shield, Cookie, AlertCircle, Download, RefreshCw, Eye, EyeOff, Globe, Clock, Play, Pause, Trash2, Bookmark, Copy, Check, Zap, Layers, X, Info, Pencil, History, TrendingUp, TrendingDown } from 'lucide-react';
import CookieScanner from './lib/CookieScanner';
import DeepScanner from './lib/DeepScanner';
import { generateBookmarklet, copyToClipboard } from './lib/utils';
import { calculateComplianceRisks } from './lib/riskCalculator';
import Navbar from './components/Navbar';
import LeftSidebar from './components/LeftSidebar';
import ScanHistory from './components/ScanHistory';
import DomainScanHistory from './components/DomainScanHistory';
import ScanHistoryPage from './components/ScanHistoryPage';
import CompareScanPage from './components/CompareScanPage';
import ReportsPage from './components/ReportsPage';
import ReviewQueuePage from './components/ReviewQueuePage';
import MLClassificationDropdown from './components/MLClassificationDropdown';
import ConfidenceBadge from './components/ConfidenceBadge';
import CookieDetailModal from './components/CookieDetailModal';
import VendorDashboard from './components/VendorDashboard';
import OverrideModal from './components/OverrideModal';
import AutoPublishPage from './components/AutoPublishPage';
import ScheduledScanPage from './components/ScheduledScanPage';
import MyWebsitesPage from './components/MyWebsitesPage';
import ModelPerformancePage from './components/ModelPerformancePage';
import './App.css';

function Tooltip({ text, children }) {
  return (
    <span className="tooltip-wrapper">
      {children}
      <span className="tooltip-bubble" role="tooltip">{text}</span>
    </span>
  );
}

function App() {
  const [scanner] = useState(() => new CookieScanner());
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRegulation, setFilterRegulation] = useState('all');
  const [filterParty, setFilterParty] = useState('all'); // all, first, third
  const [selectedCookie, setSelectedCookie] = useState(null); // for cookie detail modal
  const [overrideCookie, setOverrideCookie] = useState(null); // for override modal

  // URL Scanning
  const [targetUrl, setTargetUrl] = useState('');
  const [scanMode, setScanMode] = useState('quick');

  // Deep Scan - Industry Grade Configuration
  const [deepScanner] = useState(() => new DeepScanner());
  const [maxPages, setMaxPages] = useState(10);  // Default to 10 pages
  const [concurrency, setConcurrency] = useState(20);  // Default to 20 concurrent
  const [maxDepth, setMaxDepth] = useState(3);  // Default depth 3
  const [deepScanProgress, setDeepScanProgress] = useState(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const deepScannerRef = useRef(null);

  // Scheduled Scanning
  const [scheduleScanType, setScheduleScanType] = useState('quick');
  const [scheduleInterval, setScheduleInterval] = useState(30);
  const [scheduleUnit, setScheduleUnit] = useState('minutes');
  const [scheduleDay, setScheduleDay] = useState('sunday');
  const [scheduleDate, setScheduleDate] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduledJobs, setScheduledJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('scheduledJobs');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map(j => ({ ...j, timerId: null, countdownId: null, timeLeft: null })) : [];
    } catch (e) {
      return [];
    }
  });
  const jobTimersRef = useRef({});
  const [editingJobId, setEditingJobId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [scanHistory, setScanHistory] = useState(() => {
    // Load history from localStorage on initial render (with pruning)
    try {
      const saved = localStorage.getItem('cookieScanHistory');
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        console.warn('Invalid scan history format, resetting');
        localStorage.removeItem('cookieScanHistory');
        return [];
      }
      // Cap to 50 entries and strip fullResults from old ones
      const pruned = parsed.slice(0, 50).map((entry, i) =>
        i === 0 ? entry : { ...entry, fullResults: undefined }
      );
      try { localStorage.setItem('cookieScanHistory', JSON.stringify(pruned)); } catch (e) { /* noop */ }
      return pruned;
    } catch (e) {
      console.error('Failed to load scan history:', e);
      localStorage.removeItem('cookieScanHistory');
      return [];
    }
  });

  // Domain-based scan history (with startup pruning)
  const [domainHistory, setDomainHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('domainScanHistory');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      // Prune on load: cap entries per domain, strip fullResults from old entries
      const pruned = {};
      for (const [domain, scans] of Object.entries(parsed)) {
        if (!Array.isArray(scans)) continue;
        pruned[domain] = scans.slice(0, 10).map((entry, i) =>
          i === 0 ? entry : { ...entry, fullResults: undefined }
        );
      }
      // Save the pruned version back
      try { localStorage.setItem('domainScanHistory', JSON.stringify(pruned)); } catch (e) { /* noop */ }
      return pruned;
    } catch (e) {
      console.error('Failed to load domain history:', e);
      localStorage.removeItem('domainScanHistory');
      return {};
    }
  });

  // Bookmarklet
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);

  // Left sidebar
  const [sidebarPinned, setSidebarPinned] = useState(false);

  // Persistent notification list
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Page-based routing (home = main scanner view, history = scan history page, compare = compare scans page)
  const [currentPage, setCurrentPage] = useState('home');

  const handleNavigate = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // Handle classification override
  const handleOverrideApply = ({ cookie, newCategory, reason, similarCookies }) => {
    if (!scanResult) return;
    const updatedCookies = scanResult.cookies.map(c => {
      const shouldUpdate =
        (c.name === cookie.name && c.domain === cookie.domain) ||
        (similarCookies.includes(c.name) && c.domain === cookie.domain);
      if (shouldUpdate) {
        return {
          ...c,
          originalCategory: c.originalCategory || c.category,
          category: newCategory,
          mlClassification: newCategory,
          overridden: true,
          overrideReason: reason,
          overriddenAt: new Date().toISOString(),
        };
      }
      return c;
    });
    setScanResult(prev => ({ ...prev, cookies: updatedCookies }));
    setOverrideCookie(null);
    setSelectedCookie(null);
  };

  // Helper function to normalize category names from ML API
  const normalizeCategory = (category) => {
    const mapping = {
      'Analytics_Performance': 'Analytics',
      'Marketing_Advertising': 'Marketing',
      'Strictly_Necessary': 'Strictly Necessary',
      'Functional': 'Functional',
      'Unclassified': 'Unclassified',
      'Unknown': 'Unclassified'
    };
    return mapping[category] || category;
  };

  // Rule-based fallback classifier for when ML returns Unclassified/Unknown
  const ruleBasedClassify = (cookie) => {
    const name = (cookie.name || '').toLowerCase();
    const domain = (cookie.domain || '').toLowerCase();

    if (name.startsWith('_ga') || name === '_gid' || name === '_gat' ||
        name.includes('analytics') || name.includes('_utm') || name.includes('stat')) {
      return 'Analytics';
    }
    if (name.includes('_fb') || name.includes('fbp') || name.includes('fbc') ||
        name.includes('ads') || name.includes('marketing') || name.includes('track') ||
        name.includes('campaign') || name.includes('utm_') || name.startsWith('__gads')) {
      return 'Marketing';
    }
    if (name.includes('session') || name.includes('csrf') || name.includes('xsrf') ||
        name.includes('auth') || name.includes('token') || name.includes('login') ||
        name.includes('secure') || name.includes('captcha')) {
      return 'Strictly Necessary';
    }
    if (name.includes('pref') || name.includes('lang') || name.includes('locale') ||
        name.includes('theme') || name.includes('timezone') || name.includes('currency')) {
      return 'Functional';
    }
    if (domain.includes('google') || domain.includes('doubleclick') || domain.includes('googlesyndication')) {
      return name.includes('consent') || name.includes('nid') ? 'Functional' : 'Analytics';
    }
    if (domain.includes('facebook') || domain.includes('fb.com')) return 'Marketing';
    if (domain.includes('linkedin')) return 'Marketing';
    return 'Functional'; // safer default than Unclassified
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
        '/api/v1/ml/classify',
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
            // Normalize category name (handle model v6.0.0 format)
            let normalizedPrediction = normalizeCategory(mlData.predicted_category);

            // If ML returned Unclassified, fall back to rule-based classification
            if (normalizedPrediction === 'Unclassified') {
              normalizedPrediction = ruleBasedClassify(cookie);
            }

            // Only update category if it was Uncategorized from the scan
            const finalCategory = cookie.category === 'Uncategorized'
              ? normalizedPrediction
              : cookie.category;

            // Hybrid confidence boost: If rule-based and ML agree, boost confidence
            const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);

            return {
              ...cookie,
              originalCategory: cookie.category, // Store original scan result
              category: finalCategory, // Update only if Uncategorized
              mlClassification: normalizedPrediction, // Always show ML prediction (normalized)
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
              mlClassification: ruleBasedClassify(cookie),
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
    setScanError(null);
    setIsDeepScanning(true);
    setScanning(true);
    setDeepScanProgress(null);

    try {
      const targetUrl = url || window.location.href;
      const deepScannerInstance = new DeepScanner({
        maxPages,
        concurrency,
        maxDepth  // Pass maxDepth to backend
      });
      deepScannerRef.current = deepScannerInstance;

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

      const deepScanId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const enhancedResults = {
        ...results,
        domain: domain, // Override with actual scanned domain
        scannedUrl: targetUrl,
        scanType: 'deep',
        scanDuration: scanDuration,
        _scanId: deepScanId
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
              let normalizedML = normalizeCategory(mlData.predicted_category);
              if (normalizedML === 'Unclassified') normalizedML = ruleBasedClassify(cookie);

              // Only update category if it was Uncategorized from the scan
              const finalCategory = cookie.category === 'Uncategorized'
                ? normalizedML
                : cookie.category;

              // Hybrid confidence boost: If rule-based and ML agree, boost confidence
              const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);

              return {
                ...cookie,
                originalCategory: cookie.category, // Store original scan result
                category: finalCategory, // Update only if Uncategorized
                mlClassification: normalizedML, // Always show ML prediction (normalized)
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
                mlClassification: ruleBasedClassify(cookie),
                mlConfidence: 0.0,
                mlConfidenceLevel: 'Low',
                websiteProvided: false,
                categorySource: 'rules'
              };
            }
          });

          // Build a lookup map: name+domain -> ML-enriched cookie
          const mlCookieMap = {};
          updatedCookies.forEach(c => { mlCookieMap[`${c.name}||${c.domain}`] = c; });

          // Propagate ML data into pageResults cookies
          const updatedPageResults = (enhancedResults.pageResults || []).map(page => ({
            ...page,
            cookies: (page.cookies || []).map(c => {
              const enriched = mlCookieMap[`${c.name}||${c.domain}`];
              return enriched ? { ...c, ...enriched } : c;
            })
          }));

          const updatedResults = {
            ...enhancedResults,
            cookies: updatedCookies,
            pageResults: updatedPageResults
          };

          setScanResult(updatedResults);

          // Re-calculate statistics with updated categories
          const updatedStats = calculateStatistics(updatedCookies);
          const finalResults = {
            ...updatedResults,
            statistics: updatedStats
          };

          setScanResult(finalResults);
          // Update history with ML-corrected statistics (like quick scan does)
          addToHistory(finalResults);
        }
      }
    } catch (error) {
      setScanError(error.message || 'Deep scan failed. Please try again.');
    } finally {
      setIsDeepScanning(false);
      setScanning(false);
      setDeepScanProgress(null);
      setScanPaused(false);
      deepScannerRef.current = null;
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
        '/api/scan',
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
              let normalizedML = normalizeCategory(mlData.predicted_category);
              if (normalizedML === 'Unclassified') normalizedML = ruleBasedClassify(cookie);

              // Only update category if it was Uncategorized from the scan
              const finalCategory = cookie.category === 'Uncategorized'
                ? normalizedML
                : cookie.category;

              // Hybrid confidence boost: If rule-based and ML agree, boost confidence
              const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);

              return {
                ...cookie,
                originalCategory: cookie.category, // Store original scan result
                category: finalCategory, // Update only if Uncategorized
                mlClassification: normalizedML, // Always show ML prediction (normalized)
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
                mlClassification: ruleBasedClassify(cookie),
                mlConfidence: 0.0,
                mlConfidenceLevel: 'Low',
                websiteProvided: false,
                categorySource: 'rules'
              };
            }
          });

          const mlCookieMap2 = {};
          updatedCookies.forEach(c => { mlCookieMap2[`${c.name}||${c.domain}`] = c; });

          const updatedPageResults2 = (enhancedResults.pageResults || []).map(page => ({
            ...page,
            cookies: (page.cookies || []).map(c => {
              const enriched = mlCookieMap2[`${c.name}||${c.domain}`];
              return enriched ? { ...c, ...enriched } : c;
            })
          }));

          const updatedResults = {
            ...enhancedResults,
            cookies: updatedCookies,
            pageResults: updatedPageResults2
          };

          setScanResult(updatedResults);

          // Re-calculate statistics with updated categories
          const updatedStats = calculateStatistics(updatedCookies);
          const finalResults = {
            ...updatedResults,
            statistics: updatedStats
          };

          setScanResult(finalResults);
          // Update history with ML-corrected statistics
          addToHistory(finalResults);
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

  // --- Storage helpers ---
  const MAX_SCANS_PER_DOMAIN = 10;
  const MAX_SCAN_HISTORY = 50;

  // Safely write to localStorage with quota fallback
  const safeLocalStorageSet = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      // Quota exceeded — strip fullResults from all but the newest entry and retry
      console.warn(`Storage quota hit for "${key}", pruning fullResults...`);
      try {
        const pruned = Array.isArray(data)
          ? data.map((entry, i) => i === 0 ? entry : { ...entry, fullResults: undefined })
          : Object.fromEntries(
              Object.entries(data).map(([domain, scans]) => [
                domain,
                scans.map((entry, i) => i === 0 ? entry : { ...entry, fullResults: undefined })
              ])
            );
        localStorage.setItem(key, JSON.stringify(pruned));
        return true;
      } catch (e2) {
        // Still too big — save without any fullResults
        console.warn(`Still over quota for "${key}", stripping all fullResults...`);
        try {
          const minimal = Array.isArray(data)
            ? data.map(entry => ({ ...entry, fullResults: undefined }))
            : Object.fromEntries(
                Object.entries(data).map(([domain, scans]) => [
                  domain,
                  scans.map(entry => ({ ...entry, fullResults: undefined }))
                ])
              );
          localStorage.setItem(key, JSON.stringify(minimal));
          return true;
        } catch (e3) {
          console.error(`Cannot save "${key}" even after pruning:`, e3);
          return false;
        }
      }
    }
  };

  const cleanResultsForStorage = (results) => {
    // Create a clean copy without circular references or complex objects
    return {
      cookies: results.cookies.map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        value: cookie.value,
        category: cookie.category,
        originalCategory: cookie.originalCategory,
        type: cookie.type,
        purpose: cookie.purpose,
        requiresConsent: cookie.requiresConsent,
        isThirdParty: cookie.isThirdParty,
        size: cookie.size,
        mlClassification: cookie.mlClassification,
        mlConfidence: cookie.mlConfidence,
        mlConfidenceLevel: cookie.mlConfidenceLevel,
        mlReasoning: cookie.mlReasoning
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
      scanType: results.scanType,
      pageResults: results.pageResults ? results.pageResults.map(page => ({
        url: page.url,
        cookies: page.cookies.map(cookie => ({
          name: cookie.name,
          domain: cookie.domain,
          value: cookie.value,
          category: cookie.category,
          originalCategory: cookie.originalCategory,
          type: cookie.type,
          purpose: cookie.purpose,
          requiresConsent: cookie.requiresConsent,
          isThirdParty: cookie.isThirdParty,
          size: cookie.size,
          mlClassification: cookie.mlClassification,
          mlConfidence: cookie.mlConfidence,
          mlConfidenceLevel: cookie.mlConfidenceLevel,
          mlReasoning: cookie.mlReasoning
        }))
      })) : undefined
    };
  };

  const addToHistory = (results) => {
    const cleanResults = cleanResultsForStorage(results);

    // Derive stats from cookies array when summary fields are missing/zero
    const cookies = results.cookies || [];
    const stats = results.statistics || {};
    const totalCookies = results.totalCount || stats.totalCount || cookies.length || 0;
    const requiresConsent = stats.requiresConsent || cookies.filter(c => c.requiresConsent).length || 0;
    const thirdParty = stats.thirdParty || cookies.filter(c => c.isThirdParty || c.type === 'third-party').length || 0;

    // Derive category breakdown from cookies if stats.byCategory is missing or empty
    let byCategory = stats.byCategory && Object.keys(stats.byCategory).length > 0
      ? { ...stats.byCategory }
      : {};
    if (Object.keys(byCategory).length === 0 && cookies.length > 0) {
      cookies.forEach(c => {
        const cat = c.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
      });
    }

    // Derive type breakdown from cookies if stats.byType is missing or empty
    let byType = stats.byType && Object.keys(stats.byType).length > 0
      ? { ...stats.byType }
      : {};
    if (Object.keys(byType).length === 0 && cookies.length > 0) {
      cookies.forEach(c => {
        const t = c.isThirdParty ? 'third-party' : (c.type || 'first-party');
        byType[t] = (byType[t] || 0) + 1;
      });
    }

    const historyEntry = {
      id: results._scanId || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      domain: results.domain,
      url: results.scannedUrl,
      totalCookies,
      requiresConsent,
      thirdParty,
      categories: byCategory,
      types: byType,
      ...calculateComplianceRisks(cookies, { ...stats, requiresConsent, thirdParty }),
      scanType: results.scanType || 'quick',
      fullResults: cleanResults // Store cleaned results for detailed view
    };

    // Add to domain-based history (capped per domain), replacing existing entry with same id
    setDomainHistory(prev => {
      const domain = results.domain;
      const existing = prev[domain] || [];
      const alreadyExists = existing.some(e => e.id === historyEntry.id);
      const domainScans = alreadyExists
        ? existing.map(e => e.id === historyEntry.id ? historyEntry : e)
        : [historyEntry, ...existing].slice(0, MAX_SCANS_PER_DOMAIN);
      // Strip fullResults from older entries to save space
      const trimmedScans = domainScans.map((entry, i) =>
        i === 0 ? entry : { ...entry, fullResults: undefined }
      );
      const updated = { ...prev, [domain]: trimmedScans };

      safeLocalStorageSet('domainScanHistory', updated);

      return updated;
    });

    // Build notification BEFORE state update (scanHistory is current here)
    const previousScan = scanHistory.find(scan => scan.domain === results.domain);
    const pagesScanned = results.pageResults?.length || 1;
    const comparison = previousScan ? compareScanResults(results, previousScan) : null;

    setNotifications(prev => [{
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      domain: results.domain,
      pagesScanned,
      isFirstScan: !previousScan,
      newCookies: comparison ? comparison.newCookies.length : 0,
      removedCookies: comparison ? comparison.removedCookies.length : 0,
      totalCookies: results.totalCount || results.cookies?.length || 0,
      scanResult: results,
      read: false,
    }, ...prev].slice(0, 20));

    setScanHistory(prev => {
      const updated = [historyEntry, ...prev].slice(0, MAX_SCAN_HISTORY);
      safeLocalStorageSet('cookieScanHistory', updated);
      return updated;
    });
  };

  const getNextRunTime = (job) => {
    const now = new Date();
    const unit = job.unit;
    const interval = job.interval || 1;

    if (unit === 'minutes') {
      return new Date(now.getTime() + interval * 60 * 1000);
    }
    if (unit === 'hourly') {
      return new Date(now.getTime() + interval * 60 * 60 * 1000);
    }

    // For daily/weekly/monthly, use the scheduled time
    const [hours, minutes] = (job.scheduleTime || '09:00').split(':').map(Number);

    if (unit === 'daily') {
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + interval);
      return next;
    }

    if (unit === 'weekly') {
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const targetDay = dayMap[job.scheduleDay || 'sunday'];
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      let daysUntil = targetDay - now.getDay();
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
      next.setDate(now.getDate() + daysUntil);
      return next;
    }

    if (unit === 'monthly') {
      const targetDate = job.scheduleDate || 1;
      const next = new Date(now.getFullYear(), now.getMonth(), targetDate, hours, minutes, 0, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next;
    }

    return new Date(now.getTime() + 60 * 60 * 1000);
  };

  const getIntervalInMs = (interval, unit) => {
    const multipliers = {
      'minutes': 60 * 1000,
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };
    return (interval || scheduleInterval) * multipliers[unit || scheduleUnit];
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

  const persistScheduledJobs = (jobs) => {
    try {
      const toSave = jobs.map(({ timerId, countdownId, timeLeft, ...rest }) => rest);
      localStorage.setItem('scheduledJobs', JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to persist scheduled jobs:', e);
    }
  };

  const runScheduledJob = (job) => {
    console.log(`🕐 Running scheduled scan for ${job.url}`);
    if (job.scanType === 'deep') {
      handleDeepScan(job.url);
    } else {
      handleQuickScanRemote(job.url);
    }
  };

  const startJobTimers = (job) => {
    const unit = job.unit;
    const nextRun = getNextRunTime(job);

    // Countdown timer — updates every second
    const countdownId = setInterval(() => {
      setScheduledJobs(prev => prev.map(j => {
        if (j.id !== job.id) return j;
        const timeLeft = j.nextRun ? new Date(j.nextRun).getTime() - Date.now() : 0;
        return { ...j, timeLeft: Math.max(0, timeLeft) };
      }));
    }, 1000);

    let timerId;
    if (unit === 'minutes' || unit === 'hourly') {
      // Simple interval for short durations
      const intervalMs = getIntervalInMs(job.interval, job.unit);
      timerId = setInterval(() => {
        runScheduledJob(job);
        const next = getNextRunTime(job);
        setScheduledJobs(prev => {
          const updated = prev.map(j => j.id === job.id ? { ...j, nextRun: next.toISOString() } : j);
          persistScheduledJobs(updated);
          return updated;
        });
      }, intervalMs);
    } else {
      // For daily/weekly/monthly, check every 30 seconds if it's time to run
      timerId = setInterval(() => {
        const now = Date.now();
        setScheduledJobs(prev => {
          const jobState = prev.find(j => j.id === job.id);
          if (!jobState || jobState.paused) return prev;
          const runAt = new Date(jobState.nextRun).getTime();
          if (now >= runAt) {
            runScheduledJob(job);
            const next = getNextRunTime(job);
            const updated = prev.map(j => j.id === job.id ? { ...j, nextRun: next.toISOString() } : j);
            persistScheduledJobs(updated);
            return updated;
          }
          return prev;
        });
      }, 30000);
    }

    jobTimersRef.current[job.id] = { timerId, countdownId };
    return { timerId, countdownId, nextRun };
  };

  const startScheduledScanning = () => {
    if (!targetUrl) {
      alert('Please enter a URL to scan');
      return;
    }

    try {
      new URL(targetUrl);
    } catch (e) {
      alert('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    const newJob = {
      id: Date.now().toString(),
      url: targetUrl,
      scanType: scheduleScanType,
      interval: scheduleInterval,
      unit: scheduleUnit,
      scheduleDay: scheduleDay,
      scheduleDate: scheduleDate,
      scheduleTime: scheduleTime,
      maxPages: scheduleScanType === 'deep' ? maxPages : 1,
      maxDepth: scheduleScanType === 'deep' ? maxDepth : 1,
      concurrency: scheduleScanType === 'deep' ? concurrency : 1,
      createdAt: new Date().toISOString()
    };

    // Calculate next run
    const nextRun = getNextRunTime(newJob);
    newJob.nextRun = nextRun.toISOString();
    newJob.timeLeft = nextRun.getTime() - Date.now();

    // Start timers
    startJobTimers(newJob);

    // Run first scan immediately
    runScheduledJob(newJob);

    setScheduledJobs(prev => {
      const updated = [...prev, newJob];
      persistScheduledJobs(updated);
      return updated;
    });

    // Reset form
    setTargetUrl('');
  };

  const deleteScheduledJob = (jobId) => {
    // Clear timers
    const timers = jobTimersRef.current[jobId];
    if (timers) {
      clearInterval(timers.timerId);
      clearInterval(timers.countdownId);
      delete jobTimersRef.current[jobId];
    }

    setScheduledJobs(prev => {
      const updated = prev.filter(j => j.id !== jobId);
      persistScheduledJobs(updated);
      return updated;
    });
  };

  const togglePauseJob = (jobId) => {
    const timers = jobTimersRef.current[jobId];

    setScheduledJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId) return j;

        if (j.paused) {
          // Resume — restart timers
          startJobTimers(j);
          return { ...j, paused: false };
        } else {
          // Pause — clear timers
          if (timers) {
            clearInterval(timers.timerId);
            clearInterval(timers.countdownId);
            delete jobTimersRef.current[jobId];
          }
          return { ...j, paused: true, timeLeft: null };
        }
      });
      persistScheduledJobs(updated);
      return updated;
    });
  };

  const startEditingJob = (job) => {
    setEditingJobId(job.id);
    setEditForm({
      url: job.url,
      scanType: job.scanType,
      interval: job.interval,
      unit: job.unit,
      scheduleDay: job.scheduleDay || 'sunday',
      scheduleDate: job.scheduleDate || 1,
      scheduleTime: job.scheduleTime || '09:00',
      maxPages: job.maxPages || 10,
      maxDepth: job.maxDepth || 3,
      concurrency: job.concurrency || 20
    });
  };

  const cancelEditingJob = () => {
    setEditingJobId(null);
    setEditForm({});
  };

  const saveEditedJob = (jobId) => {
    // Validate URL
    try {
      new URL(editForm.url);
    } catch (e) {
      alert('Please enter a valid URL');
      return;
    }

    // Clear old timers
    const timers = jobTimersRef.current[jobId];
    if (timers) {
      clearInterval(timers.timerId);
      clearInterval(timers.countdownId);
      delete jobTimersRef.current[jobId];
    }

    setScheduledJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId) return j;
        const updatedJob = {
          ...j,
          url: editForm.url,
          scanType: editForm.scanType,
          interval: editForm.interval,
          unit: editForm.unit,
          scheduleDay: editForm.scheduleDay || 'sunday',
          scheduleDate: editForm.scheduleDate || 1,
          scheduleTime: editForm.scheduleTime || '09:00',
          maxPages: editForm.scanType === 'deep' ? editForm.maxPages : 1,
          maxDepth: editForm.scanType === 'deep' ? editForm.maxDepth : 1,
          concurrency: editForm.scanType === 'deep' ? editForm.concurrency : 1,
          paused: j.paused
        };
        const nextRun = getNextRunTime(updatedJob);
        updatedJob.nextRun = nextRun.toISOString();
        // Restart timers if not paused
        if (!j.paused) {
          startJobTimers(updatedJob);
        }
        return updatedJob;
      });
      persistScheduledJobs(updated);
      return updated;
    });

    setEditingJobId(null);
    setEditForm({});
  };

  const stopScheduledScanning = () => {
    // Stop all jobs
    Object.values(jobTimersRef.current).forEach(({ timerId, countdownId }) => {
      clearInterval(timerId);
      clearInterval(countdownId);
    });
    jobTimersRef.current = {};
    setScheduledJobs(prev => {
      persistScheduledJobs([]);
      return [];
    });
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
    console.log('viewScan called with:', scan);
    if (scan.fullResults) {
      console.log('Setting scanResult with fullResults:', scan.fullResults);
      setScanResult(scan.fullResults);
      handleNavigate('results');
    } else {
      console.warn('No fullResults found in scan:', scan);
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
      const response = await fetch('/api/categories/update-category', {
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
    // Restart timers for persisted scheduled jobs
    scheduledJobs.forEach(job => {
      startJobTimers(job);
    });

    return () => {
      Object.values(jobTimersRef.current).forEach(({ timerId, countdownId }) => {
        clearInterval(timerId);
        clearInterval(countdownId);
      });
    };
  }, []);

  // Navigate to results page when scan finishes
  const wasScanningRef = useRef(false);
  useEffect(() => {
    if (wasScanningRef.current && !scanning && scanResult) {
      handleNavigate('results');
    }
    wasScanningRef.current = scanning;
  }, [scanning]);

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

    // CPA (Colorado Privacy Act)
    if (cookie.category === 'Marketing') {
      risks.push({ regulation: 'CPA', level: 'HIGH', reason: 'Targeted advertising — opt-out required' });
    } else if (cookie.isThirdParty && cookie.category === 'Analytics') {
      risks.push({ regulation: 'CPA', level: 'MEDIUM', reason: 'Third-party profiling — disclosure required' });
    }

    return risks;
  };

  const homeKPIs = useMemo(() => {
    const domains = new Set(scanHistory.map(s => s.domain)).size;
    const totalScans = scanHistory.length;
    const latestCookies = scanHistory[0]?.totalCookies || 0;
    const highRisk = scanHistory.filter(s => s.gdprRisk === 'HIGH').length;
    const lowConfidence = (scanResult?.cookies || []).filter(c => c.mlConfidenceLevel === 'Low').length;
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    const thisWeek = scanHistory.filter(s => now - new Date(s.timestamp) < week).length;
    const lastWeek = scanHistory.filter(s => {
      const age = now - new Date(s.timestamp);
      return age >= week && age < 2 * week;
    }).length;
    const trend = totalScans >= 2 ? thisWeek - lastWeek : null;
    return { domains, totalScans, latestCookies, highRisk, lowConfidence, trend };
  }, [scanHistory, scanResult]);

  const domainHealth = useMemo(() => {
    const map = {};
    scanHistory.forEach(s => {
      if (!map[s.domain]) map[s.domain] = s;
    });
    return Object.values(map).slice(0, 6).map(s => ({
      domain: s.domain,
      risk: s.gdprRisk === 'HIGH' || s.ccpaRisk === 'HIGH' ? 'high'
          : s.gdprRisk === 'MEDIUM' || s.ccpaRisk === 'MEDIUM' ? 'medium' : 'low',
      lastScan: s.timestamp,
      totalCookies: s.totalCookies,
    }));
  }, [scanHistory]);

  const complianceStrip = useMemo(() => {
    if (scanResult?.cookies?.length && scanResult?.statistics) {
      const risks = calculateComplianceRisks(scanResult.cookies, scanResult.statistics);
      return { gdpr: risks.gdprRisk, ccpa: risks.ccpaRisk, dpdp: risks.dpdpRisk, cpa: null, source: scanResult.domain };
    }
    if (scanHistory.length > 0) {
      const last = scanHistory[0];
      return { gdpr: last.gdprRisk || 'LOW', ccpa: last.ccpaRisk || 'LOW', dpdp: last.dpdpRisk || 'LOW', cpa: null, source: 'last scan' };
    }
    return { gdpr: null, ccpa: null, dpdp: null, cpa: null, source: null };
  }, [scanResult, scanHistory]);

  const filteredCookies = scanResult?.cookies.filter(c => {
    const categoryMatch = filterCategory === 'all' || c.category === filterCategory;
    const partyMatch = filterParty === 'all' ||
      (filterParty === 'third' && c.isThirdParty) ||
      (filterParty === 'first' && !c.isThirdParty);

    if (filterRegulation === 'all') return categoryMatch && partyMatch;

    const risks = getRegulationRisk(c);
    return categoryMatch && partyMatch && risks.some(r => r.regulation === filterRegulation);
  }) || [];

  const categories = scanResult ?
    ['all', ...Object.keys(scanResult.statistics.byCategory)] :
    ['all'];

  return (
    <div className={`app app-with-sidebar ${sidebarPinned ? 'sidebar-pinned' : ''}`}>
      <LeftSidebar onPinnedChange={setSidebarPinned} onNavigate={handleNavigate} currentPage={currentPage} />
      <Navbar
        notifications={notifications}
        unreadCount={unreadCount}
        onNotificationClick={(notif) => {
          setScanResult(notif.scanResult);
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
          handleNavigate('results');
        }}
        onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        onClearAll={() => setNotifications([])}
      />

      {/* Page Router */}
      {currentPage === 'history' && (
        <main className="main-content page-content">
          <ScanHistoryPage
            scanHistory={scanHistory}
            domainHistory={domainHistory}
            onViewScan={viewScan}
            onDeleteScan={deleteScan}
            onClearHistory={clearHistory}
            onDeleteDomain={deleteDomain}
            deleteScanFromDomain={deleteScanFromDomain}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'compare' && (
        <main className="main-content page-content">
          <CompareScanPage
            scanHistory={scanHistory}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'reports' && (
        <main className="main-content page-content">
          <ReportsPage
            scanHistory={scanHistory}
            domainHistory={domainHistory}
            scanResult={scanResult}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'review' && (
        <main className="main-content page-content">
          <ReviewQueuePage
            scanHistory={scanHistory}
            domainHistory={domainHistory}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'vendors' && (
        <main className="main-content page-content">
          <VendorDashboard
            scanHistory={scanHistory}
            domainHistory={domainHistory}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'publish' && (
        <main className="main-content page-content">
          <AutoPublishPage onNavigate={handleNavigate} />
        </main>
      )}

      {currentPage === 'scheduled' && (
        <main className="main-content page-content">
          <ScheduledScanPage onNavigate={handleNavigate} />
        </main>
      )}

      {currentPage === 'websites' && (
        <main className="main-content page-content">
          <MyWebsitesPage
            domainHistory={domainHistory}
            scanHistory={scanHistory}
            onNavigate={handleNavigate}
          />
        </main>
      )}

      {currentPage === 'model' && (
        <main className="main-content page-content">
          <ModelPerformancePage onNavigate={handleNavigate} />
        </main>
      )}

      {currentPage === 'home' && (
      <main className="main-content home-dashboard">

        {/* Slim Hero Banner */}
        <div className="slim-hero">
          <div className="slim-hero__left">
            <Shield size={28} className="slim-hero__icon" />
            <div>
              <h1 className="slim-hero__title">Cookie Compliance Dashboard</h1>
              <p className="slim-hero__sub">Monitor, scan, and audit cookies across your websites in real time</p>
            </div>
          </div>
          <div className="slim-hero__badges">
            <span className="slim-hero__badge slim-hero__badge--gdpr">GDPR</span>
            <span className="slim-hero__badge slim-hero__badge--ccpa">CCPA</span>
            <span className="slim-hero__badge slim-hero__badge--dpdp">DPDP</span>
          </div>
        </div>

        {/* Zone 1 — KPI Strip */}
        <div className="kpi-strip">
          <div className="kpi-tile">
            <div className="kpi-tile__icon-wrap kpi-tile__icon-wrap--blue"><Globe size={18} /></div>
            <div className="kpi-tile__body">
              <span className="kpi-tile__value">{homeKPIs.domains}</span>
              <span className="kpi-tile__label">Websites Monitored</span>
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__icon-wrap kpi-tile__icon-wrap--teal"><RefreshCw size={18} /></div>
            <div className="kpi-tile__body">
              <span className="kpi-tile__value">{homeKPIs.totalScans}</span>
              <span className="kpi-tile__label">Total Scans</span>
              {homeKPIs.trend !== null && (
                <span className={`kpi-tile__trend kpi-tile__trend--${homeKPIs.trend >= 0 ? 'up' : 'down'}`}>
                  {homeKPIs.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(homeKPIs.trend)} this week
                </span>
              )}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__icon-wrap kpi-tile__icon-wrap--purple"><Cookie size={18} /></div>
            <div className="kpi-tile__body">
              <span className="kpi-tile__value">{homeKPIs.latestCookies}</span>
              <span className="kpi-tile__label">Cookies Found</span>
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__icon-wrap kpi-tile__icon-wrap--red"><AlertCircle size={18} /></div>
            <div className="kpi-tile__body">
              <span className="kpi-tile__value">{homeKPIs.highRisk}</span>
              <span className="kpi-tile__label">High Risk Alerts</span>
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__icon-wrap kpi-tile__icon-wrap--yellow"><Shield size={18} /></div>
            <div className="kpi-tile__body">
              <span className="kpi-tile__value">{homeKPIs.lowConfidence}</span>
              <span className="kpi-tile__label">Pending Reviews</span>
            </div>
          </div>
        </div>

        <section className="scan-controls-compact">
              <div className="scan-compact-wrapper">
                <div className="scan-controls__top-row">
                  <div className="scan-mode-selector">
                    <Tooltip text="Scans a single page for cookies. Fast and lightweight — great for a quick check.">
                      <button
                        className={`mode-btn ${scanMode === 'quick' ? 'active' : ''}`}
                        onClick={() => setScanMode('quick')}
                        disabled={scanning}
                      >
                        <Zap size={15} />
                        <span>Quick</span>
                      </button>
                    </Tooltip>
                    <Tooltip text="Crawls multiple pages following links from the start URL. Discovers cookies across your entire site.">
                      <button
                        className={`mode-btn ${scanMode === 'deep' ? 'active' : ''}`}
                        onClick={() => setScanMode('deep')}
                        disabled={scanning}
                      >
                        <Layers size={15} />
                        <span>Deep</span>
                      </button>
                    </Tooltip>
                    <Tooltip text="Automatically repeats scans at a set interval. Useful for monitoring cookie changes over time.">
                      <button
                        className={`mode-btn ${scanMode === 'schedule' ? 'active' : ''}`}
                        onClick={() => setScanMode('schedule')}
                        disabled={scanning}
                      >
                        <Clock size={15} />
                        <span>Schedule</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="scan-input-row">
                  <div className="scan-input-wrapper">
                    <Globe size={16} className="scan-input-icon" />
                    <input
                      type="text"
                      placeholder={scanMode === 'quick' ? 'Enter URL or leave empty for current page' : 'Enter website URL (e.g., https://example.com)'}
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="scan-url-input"
                      onKeyPress={(e) => e.key === 'Enter' && !scanning && scanMode !== 'schedule' && handleUrlScan()}
                      disabled={scanning}
                    />
                  </div>

                  {scanMode !== 'schedule' && (
                    <button
                      onClick={() => scanMode === 'deep' ? handleUrlScan() : (targetUrl ? handleUrlScan() : handleQuickScan())}
                      disabled={scanning}
                      className="btn-scan-compact"
                    >
                      <RefreshCw className={`icon ${scanning ? 'spinning' : ''}`} size={16} />
                      {scanning ? 'Scanning...' : 'Start Scan'}
                    </button>
                  )}
                </div>

                {scanMode === 'deep' && (
                  <div className="scan-options-row">
                    <div className="scan-option-group">
                      <label className="scan-option-label">
                        Pages
                        <Tooltip text="The maximum number of pages to scan on the website. Higher values give broader coverage but take longer.">
                          <Info size={12} className="scan-option-info" />
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20000"
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                        disabled={scanning}
                        className="scan-option-input"
                      />
                    </div>
                    <div className="scan-option-group">
                      <label className="scan-option-label">
                        Depth Level
                        <Tooltip text="How many clicks deep from the start page to follow links. Level 1 = only the start page's links. Level 3 = links of links of links.">
                          <Info size={12} className="scan-option-info" />
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                        disabled={scanning}
                        className="scan-option-input"
                      />
                    </div>
                    <div className="scan-option-group">
                      <label className="scan-option-label">
                        Concurrency
                        <Tooltip text="Number of pages scanned at the same time. Higher values are faster but may overwhelm the target server.">
                          <Info size={12} className="scan-option-info" />
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={concurrency}
                        onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)}
                        disabled={scanning}
                        className="scan-option-input"
                      />
                    </div>
                    <div className="scan-option-hint">
                      Scans up to {maxPages} pages, crawling {maxDepth} level{maxDepth > 1 ? 's' : ''} deep with {concurrency} parallel requests
                    </div>
                  </div>
                )}

                {!scanning && !targetUrl && scanMode === 'quick' && (
                  <div className="scan-hint">
                    <Globe size={12} />
                    <span>Current: {window.location.hostname}</span>
                  </div>
                )}

                {scanMode === 'schedule' && (
                  <div className="schedule-compact">
                    <div className="schedule-scan-type-row">
                      <span className="scan-option-label">Scan Type</span>
                      <div className="schedule-type-toggle">
                        <Tooltip text="Scans a single page for cookies each time.">
                          <button
                            className={`schedule-type-btn ${scheduleScanType === 'quick' ? 'active' : ''}`}
                            onClick={() => setScheduleScanType('quick')}
                          >
                            <Zap size={14} />
                            Quick
                          </button>
                        </Tooltip>
                        <Tooltip text="Crawls multiple pages each time, following links from the start URL.">
                          <button
                            className={`schedule-type-btn ${scheduleScanType === 'deep' ? 'active' : ''}`}
                            onClick={() => setScheduleScanType('deep')}
                          >
                            <Layers size={14} />
                            Deep
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    {scheduleScanType === 'deep' && (
                      <div className="scan-options-row">
                        <div className="scan-option-group">
                          <label className="scan-option-label">
                            Pages
                            <Tooltip text="The maximum number of pages to scan on the website. Higher values give broader coverage but take longer.">
                              <Info size={12} className="scan-option-info" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20000"
                            value={maxPages}
                            onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                            className="scan-option-input"
                          />
                        </div>
                        <div className="scan-option-group">
                          <label className="scan-option-label">
                            Depth Level
                            <Tooltip text="How many clicks deep from the start page to follow links. Level 1 = only the start page's links. Level 3 = links of links of links.">
                              <Info size={12} className="scan-option-info" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={maxDepth}
                            onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                            className="scan-option-input"
                          />
                        </div>
                        <div className="scan-option-group">
                          <label className="scan-option-label">
                            Concurrency
                            <Tooltip text="Number of pages scanned at the same time. Higher values are faster but may overwhelm the target server.">
                              <Info size={12} className="scan-option-info" />
                            </Tooltip>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="200"
                            value={concurrency}
                            onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)}
                            className="scan-option-input"
                          />
                        </div>
                      </div>
                    )}
                    <div className="schedule-inputs-row">
                      <span className="schedule-label">Repeat</span>
                      <select
                        value={scheduleUnit}
                        onChange={(e) => setScheduleUnit(e.target.value)}
                        className="schedule-unit-select"
                      >
                        <option value="minutes">Every X Minutes</option>
                        <option value="hourly">Every X Hours</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      {(scheduleUnit === 'minutes' || scheduleUnit === 'hourly') && (
                        <>
                          <span className="schedule-label">every</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={scheduleInterval}
                            onChange={(e) => setScheduleInterval(parseInt(e.target.value) || 1)}
                            className="schedule-number-input"
                          />
                          <span className="schedule-label">{scheduleUnit === 'minutes' ? 'min' : 'hr'}</span>
                        </>
                      )}
                    </div>

                    {scheduleUnit === 'weekly' && (
                      <div className="schedule-day-picker">
                        <span className="scan-option-label">Day of Week</span>
                        <div className="day-of-week-grid">
                          {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day => (
                            <button
                              key={day}
                              className={`day-btn ${scheduleDay === day ? 'active' : ''}`}
                              onClick={() => setScheduleDay(day)}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {scheduleUnit === 'monthly' && (
                      <div className="schedule-day-picker">
                        <span className="scan-option-label">Day of Month</span>
                        <div className="day-of-month-grid">
                          {Array.from({ length: 28 }, (_, i) => (
                            <button
                              key={i + 1}
                              className={`date-btn ${scheduleDate === i + 1 ? 'active' : ''}`}
                              onClick={() => setScheduleDate(i + 1)}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(scheduleUnit === 'daily' || scheduleUnit === 'weekly' || scheduleUnit === 'monthly') && (
                      <div className="schedule-time-picker">
                        <span className="scan-option-label">Time</span>
                        <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="schedule-time-input" />
                      </div>
                    )}

                    <button 
                      onClick={startScheduledScanning} 
                      className="btn-schedule-action start schedule-add-btn"
                      disabled={!targetUrl || scanning}
                      title={!targetUrl ? "Enter a URL first" : "Add scheduled scan"}
                    >
                      <Play size={16} />
                      Add Schedule
                    </button>

                    {scheduledJobs.length > 0 && (
                      <div className="scheduled-jobs-list">
                        <div className="scheduled-jobs-header">
                          <span className="scheduled-jobs-title">Scheduled Scans ({scheduledJobs.length})</span>
                          {scheduledJobs.length > 1 && (
                            <button className="scheduled-jobs-clear" onClick={stopScheduledScanning}>
                              <Trash2 size={12} />
                              Clear All
                            </button>
                          )}
                        </div>
                        {scheduledJobs.map(job => (
                          <div key={job.id} className={`scheduled-job-card ${editingJobId === job.id ? 'editing' : ''}`}>
                            {editingJobId === job.id ? (
                              <div className="scheduled-job-edit-form">
                                <div className="edit-form-row">
                                  <label className="scan-option-label">URL</label>
                                  <input
                                    type="text"
                                    value={editForm.url}
                                    onChange={(e) => setEditForm(f => ({ ...f, url: e.target.value }))}
                                    className="scan-url-input"
                                  />
                                </div>
                                <div className="edit-form-row">
                                  <label className="scan-option-label">Scan Type</label>
                                  <div className="schedule-type-toggle">
                                    <button
                                      className={`schedule-type-btn ${editForm.scanType === 'quick' ? 'active' : ''}`}
                                      onClick={() => setEditForm(f => ({ ...f, scanType: 'quick' }))}
                                    >
                                      <Zap size={14} /> Quick
                                    </button>
                                    <button
                                      className={`schedule-type-btn ${editForm.scanType === 'deep' ? 'active' : ''}`}
                                      onClick={() => setEditForm(f => ({ ...f, scanType: 'deep' }))}
                                    >
                                      <Layers size={14} /> Deep
                                    </button>
                                  </div>
                                </div>
                                {editForm.scanType === 'deep' && (
                                  <div className="edit-form-row-inline">
                                    <div className="scan-option-group">
                                      <label className="scan-option-label">Pages</label>
                                      <input type="number" min="1" max="20000" value={editForm.maxPages}
                                        onChange={(e) => setEditForm(f => ({ ...f, maxPages: parseInt(e.target.value) || 1 }))}
                                        className="scan-option-input" />
                                    </div>
                                    <div className="scan-option-group">
                                      <label className="scan-option-label">Depth</label>
                                      <input type="number" min="1" max="500" value={editForm.maxDepth}
                                        onChange={(e) => setEditForm(f => ({ ...f, maxDepth: parseInt(e.target.value) || 1 }))}
                                        className="scan-option-input" />
                                    </div>
                                    <div className="scan-option-group">
                                      <label className="scan-option-label">Concurrency</label>
                                      <input type="number" min="1" max="200" value={editForm.concurrency}
                                        onChange={(e) => setEditForm(f => ({ ...f, concurrency: parseInt(e.target.value) || 1 }))}
                                        className="scan-option-input" />
                                    </div>
                                  </div>
                                )}
                                <div className="edit-form-row-inline">
                                  <div className="scan-option-group">
                                    <label className="scan-option-label">Repeat</label>
                                    <select value={editForm.unit}
                                      onChange={(e) => setEditForm(f => ({ ...f, unit: e.target.value }))}
                                      className="schedule-unit-select">
                                      <option value="minutes">Every X Minutes</option>
                                      <option value="hourly">Every X Hours</option>
                                      <option value="daily">Daily</option>
                                      <option value="weekly">Weekly</option>
                                      <option value="monthly">Monthly</option>
                                    </select>
                                  </div>
                                  {(editForm.unit === 'minutes' || editForm.unit === 'hourly') && (
                                    <div className="scan-option-group">
                                      <label className="scan-option-label">Interval</label>
                                      <input type="number" min="1" max="100" value={editForm.interval}
                                        onChange={(e) => setEditForm(f => ({ ...f, interval: parseInt(e.target.value) || 1 }))}
                                        className="scan-option-input" />
                                    </div>
                                  )}
                                </div>
                                {editForm.unit === 'weekly' && (
                                  <div className="schedule-day-picker">
                                    <span className="scan-option-label">Day of Week</span>
                                    <div className="day-of-week-grid">
                                      {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day => (
                                        <button key={day}
                                          className={`day-btn ${editForm.scheduleDay === day ? 'active' : ''}`}
                                          onClick={() => setEditForm(f => ({ ...f, scheduleDay: day }))}
                                        >{day.slice(0, 3)}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {editForm.unit === 'monthly' && (
                                  <div className="schedule-day-picker">
                                    <span className="scan-option-label">Day of Month</span>
                                    <div className="day-of-month-grid">
                                      {Array.from({ length: 28 }, (_, i) => (
                                        <button key={i + 1}
                                          className={`date-btn ${editForm.scheduleDate === i + 1 ? 'active' : ''}`}
                                          onClick={() => setEditForm(f => ({ ...f, scheduleDate: i + 1 }))}
                                        >{i + 1}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(editForm.unit === 'daily' || editForm.unit === 'weekly' || editForm.unit === 'monthly') && (
                                  <div className="schedule-time-picker">
                                    <span className="scan-option-label">Time</span>
                                    <input type="time" value={editForm.scheduleTime} onChange={(e) => setEditForm(f => ({ ...f, scheduleTime: e.target.value }))} className="schedule-time-input" />
                                  </div>
                                )}
                                <div className="edit-form-actions">
                                  <button className="edit-form-btn save" onClick={() => saveEditedJob(job.id)}>
                                    <Check size={14} /> Save
                                  </button>
                                  <button className="edit-form-btn cancel" onClick={cancelEditingJob}>
                                    <X size={14} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="scheduled-job-info">
                                  <div className="scheduled-job-url">
                                    <Globe size={13} />
                                    <span>{job.url}</span>
                                  </div>
                                  <div className="scheduled-job-meta">
                                    <span className={`scheduled-job-type ${job.scanType}`}>
                                      {job.scanType === 'deep' ? <Layers size={11} /> : <Zap size={11} />}
                                      {job.scanType}
                                    </span>
                                    <span className="scheduled-job-interval">
                                      {job.unit === 'weekly' 
                                        ? `Every ${job.scheduleDay || 'sunday'} at ${job.scheduleTime || '09:00'}`
                                        : job.unit === 'monthly'
                                        ? `${job.scheduleDate || 1}${['st','nd','rd'][(job.scheduleDate || 1) - 1] || 'th'} of every month at ${job.scheduleTime || '09:00'}`
                                        : job.unit === 'daily'
                                        ? `Daily at ${job.scheduleTime || '09:00'}`
                                        : `Every ${job.interval} ${job.unit}`}
                                    </span>
                                    {job.scanType === 'deep' && (
                                      <span className="scheduled-job-config">
                                        {job.maxPages}pg · {job.maxDepth}lvl
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="scheduled-job-right">
                                  <div className="scheduled-job-next">
                                    {job.paused ? (
                                      <span className="scheduled-job-paused-badge">Paused</span>
                                    ) : (
                                      <>
                                        <Clock size={11} />
                                        <span>{job.timeLeft != null ? formatCountdown(job.timeLeft) : '--'}</span>
                                      </>
                                    )}
                                  </div>
                                  <button
                                    className="scheduled-job-edit"
                                    onClick={() => startEditingJob(job)}
                                    title="Edit this scheduled scan"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    className={`scheduled-job-pause ${job.paused ? 'is-paused' : ''}`}
                                    onClick={() => togglePauseJob(job.id)}
                                    title={job.paused ? 'Resume this scan' : 'Pause this scan'}
                                  >
                                    {job.paused ? <Play size={14} /> : <Pause size={14} />}
                                  </button>
                                  <button
                                    className="scheduled-job-delete"
                                    onClick={() => deleteScheduledJob(job.id)}
                                    title="Remove this scheduled scan"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {deepScanProgress && deepScanProgress.current > 0 && (
                    <div className="audit-progress-slim">
                      <div className="audit-slim-header">
                        <div className="audit-slim-status">
                          <div className={`status-indicator ${scanPaused ? 'paused' : ''}`}></div>
                          <span className="status-text">{scanPaused ? 'Paused' : 'Auto-refreshing'}</span>
                        </div>
                        {isDeepScanning && deepScanProgress.status !== 'complete' && (
                          <div className="scan-control-buttons">
                            <button
                              className={`scan-control-btn ${scanPaused ? 'resume' : 'pause'}`}
                              onClick={() => {
                                if (scanPaused) {
                                  deepScannerRef.current?.resume();
                                  setScanPaused(false);
                                } else {
                                  deepScannerRef.current?.pause();
                                  setScanPaused(true);
                                }
                              }}
                            >
                              {scanPaused ? <Play size={14} /> : <Pause size={14} />}
                              {scanPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              className="scan-control-btn stop"
                              onClick={() => {
                                deepScannerRef.current?.cancel();
                              }}
                            >
                              <X size={14} />
                              Stop
                            </button>
                          </div>
                        )}
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
              <div className="results-ready-banner">
                <div className="results-ready-banner__info">
                  <RefreshCw size={14} />
                  <span>Last scan: <strong>{scanResult.domain}</strong> — <strong>{scanResult.totalCount}</strong> cookies found</span>
                </div>
                <div className="results-ready-banner__actions">
                  <button className="results-ready-banner__btn" onClick={() => handleNavigate('results')}>
                    <Eye size={14} /> View Results
                  </button>
                  <button className="results-ready-banner__clear" onClick={() => setScanResult(null)} title="Dismiss">
                    ✕
                  </button>
                </div>
              </div>
            )}

            {scanning && !scanResult && (
              <div className="loading-state">
                <div className="loading-state__spinner">
                  <RefreshCw className="spinning" size={28} />
                </div>
                <p className="loading-state__title">Scanning cookies...</p>
                <p className="loading-state__subtitle">Analyzing page resources and tracking scripts</p>
              </div>
            )}



        {/* Zone 4b — Dashboard (shown when not actively scanning and there's history) */}
        {!scanning && scanHistory.length > 0 && (
          <div className="home-dashboard__body">
            <div className="home-recent-scans">
              <div className="home-section-header">
                <span className="home-section-header__title">Recent Scans</span>
                <button className="home-section-header__link" onClick={() => handleNavigate('history')}>View all</button>
              </div>
              {scanHistory.slice(0, 5).map((scan, idx) => (
                <div key={idx} className="recent-scan-card">
                  <div className="recent-scan-card__info">
                    <span className="recent-scan-card__domain">{scan.domain}</span>
                    <span className="recent-scan-card__date">{new Date(scan.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="recent-scan-card__meta">
                    <span className="recent-scan-card__count"><Cookie size={12} /> {scan.totalCookies}</span>
                    <span className={`risk-pill risk-pill--${(scan.gdprRisk || 'LOW').toLowerCase()}`}>{scan.gdprRisk || 'LOW'}</span>
                    <button className="recent-scan-card__eye" onClick={() => viewScan(scan)} title="Load scan results">
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="home-right-col">
              <div className="home-right-card">
                <div className="home-section-header">
                  <span className="home-section-header__title">Domain Health</span>
                </div>
                {domainHealth.map((d, idx) => (
                  <div key={idx} className="domain-health-row">
                    <span className="domain-health-row__name">{d.domain}</span>
                    <span className={`risk-pill risk-pill--${d.risk}`}>{d.risk.toUpperCase()}</span>
                  </div>
                ))}
              </div>

              <div className="home-right-card">
                <div className="home-section-header">
                  <span className="home-section-header__title">Active Schedules</span>
                  <button className="home-section-header__link" onClick={() => handleNavigate('scheduled')}>Manage</button>
                </div>
                <p className="home-right-card__stat">{scheduledJobs.length} scheduled job{scheduledJobs.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="home-right-card">
                <div className="home-section-header">
                  <span className="home-section-header__title">Quick Actions</span>
                </div>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => handleNavigate('history')}>View Reports</button>
                  <button className="quick-action-btn" onClick={() => handleNavigate('history')}>Review Queue</button>
                  <button className="quick-action-btn" onClick={() => handleNavigate('compare')} disabled={scanHistory.length < 2}>Compare Scans</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan error banner */}
        {scanError && !scanning && (
          <div className="scan-error-banner">
            <AlertCircle size={16} className="scan-error-banner__icon" />
            <span className="scan-error-banner__msg">{scanError}</span>
            <button className="scan-error-banner__close" onClick={() => setScanError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Zone 4c — Zero State */}
        {!scanResult && !scanning && !scanError && scanHistory.length === 0 && (
          <div className="home-zero-state">
            <Globe size={40} className="home-zero-state__icon" />
            <p className="home-zero-state__msg">No scans yet — enter a URL above to get started</p>
          </div>
        )}

        {/* Zone 5 — Compliance Strip */}
        <div className="compliance-strip">
          {[
            { label: 'GDPR', value: complianceStrip.gdpr },
            { label: 'CCPA', value: complianceStrip.ccpa },
            { label: 'DPDP', value: complianceStrip.dpdp },
            { label: 'CPA',  value: complianceStrip.cpa  },
          ].map(({ label, value }) => (
            <div key={label} className={`compliance-strip__item compliance-strip__item--${value ? value.toLowerCase() : 'none'}`}>
              <Shield size={13} />
              <span className="compliance-strip__label">{label}</span>
              <span className="compliance-strip__value">{value || '—'}</span>
            </div>
          ))}
          {complianceStrip.source && (
            <span className="compliance-strip__source">based on {complianceStrip.source}</span>
          )}
        </div>

      </main>
      )}

      {/* ── Results Page ───────────────────────────────────────── */}
      {currentPage === 'results' && (
        <main className="main-content page-content">
          {scanResult ? (
            <>
              {/* Back button */}
              <div className="page-back-row">
                <button className="page-back-btn" onClick={() => handleNavigate('home')}>
                  ← Back to Scanner
                </button>
              </div>

              {/* Slim Results Header */}
              <section className="results-header-slim" id="results-header">
                <div className="results-title-row">
                  <h2 className="results-title">
                    {scanning ? 'Scan in progress — here are the preliminary results' : 'Scan complete — here are your results'}
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

                {/* Stats Grid */}
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
                    <span className="tab-count">{filteredCookies.length}</span>
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
                    <span className="tab-count">{new Set(filteredCookies.map(c => c.domain)).size}</span>
                  </button>
                  <button
                    className={`audit-tab ${resultsTab === 'compliance' ? 'active' : ''}`}
                    onClick={() => setResultsTab('compliance')}
                  >
                    <Shield size={18} />
                    <span className="tab-label">COMPLIANCE</span>
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
                        {filteredCookies.map((cookie, idx) => (
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
                              <td className="col-count"><span className="count-value">{count}</span></td>
                              <td className="col-consent"><span className="count-value">{consentCount}</span></td>
                              <td className="col-party"><span className="count-value">{thirdPartyCount}</span></td>
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
                            <td className="col-count"><span className="count-value">{page.cookieCount || page.cookies?.length || 0}</span></td>
                            <td className="col-initiators"><span className="count-value">{page.initiators?.length || 0}</span></td>
                            <td className="col-duration"><span className="duration-value">{page.duration || 'N/A'}</span></td>
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
                        {Array.from(new Set(filteredCookies.map(c => c.domain))).map(domain => {
                          const domainCookies = filteredCookies.filter(c => c.domain === domain);
                          const categoryCount = domainCookies.reduce((acc, c) => {
                            acc[c.category] = (acc[c.category] || 0) + 1;
                            return acc;
                          }, {});
                          const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0];
                          const isThirdParty = domainCookies[0].isThirdParty;
                          return (
                            <tr key={domain} className="audit-table-row">
                              <td className="col-icon">
                                <Globe size={16} className="vendor-icon" />
                              </td>
                              <td className="col-vendor-name">
                                <span className="vendor-name-text">{domain}</span>
                              </td>
                              <td className="col-count"><span className="count-value">{domainCookies.length}</span></td>
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
                      <span>Total Rows: {new Set(filteredCookies.map(c => c.domain)).size}</span>
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

              {/* History sections */}
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
          ) : (
            <div className="home-zero-state">
              <Globe size={40} className="home-zero-state__icon" />
              <p className="home-zero-state__msg">No scan results — run a scan first</p>
              <button className="btn btn-primary" onClick={() => handleNavigate('home')}>← Back to Scanner</button>
            </div>
          )}
        </main>
      )}

      {/* Accessibility - aria-live region for category update announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {ariaLiveMessage}
      </div>

      {/* Cookie Detail Modal */}
      {selectedCookie && (
        <CookieDetailModal
          cookie={selectedCookie}
          onClose={() => setSelectedCookie(null)}
          onOverride={(cookie) => {
            setOverrideCookie(cookie);
          }}
        />
      )}

      {/* Override Modal */}
      {overrideCookie && (
        <OverrideModal
          cookie={overrideCookie}
          allCookies={scanResult?.cookies || []}
          onClose={() => setOverrideCookie(null)}
          onApply={handleOverrideApply}
        />
      )}
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
