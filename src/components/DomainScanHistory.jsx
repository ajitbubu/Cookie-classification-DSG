import React, { useState, useMemo } from 'react';
import {
  Globe, Clock, Cookie, Eye, Trash2, ChevronDown, ChevronRight,
  Layers, AlertCircle, Search, Shield, ExternalLink, Edit2,
  Save, X, History, ArrowUpRight, ArrowDownRight, Filter,
  Download, TrendingUp, TrendingDown, Minus, AlertTriangle
} from 'lucide-react';
import ScanResultModal from './ScanResultModal';
import './DomainScanHistory.css';

function DomainScanHistory({ domainHistory, onViewScan, onDeleteScan, onDeleteDomain }) {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [expandedScanId, setExpandedScanId] = useState(null);
  const [expandedPages, setExpandedPages] = useState(new Set());
  const [modalScan, setModalScan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCookie, setEditingCookie] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [autoClassifyThreshold, setAutoClassifyThreshold] = useState(0.8);
  const [showSettings, setShowSettings] = useState(false);
  const [overrideHistory, setOverrideHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('cookieOverrideHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [cookieFilter, setCookieFilter] = useState('all');

  const categories = [
    'Strictly Necessary', 'Analytics', 'Marketing',
    'Functional', 'Social Media', 'Unclassified'
  ];

  const togglePageCookies = (pageKey) => {
    const next = new Set(expandedPages);
    next.has(pageKey) ? next.delete(pageKey) : next.add(pageKey);
    setExpandedPages(next);
  };

  const handleOverrideCategory = async (cookie, newCategory, scanId) => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the override');
      return;
    }
    try {
      const response = await fetch('/api/categories/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_id: scanId,
          cookie_name: cookie.name,
          cookie_domain: cookie.domain,
          old_category: cookie.category,
          new_category: newCategory,
          override_reason: overrideReason,
          ml_classification: cookie.mlClassification,
          ml_confidence: cookie.mlConfidence
        })
      });
      if (!response.ok) throw new Error('Failed to update category');

      const historyEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        cookieName: cookie.name,
        cookieDomain: cookie.domain,
        oldCategory: cookie.category,
        newCategory,
        mlClassification: cookie.mlClassification,
        mlConfidence: cookie.mlConfidence,
        reason: overrideReason,
        scanId
      };
      const updatedHistory = [historyEntry, ...overrideHistory];
      setOverrideHistory(updatedHistory);
      localStorage.setItem('cookieOverrideHistory', JSON.stringify(updatedHistory));

      const updatedDomainHistory = { ...domainHistory };
      Object.keys(updatedDomainHistory).forEach(domain => {
        updatedDomainHistory[domain] = updatedDomainHistory[domain].map(scan => {
          if (scan.id === scanId && scan.fullResults) {
            return {
              ...scan,
              fullResults: {
                ...scan.fullResults,
                cookies: scan.fullResults.cookies.map(c =>
                  c.name === cookie.name && c.domain === cookie.domain
                    ? { ...c, category: newCategory, originalCategory: cookie.category }
                    : c
                ),
                pageResults: scan.fullResults.pageResults?.map(page => ({
                  ...page,
                  cookies: page.cookies.map(c =>
                    c.name === cookie.name && c.domain === cookie.domain
                      ? { ...c, category: newCategory, originalCategory: cookie.category }
                      : c
                  )
                }))
              }
            };
          }
          return scan;
        });
      });
      localStorage.setItem('domainScanHistory', JSON.stringify(updatedDomainHistory));
      window.location.reload();
      setEditingCookie(null);
      setOverrideReason('');
    } catch (error) {
      alert('Failed to update category: ' + error.message);
    }
  };

  const handleAutoClassify = (cookies, scanId) => {
    const toUpdate = cookies.filter(c =>
      c.mlConfidence >= autoClassifyThreshold &&
      c.mlClassification &&
      c.category !== c.mlClassification
    );
    if (toUpdate.length === 0) {
      alert('No cookies meet the auto-classification threshold');
      return;
    }
    if (!window.confirm(`Auto-classify ${toUpdate.length} cookies with confidence ≥ ${Math.round(autoClassifyThreshold * 100)}%?`)) return;
    toUpdate.forEach(cookie => {
      handleOverrideCategory(cookie, cookie.mlClassification, scanId);
    });
  };

  // Compute change detection between consecutive scans
  const getChangeDetection = (scan, prevScan) => {
    if (!prevScan) return null;
    const totalDelta = (scan.totalCookies || 0) - (prevScan.totalCookies || 0);
    const consentDelta = (scan.requiresConsent || 0) - (prevScan.requiresConsent || 0);
    const thirdPartyDelta = (scan.thirdParty || 0) - (prevScan.thirdParty || 0);

    let newCookies = 0, removedCookies = 0, changedCookies = 0;
    if (scan.fullResults?.cookies && prevScan.fullResults?.cookies) {
      const prevMap = new Map(prevScan.fullResults.cookies.map(c => [`${c.name}|${c.domain}`, c]));
      const currMap = new Map(scan.fullResults.cookies.map(c => [`${c.name}|${c.domain}`, c]));
      newCookies = scan.fullResults.cookies.filter(c => !prevMap.has(`${c.name}|${c.domain}`)).length;
      removedCookies = prevScan.fullResults.cookies.filter(c => !currMap.has(`${c.name}|${c.domain}`)).length;
      scan.fullResults.cookies.forEach(c => {
        const prev = prevMap.get(`${c.name}|${c.domain}`);
        if (prev && prev.category !== c.category) changedCookies++;
      });
    }

    return { totalDelta, consentDelta, thirdPartyDelta, newCookies, removedCookies, changedCookies };
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp) => {
    const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const getRiskLevel = (scan) => {
    const risks = [scan.gdprRisk, scan.ccpaRisk, scan.dpdpRisk].filter(Boolean);
    if (risks.includes('HIGH')) return 'high';
    if (risks.includes('MEDIUM')) return 'medium';
    if (risks.includes('LOW')) return 'low';
    return 'unknown';
  };

  const DeltaBadge = ({ value, label }) => {
    if (!value || value === 0) return null;
    const isUp = value > 0;
    return (
      <span className={`dsh-delta ${isUp ? 'up' : 'down'}`}>
        {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(value)} {label}
      </span>
    );
  };

  const handleSelectDomain = (domain) => {
    setSelectedDomain(selectedDomain === domain ? null : domain);
    setExpandedScanId(null);
  };

  const handleToggleScan = (scanId) => {
    setExpandedScanId(expandedScanId === scanId ? null : scanId);
  };

  const handleViewScan = (scan) => {
    onViewScan(scan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportScanCSV = (scan) => {
    if (!scan.fullResults?.cookies) return;
    const headers = ['Name', 'Category', 'ML Classification', 'ML Confidence', 'Domain', 'Type', 'Requires Consent'];
    const rows = scan.fullResults.cookies.map(c => [
      c.name, c.category, c.mlClassification || '',
      c.mlConfidence ? Math.round(c.mlConfidence * 100) + '%' : '',
      c.domain, c.type || 'session', c.requiresConsent ? 'Yes' : 'No'
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scan.domain}-scan-${new Date(scan.timestamp).toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter cookies for the expanded view
  const getFilteredCookies = (cookies) => {
    if (!cookies) return [];
    if (cookieFilter === 'all') return cookies;
    return cookies.filter(c => (c.category || 'Unclassified') === cookieFilter);
  };

  const renderCookieRow = (cookie, ci, scanId) => {
    const isEditing = editingCookie === `${scanId}-${cookie.name}-${cookie.domain}`;
    const confidencePercent = cookie.mlConfidence ? Math.round(cookie.mlConfidence * 100) : null;

    return (
      <tr key={ci} className="dsh-tr">
        <td className="dsh-td dsh-td-name" title={cookie.name}>
          <Cookie size={13} className="dsh-td-icon" />
          <span>{cookie.name}</span>
        </td>
        <td className="dsh-td">
          {isEditing ? (
            <select
              className="dsh-category-select"
              defaultValue={cookie.category}
              onChange={(e) => {
                const newCat = e.target.value;
                if (overrideReason.trim()) {
                  handleOverrideCategory(cookie, newCat, scanId);
                }
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : (
            <span className={`dsh-badge cat-${(cookie.category || 'unclassified').toLowerCase().replace(/\s+/g, '-')}`}>
              {cookie.category || 'Unclassified'}
            </span>
          )}
        </td>
        <td className="dsh-td">
          {cookie.mlClassification ? (
            <span className={`dsh-badge dsh-badge-outline cat-${cookie.mlClassification.toLowerCase().replace(/\s+/g, '-')}`}>
              {cookie.mlClassification}
            </span>
          ) : (
            <span className="dsh-muted">—</span>
          )}
        </td>
        <td className="dsh-td dsh-td-center">
          {confidencePercent !== null ? (
            <div className="dsh-confidence-cell">
              <div className="dsh-confidence-bar-track">
                <div
                  className={`dsh-confidence-bar-fill conf-${cookie.mlConfidenceLevel?.toLowerCase() || 'low'}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className={`dsh-confidence-val conf-${cookie.mlConfidenceLevel?.toLowerCase() || 'low'}`}>
                {confidencePercent}%
              </span>
            </div>
          ) : (
            <span className="dsh-muted">—</span>
          )}
        </td>
        <td className="dsh-td dsh-td-domain" title={cookie.domain}>{cookie.domain}</td>
        <td className="dsh-td dsh-td-center">
          {cookie.requiresConsent ? (
            <span className="dsh-consent-badge yes">Required</span>
          ) : (
            <span className="dsh-consent-badge no">No</span>
          )}
        </td>
        <td className="dsh-td dsh-td-center">
          {isEditing ? (
            <button className="dsh-icon-btn" onClick={() => setEditingCookie(null)} title="Cancel">
              <X size={14} />
            </button>
          ) : (
            <button
              className="dsh-icon-btn"
              onClick={() => setEditingCookie(`${scanId}-${cookie.name}-${cookie.domain}`)}
              title="Override category"
            >
              <Edit2 size={14} />
            </button>
          )}
        </td>
      </tr>
    );
  };

  const domains = Object.entries(domainHistory);
  const filteredDomains = searchQuery
    ? domains.filter(([d]) => d.toLowerCase().includes(searchQuery.toLowerCase()))
    : domains;
  const totalScans = domains.reduce((sum, [, s]) => sum + s.length, 0);

  // Stats for domain overview
  const domainStats = useMemo(() => {
    const stats = {};
    domains.forEach(([domain, scans]) => {
      const latest = scans[0];
      const riskLevel = getRiskLevel(latest);
      const totalCookies = latest.totalCookies || latest.fullResults?.cookies?.length || 0;
      const categories = latest.categories || {};
      stats[domain] = { riskLevel, totalCookies, scanCount: scans.length, categories, latest };
    });
    return stats;
  }, [domainHistory]);

  return (
    <div className="dsh">
      {/* Header */}
      <div className="dsh-header">
        <div className="dsh-header-left">
          <div className="dsh-icon-wrap"><Globe size={20} /></div>
          <div>
            <h3 className="dsh-title">Domain Scan History</h3>
            <p className="dsh-subtitle">
              {domains.length} domain{domains.length !== 1 ? 's' : ''} tracked · {totalScans} total scan{totalScans !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="dsh-header-actions">
          {domains.length > 0 && (
            <div className="dsh-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          <button className="dsh-header-btn" onClick={() => setShowHistory(true)} title="View override history">
            <History size={15} />
            <span>Overrides</span>
          </button>
          <button className="dsh-header-btn" onClick={() => setShowSettings(!showSettings)} title="Settings">
            <AlertCircle size={15} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="dsh-settings-panel">
          <div className="dsh-settings-top">
            <h4>Auto-Classification Settings</h4>
            <button className="dsh-close-btn" onClick={() => setShowSettings(false)}><X size={15} /></button>
          </div>
          <div className="dsh-settings-content">
            <label className="dsh-slider-group">
              <span className="dsh-slider-label">Confidence Threshold</span>
              <div className="dsh-slider-row">
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={autoClassifyThreshold}
                  onChange={(e) => setAutoClassifyThreshold(parseFloat(e.target.value))}
                  className="dsh-slider"
                />
                <span className="dsh-slider-value">{Math.round(autoClassifyThreshold * 100)}%</span>
              </div>
              <p className="dsh-slider-help">
                Cookies with ML confidence at or above this threshold will be auto-classified
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Empty state */}
      {domains.length === 0 ? (
        <div className="dsh-empty-state">
          <Shield size={48} className="dsh-empty-icon" />
          <h4>No scan history yet</h4>
          <p>Run a scan to start tracking cookies across your domains</p>
        </div>
      ) : (
        <div className="dsh-grid">
          {/* Domain list sidebar */}
          <div className="dsh-domain-list">
            {filteredDomains.map(([domain, scans]) => {
              const stat = domainStats[domain];
              const isSelected = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  className={`dsh-domain-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDomain(domain)}
                >
                  <div className="dsh-domain-card-top">
                    <span className="dsh-domain-card-name">{domain}</span>
                    <span className={`dsh-risk-indicator ${stat.riskLevel}`} />
                  </div>
                  <div className="dsh-domain-card-stats">
                    <span><Cookie size={12} /> {stat.totalCookies}</span>
                    <span><Layers size={12} /> {stat.scanCount} scan{stat.scanCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="dsh-domain-card-time">
                    <Clock size={11} /> {formatRelativeTime(stat.latest.timestamp)}
                  </div>
                  {/* Category distribution mini-bar */}
                  {stat.categories && Object.keys(stat.categories).length > 0 && (
                    <div className="dsh-mini-bar">
                      {Object.entries(stat.categories).map(([cat, count]) => (
                        <div
                          key={cat}
                          className={`dsh-mini-segment cat-bg-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                          style={{ flex: count }}
                          title={`${cat}: ${count}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
            {filteredDomains.length === 0 && (
              <div className="dsh-no-results">No domains match "{searchQuery}"</div>
            )}
          </div>

          {/* Main content */}
          {selectedDomain ? (
            <div className="dsh-main">
              {/* Domain header */}
              <div className="dsh-main-header">
                <div className="dsh-main-title">
                  <Globe size={18} className="dsh-main-icon" />
                  <h3>{selectedDomain}</h3>
                  <span className={`dsh-risk-pill ${getRiskLevel(domainHistory[selectedDomain][0])}`}>
                    {getRiskLevel(domainHistory[selectedDomain][0]).toUpperCase()} RISK
                  </span>
                </div>
                <button
                  className="dsh-delete-all-btn"
                  onClick={() => {
                    if (window.confirm(`Delete all scans for ${selectedDomain}?`)) {
                      onDeleteDomain(selectedDomain);
                      setSelectedDomain(null);
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete All
                </button>
              </div>

              {/* Scan Timeline */}
              <div className="dsh-timeline">
                {domainHistory[selectedDomain].map((scan, index) => {
                  const prevScan = domainHistory[selectedDomain][index + 1];
                  const changes = getChangeDetection(scan, prevScan);
                  const isExpanded = expandedScanId === scan.id;
                  const overallRisk = getRiskLevel(scan);

                  return (
                    <div key={scan.id} className={`dsh-timeline-item ${isExpanded ? 'expanded' : ''}`}>
                      {/* Timeline line connector */}
                      {index < domainHistory[selectedDomain].length - 1 && (
                        <div className="dsh-timeline-connector" />
                      )}

                      {/* Timeline dot */}
                      <div className={`dsh-timeline-dot ${overallRisk}`} />

                      {/* Scan card */}
                      <div className="dsh-scan-card">
                        <div className="dsh-scan-card-header" onClick={() => handleToggleScan(scan.id)}>
                          <div className="dsh-scan-card-left">
                            <div className="dsh-scan-card-date">
                              <span className="dsh-scan-date-main">{formatDate(scan.timestamp)}</span>
                              <span className="dsh-scan-date-rel">{formatRelativeTime(scan.timestamp)}</span>
                            </div>
                            <div className="dsh-scan-card-tags">
                              <span className={`dsh-type-tag ${scan.scanType || 'quick'}`}>
                                {(scan.scanType || 'quick').toUpperCase()}
                              </span>
                              {scan.fullResults?.pageResults?.length > 1 && (
                                <span className="dsh-type-tag pages">
                                  <Layers size={11} /> {scan.fullResults.pageResults.length} pages
                                </span>
                              )}
                              {index === 0 && <span className="dsh-type-tag latest">LATEST</span>}
                            </div>
                          </div>

                          <div className="dsh-scan-card-metrics">
                            <div className="dsh-metric-block">
                              <span className="dsh-metric-number">{scan.totalCookies || scan.fullResults?.cookies?.length || 0}</span>
                              <span className="dsh-metric-label">Cookies</span>
                            </div>
                            <div className="dsh-metric-block">
                              <span className="dsh-metric-number">{scan.requiresConsent || scan.fullResults?.cookies?.filter(c => c.requiresConsent).length || 0}</span>
                              <span className="dsh-metric-label">Consent</span>
                            </div>
                            <div className="dsh-metric-block">
                              <span className="dsh-metric-number">{scan.thirdParty || scan.fullResults?.cookies?.filter(c => c.isThirdParty || c.type === 'third-party').length || 0}</span>
                              <span className="dsh-metric-label">3rd Party</span>
                            </div>
                            <div className="dsh-scan-card-risk">
                              {scan.gdprRisk && <span className={`dsh-risk-pill-sm ${scan.gdprRisk.toLowerCase()}`}>GDPR: {scan.gdprRisk}</span>}
                              {scan.ccpaRisk && <span className={`dsh-risk-pill-sm ${scan.ccpaRisk.toLowerCase()}`}>CCPA: {scan.ccpaRisk}</span>}
                              {scan.dpdpRisk && <span className={`dsh-risk-pill-sm ${scan.dpdpRisk.toLowerCase()}`}>DPDP: {scan.dpdpRisk}</span>}
                            </div>
                          </div>

                          <div className="dsh-scan-card-expand">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </div>
                        </div>

                        {/* Change detection badges */}
                        {changes && (changes.newCookies > 0 || changes.removedCookies > 0 || changes.changedCookies > 0 || changes.totalDelta !== 0) && (
                          <div className="dsh-changes-row">
                            <DeltaBadge value={changes.totalDelta} label="total" />
                            {changes.newCookies > 0 && (
                              <span className="dsh-delta new">+{changes.newCookies} new</span>
                            )}
                            {changes.removedCookies > 0 && (
                              <span className="dsh-delta removed">-{changes.removedCookies} removed</span>
                            )}
                            {changes.changedCookies > 0 && (
                              <span className="dsh-delta changed">{changes.changedCookies} reclassified</span>
                            )}
                            <DeltaBadge value={changes.consentDelta} label="consent" />
                            <DeltaBadge value={changes.thirdPartyDelta} label="3rd party" />
                          </div>
                        )}

                        {/* Scan action buttons */}
                        <div className="dsh-scan-card-actions">
                          <button className="dsh-action-btn primary" onClick={() => handleViewScan(scan)}>
                            <Eye size={14} /> View Results
                          </button>
                          <button className="dsh-action-btn" onClick={() => setModalScan(scan)}>
                            <ExternalLink size={14} /> Preview
                          </button>
                          <button className="dsh-action-btn" onClick={() => exportScanCSV(scan)}>
                            <Download size={14} /> Export
                          </button>
                          <button
                            className="dsh-action-btn danger"
                            onClick={() => {
                              if (window.confirm('Delete this scan?')) {
                                onDeleteScan(scan.id);
                                if (expandedScanId === scan.id) setExpandedScanId(null);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && scan.fullResults && (
                          <div className="dsh-expanded-details">
                            {/* Category summary bar */}
                            {scan.categories && Object.keys(scan.categories).length > 0 && (
                              <div className="dsh-category-summary">
                                <h4 className="dsh-section-title">Cookie Categories</h4>
                                <div className="dsh-category-bar">
                                  {Object.entries(scan.categories).map(([cat, count]) => (
                                    <div
                                      key={cat}
                                      className={`dsh-category-segment cat-bg-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                                      style={{ flex: count }}
                                      title={`${cat}: ${count}`}
                                    >
                                      <span className="dsh-category-segment-label">{cat}: {count}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="dsh-category-legend">
                                  {Object.entries(scan.categories).map(([cat, count]) => (
                                    <span key={cat} className="dsh-legend-item">
                                      <span className={`dsh-legend-dot cat-bg-${cat.toLowerCase().replace(/\s+/g, '-')}`} />
                                      {cat}: {count} ({Math.round(count / (scan.totalCookies || scan.fullResults?.cookies?.length || 1) * 100)}%)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cookie filter */}
                            <div className="dsh-cookie-toolbar">
                              <h4 className="dsh-section-title">
                                <Cookie size={15} />
                                Cookies ({scan.fullResults.cookies?.length || 0})
                              </h4>
                              <div className="dsh-cookie-toolbar-right">
                                <select
                                  className="dsh-filter-select"
                                  value={cookieFilter}
                                  onChange={(e) => setCookieFilter(e.target.value)}
                                >
                                  <option value="all">All Categories</option>
                                  {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                <button
                                  className="dsh-auto-classify-btn"
                                  onClick={() => handleAutoClassify(scan.fullResults.cookies, scan.id)}
                                >
                                  Auto-Classify ({scan.fullResults.cookies?.filter(c => c.mlConfidence >= autoClassifyThreshold && c.mlClassification && c.category !== c.mlClassification).length || 0})
                                </button>
                              </div>
                            </div>

                            {/* Override reason input */}
                            {editingCookie && editingCookie.startsWith(scan.id) && (
                              <div className="dsh-override-bar">
                                <AlertTriangle size={15} />
                                <input
                                  type="text"
                                  placeholder="Reason for override (required before selecting new category)..."
                                  value={overrideReason}
                                  onChange={(e) => setOverrideReason(e.target.value)}
                                  className="dsh-override-input"
                                />
                              </div>
                            )}

                            {/* Cookie table */}
                            {!scan.fullResults.pageResults && scan.fullResults.cookies && (
                              <div className="dsh-table-wrap">
                                <table className="dsh-table">
                                  <thead>
                                    <tr>
                                      <th>Cookie Name</th>
                                      <th>Category</th>
                                      <th>ML Classification</th>
                                      <th>Confidence</th>
                                      <th>Domain</th>
                                      <th>Consent</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getFilteredCookies(scan.fullResults.cookies).map((cookie, ci) =>
                                      renderCookieRow(cookie, ci, scan.id)
                                    )}
                                    {getFilteredCookies(scan.fullResults.cookies).length === 0 && (
                                      <tr>
                                        <td colSpan="7" className="dsh-td-empty">
                                          No cookies match the selected filter
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Deep scan pages */}
                            {scan.fullResults.pageResults && (
                              <div className="dsh-pages-section">
                                <h4 className="dsh-section-title">
                                  <Layers size={15} />
                                  Pages Scanned ({scan.fullResults.pageResults.length})
                                </h4>
                                <div className="dsh-pages-list">
                                  {scan.fullResults.pageResults.map((page, pi) => {
                                    const pageKey = `${scan.id}-${pi}`;
                                    const isPageExpanded = expandedPages.has(pageKey);
                                    const cookies = page.cookies || [];
                                    return (
                                      <div key={pi} className={`dsh-page-item ${isPageExpanded ? 'expanded' : ''}`}>
                                        <button className="dsh-page-header" onClick={() => togglePageCookies(pageKey)}>
                                          {isPageExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          <span className="dsh-page-url">{page.url}</span>
                                          <span className="dsh-page-badge"><Cookie size={11} /> {cookies.length}</span>
                                        </button>
                                        {isPageExpanded && cookies.length > 0 && (
                                          <div className="dsh-table-wrap">
                                            <table className="dsh-table">
                                              <thead>
                                                <tr>
                                                  <th>Cookie Name</th>
                                                  <th>Category</th>
                                                  <th>ML Classification</th>
                                                  <th>Confidence</th>
                                                  <th>Domain</th>
                                                  <th>Consent</th>
                                                  <th>Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {cookies.map((cookie, ci) => renderCookieRow(cookie, ci, scan.id))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="dsh-placeholder">
              <Globe size={40} />
              <h4>Select a domain</h4>
              <p>Choose a domain from the list to view its scan timeline and cookie details</p>
            </div>
          )}
        </div>
      )}

      {modalScan && <ScanResultModal scan={modalScan} onClose={() => setModalScan(null)} />}

      {/* Override History Modal */}
      {showHistory && (
        <div className="dsh-modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="dsh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dsh-modal-top">
              <h3><History size={18} /> Override History</h3>
              <button className="dsh-close-btn" onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
            <div className="dsh-modal-content">
              {overrideHistory.length === 0 ? (
                <div className="dsh-modal-empty">No overrides yet</div>
              ) : (
                <div className="dsh-override-list">
                  {overrideHistory.map(entry => (
                    <div key={entry.id} className="dsh-override-item">
                      <div className="dsh-override-item-top">
                        <span className="dsh-override-cookie">{entry.cookieName}</span>
                        <span className="dsh-override-time">{formatRelativeTime(entry.timestamp)}</span>
                      </div>
                      <div className="dsh-override-change">
                        <span className={`dsh-badge cat-${entry.oldCategory.toLowerCase().replace(/\s+/g, '-')}`}>
                          {entry.oldCategory}
                        </span>
                        <span className="dsh-override-arrow">→</span>
                        <span className={`dsh-badge cat-${entry.newCategory.toLowerCase().replace(/\s+/g, '-')}`}>
                          {entry.newCategory}
                        </span>
                      </div>
                      {entry.mlClassification && (
                        <p className="dsh-override-ml">
                          ML suggested: {entry.mlClassification} ({Math.round(entry.mlConfidence * 100)}%)
                        </p>
                      )}
                      <p className="dsh-override-reason"><strong>Reason:</strong> {entry.reason}</p>
                      <p className="dsh-override-domain">{entry.cookieDomain}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DomainScanHistory;
