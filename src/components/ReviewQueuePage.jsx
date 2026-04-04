import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Cookie,
  Globe,
  Filter,
  Search,
  ChevronDown,
  Zap,
  Eye,
  ThumbsUp,
  BarChart3,
  Clock,
  AlertCircle,
} from 'lucide-react';
import './ReviewQueuePage.css';

const ReviewQueuePage = ({ scanHistory, domainHistory, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('high'); // 'high', 'quick', 'validation'
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [approvedCookies, setApprovedCookies] = useState(new Set());
  const [skippedCookies, setSkippedCookies] = useState(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState({}); // cookieKey -> chosen category
  const [selectedForBulk, setSelectedForBulk] = useState(new Set());
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);

  // Extract all cookies from most recent scans per domain
  const allCookies = useMemo(() => {
    const cookieMap = {};
    const domainsProcessed = new Set();

    if (Array.isArray(scanHistory)) {
      // Sort by timestamp descending to get most recent first
      const sortedScans = [...scanHistory].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      for (const scan of sortedScans) {
        if (!domainsProcessed.has(scan.domain) && scan.fullResults?.cookies) {
          domainsProcessed.add(scan.domain);
          scan.fullResults.cookies.forEach((cookie) => {
            const key = `${cookie.domain}:${cookie.name}`;
            cookieMap[key] = {
              ...cookie,
              scanId: scan.id,
              scanDomain: scan.domain,
              scanTimestamp: scan.timestamp,
            };
          });
        }
      }
    }

    return Object.values(cookieMap);
  }, [scanHistory]);

  // Helper: get confidence as 0-1 from any cookie format
  const getConfidence = (cookie) => {
    const raw = cookie.mlConfidence ?? cookie.confidence ?? cookie.confidence_score ?? 0;
    // If value > 1, it's already a percentage (0-100), normalize to 0-1
    return raw > 1 ? raw / 100 : raw;
  };

  // Categorize cookies into queues
  const queues = useMemo(() => {
    const high = [];
    const quick = [];
    const validation = [];

    allCookies.forEach((cookie) => {
      const confidence = getConfidence(cookie);

      if (confidence < 0.65) {
        high.push(cookie);
      } else if (confidence < 0.85) {
        quick.push(cookie);
      } else {
        // For validation queue, use deterministic 10% sampling
        // Hash-based selection: use cookie name as seed for consistent sampling
        const hash = cookie.name
          .split('')
          .reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
        if (Math.abs(hash) % 10 === 0) {
          validation.push(cookie);
        }
      }
    });

    return { high, quick, validation };
  }, [allCookies]);

  // Filter cookies based on active filters
  const filteredCookies = useMemo(() => {
    const queue = queues[activeTab];
    if (!queue) return [];

    return queue.filter((cookie) => {
      if (selectedDomain !== 'all' && cookie.scanDomain !== selectedDomain) {
        return false;
      }
      if (selectedCategory !== 'all' && cookie.mlClassification !== selectedCategory) {
        return false;
      }
      if (searchTerm && !cookie.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [queues, activeTab, selectedDomain, selectedCategory, searchTerm]);

  // Get unique domains for filter dropdown
  const domains = useMemo(() => {
    const uniqueDomains = new Set(
      allCookies.map((cookie) => cookie.scanDomain).filter(Boolean)
    );
    return Array.from(uniqueDomains).sort();
  }, [allCookies]);

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      allCookies
        .map((cookie) => cookie.mlClassification)
        .filter(Boolean)
    );
    return Array.from(uniqueCategories).sort();
  }, [allCookies]);

  const notify = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const handleApproveCookie = useCallback(
    (cookieKey, cookie) => {
      const chosenCat = categoryOverrides[cookieKey] || cookie?.mlClassification || cookie?.category || 'Unclassified';

      // Save approval to localStorage for audit trail
      try {
        const reviewLog = JSON.parse(localStorage.getItem('reviewQueueApprovals') || '[]');
        reviewLog.push({
          cookieKey,
          name: cookie?.name,
          domain: cookie?.domain || cookie?.scanDomain,
          originalCategory: cookie?.mlClassification || cookie?.category,
          approvedCategory: chosenCat,
          confidence: getConfidence(cookie || {}),
          action: 'approved',
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem('reviewQueueApprovals', JSON.stringify(reviewLog));
      } catch (e) { /* storage full — continue */ }

      const newApproved = new Set(approvedCookies);
      newApproved.add(cookieKey);
      setApprovedCookies(newApproved);
      notify(`Approved as "${chosenCat}"`);
    },
    [approvedCookies, categoryOverrides]
  );

  const handleSkipCookie = useCallback(
    (cookieKey) => {
      const newSkipped = new Set(skippedCookies);
      newSkipped.add(cookieKey);
      setSkippedCookies(newSkipped);
      notify('Cookie skipped — will reappear next session');
    },
    [skippedCookies]
  );

  const toggleBulkSelect = useCallback((cookieKey) => {
    setSelectedForBulk(prev => {
      const next = new Set(prev);
      if (next.has(cookieKey)) next.delete(cookieKey);
      else next.add(cookieKey);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pendingKeys = displayedCookiesRef.current.map(c => `${c.scanDomain}:${c.name}`);
    const allSelected = pendingKeys.every(k => selectedForBulk.has(k));
    if (allSelected) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(pendingKeys));
    }
  }, [selectedForBulk]);

  const handleBulkApprove = useCallback(() => {
    const target = selectedForBulk.size > 0 ? selectedForBulk : new Set(filteredCookies.map(c => `${c.scanDomain}:${c.name}`));
    const count = target.size;
    if (!window.confirm(`Approve ${count} cookie${count !== 1 ? 's' : ''} in this queue?`)) {
      return;
    }
    setBulkApproving(true);
    const newApproved = new Set(approvedCookies);
    target.forEach(key => newApproved.add(key));
    setApprovedCookies(newApproved);
    setSelectedForBulk(new Set());
    notify(`${count} cookie${count !== 1 ? 's' : ''} approved`);
    setBulkApproving(false);
  }, [filteredCookies, approvedCookies, selectedForBulk]);

  const displayedCookies = filteredCookies.filter(
    (cookie) => {
      const key = `${cookie.scanDomain}:${cookie.name}`;
      return !approvedCookies.has(key) && !skippedCookies.has(key);
    }
  );
  const displayedCookiesRef = useRef(displayedCookies);
  displayedCookiesRef.current = displayedCookies;

  const queueStats = {
    high: queues.high.length,
    quick: queues.quick.length,
    validation: queues.validation.length,
    total: allCookies.length,
    pending: allCookies.length - approvedCookies.size - skippedCookies.size,
  };

  return (
    <div className="rq-container">
      {/* Header */}
      <div className="rq-header">
        <button
          className="rq-back-button"
          onClick={() => onNavigate('home')}
          aria-label="Go back to home"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="rq-header-content">
          <h1 className="rq-title">Review Queue</h1>
          <div className="rq-stats-bar">
            <div className="rq-stat">
              <span className="rq-stat-label">Total Pending</span>
              <span className="rq-stat-value">{queueStats.pending}</span>
            </div>
            <div className="rq-stat-divider" />
            <div className="rq-stat">
              <span className="rq-stat-label">High Priority</span>
              <span className="rq-stat-value rq-high">{queueStats.high}</span>
            </div>
            <div className="rq-stat-divider" />
            <div className="rq-stat">
              <span className="rq-stat-label">Quick Review</span>
              <span className="rq-stat-value rq-quick">{queueStats.quick}</span>
            </div>
            <div className="rq-stat-divider" />
            <div className="rq-stat">
              <span className="rq-stat-label">Validation</span>
              <span className="rq-stat-value rq-validation">{queueStats.validation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="rq-tabs">
        <button
          className={`rq-tab ${activeTab === 'high' ? 'active' : ''}`}
          onClick={() => setActiveTab('high')}
        >
          <AlertTriangle size={18} />
          High Priority
          {queueStats.high > 0 && (
            <span className="rq-badge rq-badge-red">{queueStats.high}</span>
          )}
        </button>
        <button
          className={`rq-tab ${activeTab === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          <Zap size={18} />
          Quick Review
          {queueStats.quick > 0 && (
            <span className="rq-badge rq-badge-amber">{queueStats.quick}</span>
          )}
        </button>
        <button
          className={`rq-tab ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <Eye size={18} />
          Validation
          {queueStats.validation > 0 && (
            <span className="rq-badge rq-badge-green">{queueStats.validation}</span>
          )}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="rq-controls">
        <div className="rq-search-wrapper">
          <Search size={18} className="rq-search-icon" />
          <input
            type="text"
            placeholder="Search by cookie name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rq-search-input"
          />
        </div>

        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="rq-filter-select"
        >
          <option value="all">All Domains</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rq-filter-select"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {displayedCookies.length > 0 && (
          <div className="rq-bulk-actions">
            <label className="rq-select-all-check">
              <input
                type="checkbox"
                checked={displayedCookies.length > 0 && displayedCookies.every(c => selectedForBulk.has(`${c.scanDomain}:${c.name}`))}
                onChange={toggleSelectAll}
              />
              <span>Select All ({displayedCookies.length})</span>
            </label>
            <button className="rq-bulk-approve-btn" onClick={handleBulkApprove} disabled={bulkApproving}>
              <ThumbsUp size={16} />
              {bulkApproving ? 'Approving...'
                : selectedForBulk.size > 0 ? `Approve Selected (${selectedForBulk.size})`
                : `Approve All (${displayedCookies.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Notification */}
      {showNotification && (
        <div className="rq-notification">
          <CheckCircle size={18} />
          {notificationMessage}
        </div>
      )}

      {/* Cookies List or Empty State */}
      <div className="rq-content">
        {displayedCookies.length === 0 ? (
          <div className="rq-empty-state">
            <Shield size={64} className="rq-empty-icon" />
            <h2 className="rq-empty-title">All caught up!</h2>
            <p className="rq-empty-description">
              {approvedCookies.size > 0 && (approvedCookies.size + skippedCookies.size) >= allCookies.length
                ? 'You have reviewed all cookies in this queue.'
                : 'No cookies to review in this queue.'}
            </p>
          </div>
        ) : (
          <div className="rq-cards-grid">
            {displayedCookies.map((cookie) => {
              const cookieKey = `${cookie.scanDomain}:${cookie.name}`;
              const isApproved = approvedCookies.has(cookieKey);
              const conf = getConfidence(cookie);
              const confidencePercent = Math.round(conf * 100);
              const confidenceLevel = conf >= 0.85 ? 'high' : conf >= 0.65 ? 'medium' : 'low';
              const chosenCategory = categoryOverrides[cookieKey] || cookie.mlClassification || cookie.category || '';

              return (
                <div key={cookieKey} className={`rq-card ${isApproved ? 'approved' : ''} ${selectedForBulk.has(cookieKey) ? 'selected' : ''}`}>
                  <div className="rq-card-header">
                    <label className="rq-card-checkbox" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedForBulk.has(cookieKey)}
                        onChange={() => toggleBulkSelect(cookieKey)}
                      />
                    </label>
                    <div className="rq-cookie-info">
                      <h3 className="rq-cookie-name">{cookie.name}</h3>
                      <div className="rq-cookie-domain">
                        <Globe size={14} />
                        {cookie.domain || cookie.scanDomain}
                      </div>
                    </div>
                    <span
                      className={`rq-classification-badge rq-badge-${getCategoryColor(
                        cookie.mlClassification
                      )}`}
                    >
                      {cookie.mlClassification || 'Unclassified'}
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="rq-confidence-section">
                    <div className="rq-confidence-header">
                      <span className="rq-confidence-label">AI Confidence</span>
                      <span className="rq-confidence-value">{confidencePercent}%</span>
                    </div>
                    <div className="rq-confidence-bar">
                      <div
                        className={`rq-confidence-fill rq-confidence-${confidenceLevel}`}
                        style={{ width: `${confidencePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="rq-explanation">
                    <p className="rq-explanation-title">Why {cookie.mlClassification}?</p>
                    <ul className="rq-explanation-bullets">
                      {getExplanationBullets(cookie).map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Category Selection */}
                  <div className="rq-category-selection">
                    <p className="rq-category-label">Category</p>
                    <div className="rq-category-options">
                      {[
                        'Strictly Necessary',
                        'Functional',
                        'Analytics',
                        'Marketing',
                      ].map((cat) => (
                        <label key={cat} className={`rq-category-radio ${chosenCategory === cat ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={`category-${cookieKey}`}
                            value={cat}
                            checked={chosenCategory === cat}
                            onChange={() => setCategoryOverrides(prev => ({ ...prev, [cookieKey]: cat }))}
                          />
                          <span>{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="rq-card-actions">
                    <button
                      className={`rq-btn rq-btn-approve ${
                        activeTab === 'quick' ? 'prominent' : ''
                      }`}
                      onClick={() => handleApproveCookie(cookieKey, cookie)}
                      disabled={isApproved}
                    >
                      <CheckCircle size={16} />
                      {chosenCategory && chosenCategory !== (cookie.mlClassification || cookie.category)
                        ? `Approve as ${chosenCategory}`
                        : activeTab === 'quick' ? 'Approve AI Suggestion' : 'Approve'}
                    </button>
                    <button className="rq-btn rq-btn-skip" onClick={() => handleSkipCookie(cookieKey)}>
                      <XCircle size={16} />
                      Skip
                    </button>
                  </div>

                  {isApproved && (
                    <div className="rq-approved-badge">
                      <CheckCircle size={16} />
                      Approved
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get category color class
function getCategoryColor(category) {
  const colorMap = {
    'Strictly Necessary': 'green',
    'Functional': 'blue',
    'Analytics': 'amber',
    'Marketing': 'red',
  };
  return colorMap[category] || 'gray';
}

// Helper function to generate explanation bullets
function getExplanationBullets(cookie) {
  const bullets = [];

  // Name pattern analysis
  if (cookie.name) {
    const lowerName = cookie.name.toLowerCase();
    if (lowerName.includes('_ga') || lowerName.includes('analytics')) {
      bullets.push('Name suggests analytics tracking');
    } else if (lowerName.includes('session') || lowerName.includes('sid')) {
      bullets.push('Name suggests session management');
    } else if (lowerName.includes('utm') || lowerName.includes('campaign')) {
      bullets.push('Name suggests marketing tracking');
    }
  }

  // Domain analysis
  if (cookie.domain) {
    if (cookie.domain !== cookie.domain) {
      bullets.push('Third-party domain detected');
    } else {
      bullets.push('First-party cookie');
    }
  }

  // Expiry analysis
  if (cookie.expiryDays !== undefined) {
    if (cookie.expiryDays < 1) {
      bullets.push('Session-only cookie (expires when browser closes)');
    } else if (cookie.expiryDays < 30) {
      bullets.push(`Short expiry (${cookie.expiryDays} days)`);
    } else if (cookie.expiryDays > 365) {
      bullets.push(`Long expiry (${Math.round(cookie.expiryDays / 365)} years)`);
    }
  }

  // Type analysis
  if (cookie.type === 'HTTP') {
    bullets.push('HTTP-only cookie (cannot be accessed by JavaScript)');
  }

  // Classification-specific hints
  if (cookie.mlClassification === 'Analytics') {
    bullets.push('Data patterns consistent with analytics tools');
  } else if (cookie.mlClassification === 'Marketing') {
    bullets.push('Cross-domain tracking indicators present');
  } else if (cookie.mlClassification === 'Strictly Necessary') {
    bullets.push('Required for site functionality');
  } else if (cookie.mlClassification === 'Functional') {
    bullets.push('Enhances user experience without analytics');
  }

  return bullets.length > 0
    ? bullets
    : ['ML model classified based on feature analysis'];
}

export default ReviewQueuePage;
