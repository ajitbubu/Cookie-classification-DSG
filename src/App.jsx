import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download, Eye, EyeOff, History } from 'lucide-react';
import CookieScanner from './lib/CookieScanner';
import DeepScanner from './lib/DeepScanner';
import { downloadFile } from './lib/utils';
import { calculateComplianceRisks } from './lib/riskCalculator';
import {
  createRuleFallbackClassifications,
  normalizeCategory,
  publishableCategory as publishableCategoryFor,
} from './lib/classificationPolicy';
import Navbar from './components/Navbar';
import CookieTabs from './components/CookieTabs';
import ActiveScanPage from './components/ActiveScanPage';
import ScanResultsPage from './components/ScanResultsPage';
import DashboardPage from './components/DashboardPage';
import WebsitesPage from './components/WebsitesPage';
import DomainDetailsPage from './components/DomainDetailsPage';
import DomainDetailsMissing from './components/DomainDetailsMissing';
import { getPublishedVersion, publishVersion } from './lib/publishStore';
import { applyCategoryChanges, resolveDomainScan, versionsForDomain } from './lib/domainDetails';
import { publishCategories, publishSummary } from './lib/categoryApi';
import LaunchScan from './components/LaunchScan';
import DeepScanModal from './components/DeepScanModal';
import ScheduleScanModal from './components/ScheduleScanModal';
import CookieInventoryPage from './components/CookieInventoryPage';
import LeftSidebar from './components/LeftSidebar';
import ReviewQueuePage from './components/ReviewQueuePage';
import { useToast } from './components/Toast';
import { nextRunTime, startsLater } from './lib/schedule';
import { writeLocalStorage, readScanHistory, readDomainHistory, readScheduledJobs, readInterruptedScan, clearActiveScan, MAX_SCAN_HISTORY, MAX_SCANS_PER_DOMAIN } from './lib/scanStorage';
import { useScanGuard } from './hooks/useScanGuard';
import { deriveValueFeatures } from './lib/cookieValueFeatures';
import { DOMAIN_TABS, pathForRoute, routeFromPath } from './lib/routes';
import CookieDetailModal from './components/CookieDetailModal';
import VendorDashboard from './components/VendorDashboard';
import OverrideModal from './components/OverrideModal';
import ModelPerformancePage from './components/ModelPerformancePage';
import './App.css';

function App() {
  const toast = useToast();
  const [scanner] = useState(() => new CookieScanner());
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [selectedCookie, setSelectedCookie] = useState(null); // for cookie detail modal
  const [overrideCookie, setOverrideCookie] = useState(null); // for override modal

  // URL Scanning
  const [targetUrl, setTargetUrl] = useState('');
  const [scanModal, setScanModal] = useState(null); // { type: 'deep' | 'schedule', url }
  // What the current (or last) scan was, for the Active Scan cards and Retry.
  const [activeScan, setActiveScan] = useState(null); // { url, type, settings }
  // A scan left running when the tab was refreshed or closed (E5, eng R5)
  const [interrupted, setInterrupted] = useState(readInterruptedScan);
  const [lastCompleted, setLastCompleted] = useState(null);
  const [reschedulingJob, setReschedulingJob] = useState(null);
  const [publishTick, setPublishTick] = useState(0); // re-read the browser-local publish store

  // Deep Scan - Industry Grade Configuration
  const [deepScanner] = useState(() => new DeepScanner());
  const [maxPages, setMaxPages] = useState(10);  // Default to 10 pages
  const [concurrency, setConcurrency] = useState(20);  // Default to 20 concurrent
  const [maxDepth, setMaxDepth] = useState(3);  // Default depth 3
  const [deepScanProgress, setDeepScanProgress] = useState(null);
  const [scanPaused, setScanPaused] = useState(false);
  const deepScannerRef = useRef(null);

  // Scheduled Scanning
  const [scheduleInterval] = useState(30);
  const [scheduleUnit] = useState('minutes');
  const [scheduledJobs, setScheduledJobs] = useState(readScheduledJobs);
  const jobTimersRef = useRef({});
  const urlInputRef = useRef(null);
  const [scanHistory, setScanHistory] = useState(readScanHistory);

  // Domain-based scan history (with startup pruning)
  const [domainHistory, setDomainHistory] = useState(readDomainHistory);

  // Bookmarklet

  // Left sidebar
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Persistent notification list
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Page-based routing; each page has its own URL (see lib/routes.js), so
  // Back/Forward, refresh and shared links land on the right view.
  const [currentPage, setCurrentPage] = useState(() => routeFromPath(window.location.pathname, window.location.search).page);

  // Results view tab
  const [resultsTab, setResultsTab] = useState(() => routeFromPath(window.location.pathname, window.location.search).tab);
  // Which domain/version Domain Details shows, mirrored in /domains/:domain?scan= (E3)
  const [openScan, setOpenScan] = useState(() => {
    const route = routeFromPath(window.location.pathname, window.location.search);
    return route.domain ? { domain: route.domain, scanId: route.scanId } : null;
  });
  const [domainMissing, setDomainMissing] = useState(null); // { status: 'unknown' | 'pruned', domain, entry }

  const startNewScan = () => {
    handleNavigate('launch');
    requestAnimationFrame(() => urlInputRef.current?.focus());
  };

  useScanGuard(scanning, activeScan);

  const retryLastScan = () => {
    if (!activeScan) return;
    if (activeScan.type === 'deep') handleDeepScan(activeScan.url, activeScan.settings);
    else if (activeScan.currentPage) handleQuickScan();
    else handleQuickScanRemote(activeScan.url);
  };

  const handleNavigate = (page, { tab } = {}) => {
    setCurrentPage(page);
    if (page === 'results') setResultsTab(tab || 'overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const path = pathForRoute(currentPage, resultsTab, currentPage === 'results' ? openScan || {} : {});
    if (window.location.pathname + window.location.search !== path) {
      window.history.pushState(null, '', path);
    }
  }, [currentPage, resultsTab, openScan]);

  // E3 loader: open the stored scan a /domains/:domain[?scan=] link points at.
  const loadDomainRoute = (route) => {
    const resolved = resolveDomainScan({ scanHistory, domainHistory, domain: route.domain, scanId: route.scanId });
    setOpenScan({ domain: route.domain, scanId: resolved.entry?.id ?? route.scanId ?? null });
    if (resolved.status === 'found') {
      setDomainMissing(null);
      setScanResult(resolved.entry.fullResults);
    } else {
      setDomainMissing({ status: resolved.status, domain: route.domain, entry: resolved.entry });
    }
  };

  // The popstate listener is registered once; read the loader through a ref so
  // Back/Forward resolve against current scan history, not the first render's.
  const loadDomainRouteRef = useRef(loadDomainRoute);
  loadDomainRouteRef.current = loadDomainRoute;

  useEffect(() => {
    const route = routeFromPath(window.location.pathname, window.location.search);
    if (route.page === 'results' && route.domain) loadDomainRoute(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep link resolves once, on first load
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = routeFromPath(window.location.pathname, window.location.search);
      setCurrentPage(route.page);
      if (route.page === 'results') {
        setResultsTab(route.tab);
        if (route.domain) loadDomainRouteRef.current(route);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Accessibility - aria-live announcements
  const [ariaLiveMessage, setAriaLiveMessage] = useState('');

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

  // Model confidence must remain the calibrated model output. Rule agreement is
  // useful evidence, but adding an arbitrary boost makes the score misleading.
  const adjustMLConfidence = (_cookie, mlData) => {
    return {
      adjustedConfidence: mlData.confidence_score ?? 0,
      adjustedLevel: mlData.confidence_level || 'Low',
    };
  };

  const enrichCookieWithClassification = (cookie, classification) => {
    const mlData = classification || createRuleFallbackClassifications(
      [cookie],
      'missing_classification_result'
    )[0];
    const suggestedCategory = normalizeCategory(
      mlData.suggested_category || mlData.predicted_category
    );
    const publishableCategory = publishableCategoryFor(mlData);
    const { adjustedConfidence, adjustedLevel } = adjustMLConfidence(cookie, mlData);
    const classificationSource = mlData.source || 'ml_prediction';
    const isPublishedClassification = mlData.classification_status === 'classified';

    return {
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
      requiresReview: mlData.requires_review ?? true,
      requiresConsent: isPublishedClassification
        ? publishableCategory !== 'Strictly Necessary'
        : true,
      gdprCompliant: isPublishedClassification
        ? publishableCategory === 'Strictly Necessary'
        : false,
      ccpaApplicable: isPublishedClassification
        ? ['Analytics', 'Marketing'].includes(publishableCategory)
        : true,
      websiteProvided: false,
      categorySource: isPublishedClassification ? classificationSource : 'unclassified',
    };
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
          site_domain: cookie.siteDomain || cookie.site_domain,
          // Derived features instead of the raw value. Cookie values carry
          // session tokens; the model only ever needed length/uuid/base64.
          ...deriveValueFeatures(cookie.value),
        })),
        options: {
          return_explanation: false,
          find_similar: false,
          auto_classify: false,
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
    
    return createRuleFallbackClassifications(cookies, 'model_unavailable');
  };

  const handleQuickScan = async (url = null) => {
    setActiveScan({ url: url || window.location.href, type: 'quick', currentPage: !url });
    setScanError(null);
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
        const updatedCookies = results.cookies.map((cookie, idx) =>
          enrichCookieWithClassification(cookie, mlClassifications[idx])
        );
        
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

  const handleDeepScan = async (url = null, settings = {}) => {
    setActiveScan({ url: url || window.location.href, type: 'deep', settings });
    const scanStartTime = Date.now();
    setScanError(null);
    setScanning(true);
    setDeepScanProgress(null);

    try {
      const targetUrl = url || window.location.href;
      const deepScannerInstance = new DeepScanner({
        maxPages: settings.maxPages ?? maxPages,
        concurrency: settings.concurrency ?? concurrency,
        maxDepth: settings.maxDepth ?? maxDepth,  // Pass maxDepth to backend
        includeSubdomains: Boolean(settings.includeSubdomains)
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
          const updatedCookies = results.cookies.map((cookie, idx) =>
            enrichCookieWithClassification(cookie, mlClassifications[idx])
          );

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
      setScanning(false);
      setDeepScanProgress(null);
      setScanPaused(false);
      deepScannerRef.current = null;
    }
  };

  const handleQuickScanRemote = async (url) => {
    setActiveScan({ url, type: 'quick' });
    setScanError(null);
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
          const updatedCookies = results.cookies.map((cookie, idx) =>
            enrichCookieWithClassification(cookie, mlClassifications[idx])
          );

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

  // Safely write to localStorage with quota fallback.
  // Returns 'ok' | 'pruned' | 'failed' and tells the user when history was
  // truncated or dropped. This used to return a bare boolean that nothing
  // checked, so quota loss was invisible outside the console — a user could
  // close the tab believing a scan was saved when it was not.
  const safeLocalStorageSet = (key, data) => {
    const status = writeLocalStorage(key, data);
    if (status === 'pruned') {
      toast.warning(
        'Storage is nearly full, so detailed results from older scans were dropped. Export anything you need to keep.',
        { title: 'Scan history trimmed' }
      );
    } else if (status === 'failed') {
      toast.error(
        'Storage is full — this scan was not saved. Export it before closing the tab.',
        { title: 'Could not save scan' }
      );
    }
    return status;
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
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        mlClassification: cookie.mlClassification,
        mlConfidence: cookie.mlConfidence,
        mlConfidenceLevel: cookie.mlConfidenceLevel,
        mlReasoning: cookie.mlReasoning,
        abstainReason: cookie.abstainReason
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
      errorPages: results.errorPages,
      scanDuration: results.scanDuration,
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
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          mlClassification: cookie.mlClassification,
          mlConfidence: cookie.mlConfidence,
          mlConfidenceLevel: cookie.mlConfidenceLevel,
          mlReasoning: cookie.mlReasoning,
          abstainReason: cookie.abstainReason
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
      pagesScanned: results.totalPages || results.pageResults?.length || 1,
      failedPages: results.errorPages?.length || 0,
      durationMs: results.scanDuration || null,
      fullResults: cleanResults // Store cleaned results for detailed view
    };
    setLastCompleted(historyEntry);
    setOpenScan({ domain: historyEntry.domain, scanId: historyEntry.id });
    setDomainMissing(null);

    // Add to domain-based history (capped per domain), replacing existing entry with same id
    setDomainHistory(prev => {
      const domain = results.domain;
      const existing = prev[domain] || [];
      const alreadyExists = existing.some(e => e.id === historyEntry.id);
      const domainScans = alreadyExists
        ? existing.map(e => e.id === historyEntry.id ? historyEntry : e)
        : [historyEntry, ...existing].slice(0, MAX_SCANS_PER_DOMAIN);
      const updated = { ...prev, [domain]: domainScans };

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

  // Scheduling rules live in lib/schedule.js (shared with the Schedule Scan preview).
  const getNextRunTime = (job) => nextRunTime(job);

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
      // Use the job's own crawl settings (Page Limit, subdomains), not the global ones.
      handleDeepScan(job.url, {
        maxPages: job.maxPages, maxDepth: job.maxDepth, concurrency: job.concurrency, includeSubdomains: job.includeSubdomains,
      });
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

  // Settings come from the Schedule Scan modal, which validates the URL.
  const startScheduledScanning = (config) => {
    const newJob = {
      id: Date.now().toString(),
      url: config.url,
      scanType: config.scanType,
      interval: config.interval,
      unit: config.unit,
      scheduleDay: config.day,
      scheduleDate: config.date,
      scheduleTime: config.time,
      startDate: config.startDate || null,
      includeSubdomains: Boolean(config.includeSubdomains),
      maxPages: config.scanType === 'deep' ? config.maxPages : 1,
      maxDepth: config.scanType === 'deep' ? config.maxDepth : 1,
      concurrency: config.scanType === 'deep' ? config.concurrency : 1,
      createdAt: new Date().toISOString()
    };

    // Calculate next run
    const nextRun = getNextRunTime(newJob);
    newJob.nextRun = nextRun.toISOString();
    newJob.timeLeft = nextRun.getTime() - Date.now();

    // Start timers
    startJobTimers(newJob);

    // Run the first scan now, unless the schedule starts on a later date
    if (!startsLater(newJob)) runScheduledJob(newJob);

    setScheduledJobs(prev => {
      const updated = [...prev, newJob];
      persistScheduledJobs(updated);
      return updated;
    });

    toast.success(`Scan of ${newJob.url} scheduled. Next run ${nextRun.toLocaleString()}.`);
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



  // Settings come from the Reschedule modal, which validates the URL.
  const saveEditedJob = (jobId, form) => {
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
          url: form.url,
          scanType: form.scanType,
          interval: form.interval,
          unit: form.unit,
          scheduleDay: form.scheduleDay || 'sunday',
          scheduleDate: form.scheduleDate || 1,
          scheduleTime: form.scheduleTime || '09:00',
          startDate: form.startDate ?? j.startDate ?? null,
          includeSubdomains: Boolean(form.includeSubdomains ?? j.includeSubdomains),
          maxPages: form.scanType === 'deep' ? form.maxPages : 1,
          maxDepth: form.scanType === 'deep' ? form.maxDepth : 1,
          concurrency: form.scanType === 'deep' ? form.concurrency : 1,
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
    setOpenScan({ domain: scan.domain, scanId: scan.id });
    if (scan.fullResults) {
      setDomainMissing(null);
      setScanResult(scan.fullResults);
    } else {
      setDomainMissing({ status: 'pruned', domain: scan.domain, entry: scan });
    }
    handleNavigate('results');
  };

  // Domain history functions
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
  // Bulk category change from Domain Details: optimistic, one bulk API call,
  // and a 10-second Undo (decision 28A) that replays the previous categories.
  const scanResultRef = useRef(scanResult);
  scanResultRef.current = scanResult;
  const bulkUpdateCategories = async (changes, { undo = false } = {}) => {
    const before = scanResultRef.current;
    if (!before) return;
    const { cookies, previous } = applyCategoryChanges(before.cookies, changes);
    const count = Object.keys(previous).length;
    if (count === 0) return;
    setScanResult({ ...before, cookies });

    try {
      // Published only when the knowledge base took it (eng R4, E4); the API
      // can answer success after saving to its file fallback.
      const outcome = await publishCategories(before.cookies
        .filter((c) => `${c.name}|${c.domain}` in previous)
        .map((c) => ({
          scanId: before.scannedAt || Date.now().toString(),
          name: c.name,
          domain: c.domain,
          oldCategory: c.category,
          newCategory: changes[`${c.name}|${c.domain}`],
        })));
      const summary = publishSummary(outcome);
      if (undo) {
        toast.info(`Undone: ${count} cookie${count === 1 ? '' : 's'} restored.`);
      } else {
        toast[summary.tone](summary.text, {
          duration: 10000,
          action: { label: 'Undo', onClick: () => bulkUpdateCategories(previous, { undo: true }) },
        });
      }
    } catch (error) {
      setScanResult((current) => (current ? { ...current, cookies: applyCategoryChanges(current.cookies, previous).cookies } : current));
      toast.error(`Couldn't update ${count} cookie${count === 1 ? '' : 's'} (${error.message}). Nothing was changed.`);
    }
  };

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
      
      const data = await response.json();
      if (data.knowledge_base_updated === false) {
        // Saved to the file fallback only (eng R4, E4): say so rather than imply it's live.
        toast.warning('Saved, but not published: the database is unavailable.', { title: `${cookieName} not published` });
      }

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

  const domainVersions = useMemo(
    () => (scanResult ? versionsForDomain(domainHistory[scanResult.domain] || []) : []),
    [scanResult, domainHistory]
  );
  const currentVersion = domainVersions.find((v) => v.fullResults?.scannedAt === scanResult?.scannedAt) || domainVersions[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- publishTick forces a re-read after Publish
  const publishedVersion = useMemo(() => (scanResult ? getPublishedVersion(scanResult.domain) : null), [scanResult, publishTick]);

  const categories = scanResult ?
    ['all', ...Object.keys(scanResult.statistics.byCategory)] :
    ['all'];

  // Launch New Scan control (27C): Scanning > Launch New Scan and the first-run Dashboard.
  const launchControl = (
    <LaunchScan
      value={targetUrl}
      onChange={setTargetUrl}
      scanning={scanning}
      inputRef={urlInputRef}
      onQuickScan={(url) => {
        handleNavigate('active');
        if (url) handleQuickScanRemote(url); else handleQuickScan();
      }}
      onDeepScan={(url) => setScanModal({ type: 'deep', url })}
      onScheduleScan={(url) => setScanModal({ type: 'schedule', url })}
    />
  );

  return (
    <div className="app app-with-sidebar">
      <LeftSidebar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <Navbar
        currentPage={currentPage}
        navOpen={mobileNavOpen}
        onMenuToggle={() => setMobileNavOpen(v => !v)}
        notifications={notifications}
        unreadCount={unreadCount}
        onNotificationClick={(notif) => {
          setScanResult(notif.scanResult);
          setOpenScan({ domain: notif.domain, scanId: null });
          setDomainMissing(null);
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
          handleNavigate('results');
        }}
        onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        onClearAll={() => setNotifications([])}
      />

      {/* Figma page shell: tabs and page content share one white panel */}
      <div className="page-panel">
      {['launch', 'active', 'history'].includes(currentPage) && (
        <CookieTabs
          currentPage={currentPage}
          activeCount={scanning ? 1 : 0}
          onNavigate={handleNavigate}
        />
      )}

      {/* Scanning > Launch New Scan (Figma 1:189760) */}
      {currentPage === 'launch' && (
        <main className="main-content page-content">
          <section className="launch-page" aria-labelledby="launch-heading">
            <h2 id="launch-heading" className="launch-page__title">Launch New Scan</h2>
            {launchControl}
          </section>
        </main>
      )}

      {/* Page Router */}
      {currentPage === 'history' && (
        <main className="main-content page-content">
          <ScanResultsPage
            scanHistory={scanHistory}
            onOpenScan={viewScan}
            onDeleteScan={deleteScan}
            onClearHistory={clearHistory}
            onNewScan={startNewScan}
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

      {/* Active Scan replaces the Scheduled Scans page (4A) */}
      {currentPage === 'active' && (
        <main className="main-content page-content">
          <ActiveScanPage
            running={scanning && activeScan ? { ...activeScan, progress: deepScanProgress, paused: scanPaused } : null}
            failure={!scanning && scanError && activeScan
              ? { ...activeScan, message: scanError, cancelled: /cancelled/i.test(scanError) }
              : null}
            completed={lastCompleted}
            scheduledJobs={scheduledJobs}
            interrupted={interrupted}
            onRescanInterrupted={(scan) => {
              setInterrupted(null);
              if (scan.type === 'deep') handleDeepScan(scan.url, scan.settings || {});
              else handleQuickScanRemote(scan.url);
            }}
            onDismissInterrupted={() => {
              setInterrupted(null);
              clearActiveScan();
            }}
            onCancelRunning={() => deepScannerRef.current?.cancel()}
            onPauseRunning={() => { deepScannerRef.current?.pause(); setScanPaused(true); }}
            onResumeRunning={() => { deepScannerRef.current?.resume(); setScanPaused(false); }}
            onRetryScan={retryLastScan}
            onViewResults={viewScan}
            onDismissCompleted={() => setLastCompleted(null)}
            onCancelJob={(jobId) => {
              deleteScheduledJob(jobId);
              toast.info('Scheduled scan cancelled.');
            }}
            onRescheduleJob={setReschedulingJob}
            onTogglePauseJob={togglePauseJob}
          />
          <ScheduleScanModal
            open={Boolean(reschedulingJob)}
            initial={reschedulingJob}
            title="Reschedule Scan"
            submitLabel="Save schedule"
            onClose={() => setReschedulingJob(null)}
            onSchedule={(config) => {
              saveEditedJob(reschedulingJob.id, {
                url: config.url,
                scanType: config.scanType,
                interval: config.interval,
                unit: config.unit,
                scheduleDay: config.day,
                scheduleDate: config.date,
                scheduleTime: config.time,
                startDate: config.startDate,
                maxPages: config.maxPages,
                maxDepth: config.maxDepth,
                concurrency: config.concurrency,
              });
              setReschedulingJob(null);
              toast.success(`Schedule for ${config.url} updated.`);
            }}
          />
        </main>
      )}

      {currentPage === 'inventory' && (
        <main className="main-content page-content">
          <CookieInventoryPage scanHistory={scanHistory} onNewScan={startNewScan} />
        </main>
      )}

      {currentPage === 'websites' && (
        <main className="main-content page-content">
          <WebsitesPage
            scanHistory={scanHistory}
            domainHistory={domainHistory}
            onOpenScan={viewScan}
            onScanNow={(url) => {
              handleNavigate('active');
              handleQuickScanRemote(url);
            }}
            onNewScan={startNewScan}
          />
        </main>
      )}

      {currentPage === 'model' && (
        <main className="main-content page-content">
          <ModelPerformancePage onNavigate={handleNavigate} />
        </main>
      )}

      {currentPage === 'home' && (
        <main className="main-content page-content">
          <DashboardPage
            scanHistory={scanHistory}
            onNavigate={handleNavigate}
            onOpenScan={viewScan}
            launchControl={launchControl}
            running={scanning && activeScan ? { ...activeScan, progress: deepScanProgress } : null}
          />
        </main>
      )}

      {/* Scan pop-ups, opened from the launch control on any page */}
      <DeepScanModal
        open={scanModal?.type === 'deep'}
        initialUrl={scanModal?.url || ''}
        defaults={{ maxPages, maxDepth, concurrency }}
        onClose={() => setScanModal(null)}
        onStart={({ url, ...settings }) => {
          setScanModal(null);
          // A single-page check must not become the default for later deep scans.
          if (settings.maxPages > 1) {
            setMaxPages(settings.maxPages);
            setMaxDepth(settings.maxDepth);
            setConcurrency(settings.concurrency);
          }
          setTargetUrl(url);
          handleNavigate('active');
          handleDeepScan(url, settings);
        }}
      />
      <ScheduleScanModal
        open={scanModal?.type === 'schedule'}
        initialUrl={scanModal?.url || ''}
        onClose={() => setScanModal(null)}
        onSchedule={(config) => {
          setScanModal(null);
          handleNavigate('active');
          startScheduledScanning(config);
        }}
      />

      {/* ── Results Page ───────────────────────────────────────── */}
      {currentPage === 'results' && (
        <main className="main-content page-content">
          {domainMissing ? (
            <DomainDetailsMissing
              status={domainMissing.status}
              domain={domainMissing.domain}
              entry={domainMissing.entry}
              onNewScan={startNewScan}
              onScanNow={(url, type) => {
                handleNavigate('active');
                if (type === 'deep') handleDeepScan(url); else handleQuickScanRemote(url);
              }}
              onOpenResults={() => handleNavigate('history')}
            />
          ) : scanResult ? (
            <DomainDetailsPage
              key={scanResult.scannedAt}
              scan={scanResult}
              initialTab={DOMAIN_TABS.includes(resultsTab) ? resultsTab : 'overview'}
              onTabChange={setResultsTab}
              versions={domainVersions}
              currentVersionId={currentVersion?.id}
              published={publishedVersion}
              onPublish={(version) => {
                publishVersion(scanResult.domain, version.id);
                setPublishTick((t) => t + 1);
                toast.success(`Version ${version.version} published.`);
              }}
              onScanNow={() => {
                const url = scanResult.scannedUrl || `https://${scanResult.domain}`;
                handleNavigate('active');
                if (scanResult.scanType === 'deep') handleDeepScan(url);
                else handleQuickScanRemote(url);
              }}
              onExport={() => downloadFile(scanner.export(scanResult, 'html'), `cookie-report-${scanResult.domain}.html`, 'text/html')}
              onReview={() => handleNavigate('review')}
              onBack={() => handleNavigate('history')}
              onBulkUpdate={(changes) => bulkUpdateCategories(changes)}
              tableProps={{
                scanId: scanResult.scannedAt || Date.now().toString(),
                onCategoryUpdate: handleMLCategoryUpdate,
                onSelectCookie: setSelectedCookie,
              }}
            />
          ) : (
            <DomainDetailsMissing status="none" onNewScan={startNewScan} onScanNow={() => {}} onOpenResults={() => handleNavigate('history')} />
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
