import React, { useState } from 'react';
import { Globe, Clock, Cookie, Eye, Trash2, ChevronDown, ChevronRight, Layers, AlertCircle } from 'lucide-react';
import ScanResultModal from './ScanResultModal';
import './DomainScanHistory.css';

function DomainScanHistory({ domainHistory, onViewScan, onDeleteScan, onDeleteDomain }) {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);
  const [expandedPages, setExpandedPages] = useState(new Set());
  const [modalScan, setModalScan] = useState(null);

  const togglePageCookies = (pageKey) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageKey)) {
      newExpanded.delete(pageKey);
    } else {
      newExpanded.add(pageKey);
    }
    setExpandedPages(newExpanded);
  };

  const handleSelectDomain = (domain) => {
    if (selectedDomain === domain) {
      setSelectedDomain(null);
      setSelectedScan(null);
    } else {
      setSelectedDomain(domain);
      setSelectedScan(null);
    }
  };

  const handleSelectScan = (scan) => {
    if (selectedScan?.id === scan.id) {
      setSelectedScan(null);
    } else {
      setSelectedScan(scan);
    }
  };

  const handleViewScan = (scan) => {
    onViewScan(scan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="domain-scan-history-compact">
      <div className="history-header-compact">
        <div className="header-left">
          <Globe size={20} />
          <h3>Scan History by Domain</h3>
          <span className="domain-count">{Object.keys(domainHistory).length} domain{Object.keys(domainHistory).length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {Object.keys(domainHistory).length === 0 ? (
        <div className="empty-history-compact">
          <AlertCircle size={32} />
          <p>No scan history yet</p>
        </div>
      ) : (
        <div className="history-layout">
          {/* Domain List - Left Side */}
          <div className="domain-list-compact">
            {Object.entries(domainHistory).map(([domain, scans]) => {
              const latestScan = scans[0];
              const isSelected = selectedDomain === domain;

              return (
                <div
                  key={domain}
                  className={`domain-card-compact ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDomain(domain)}
                >
                  <div className="domain-card-header">
                    <Globe size={16} className="domain-icon" />
                    <div className="domain-info-compact">
                      <h4 className="domain-name-compact">{domain}</h4>
                      <span className="scan-count-compact">{scans.length} scan{scans.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="domain-card-stats">
                    <div className="stat-compact">
                      <Cookie size={12} />
                      <span>{latestScan.totalCookies}</span>
                    </div>
                    <div className="stat-compact">
                      <Clock size={12} />
                      <span>{new Date(latestScan.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scan Details - Right Side */}
          {selectedDomain && (
            <div className="scan-details-panel">
              <div className="panel-header">
                <h4>{selectedDomain}</h4>
                <button
                  className="btn-delete-domain"
                  onClick={() => {
                    if (window.confirm(`Delete all ${domainHistory[selectedDomain].length} scan(s) for ${selectedDomain}?`)) {
                      onDeleteDomain(selectedDomain);
                      setSelectedDomain(null);
                    }
                  }}
                  title="Delete all scans for this domain"
                >
                  <Trash2 size={14} />
                  Delete All
                </button>
              </div>

              <div className="scans-list-compact">
                {domainHistory[selectedDomain].map((scan, index) => (
                  <div
                    key={scan.id}
                    className={`scan-card-compact ${selectedScan?.id === scan.id ? 'selected' : ''}`}
                    onClick={() => handleSelectScan(scan)}
                  >
                    <div className="scan-card-header-compact">
                      <div className="scan-info-row">
                        <span className="version-number">V{domainHistory[selectedDomain].length - index}</span>
                        <span className="scan-date">{formatDate(scan.timestamp)}</span>
                        <span className={`scan-type-tag ${scan.scanType}`}>{scan.scanType || 'quick'}</span>
                        {scan.fullResults?.pageResults && scan.fullResults.pageResults.length > 1 && (
                          <span className="pages-tag">
                            <Layers size={10} />
                            {scan.fullResults.pageResults.length}
                          </span>
                        )}
                      </div>
                      <div className="scan-actions-compact">
                        <button
                          className="btn-icon-compact"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalScan(scan);
                          }}
                          title="View scan results in modal"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn-icon-compact danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this scan?')) {
                              onDeleteScan(scan.id);
                              if (selectedScan?.id === scan.id) {
                                setSelectedScan(null);
                              }
                            }
                          }}
                          title="Delete scan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="scan-stats-row">
                      <div className="stat-mini">
                        <Cookie size={12} />
                        <span>{scan.totalCookies}</span>
                      </div>
                      <div className="stat-mini">
                        <span className="stat-mini-label">Consent:</span>
                        <span>{scan.requiresConsent}</span>
                      </div>
                      <div className="stat-mini">
                        <span className="stat-mini-label">3rd:</span>
                        <span>{scan.thirdParty || 0}</span>
                      </div>
                      <div className={`risk-mini ${scan.gdprRisk?.toLowerCase()}`}>
                        {scan.gdprRisk}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Page Details for Selected Scan */}
              {selectedScan && selectedScan.fullResults?.pageResults && (
                <div className="pages-panel">
                  <div className="pages-header">
                    <Layers size={16} />
                    <h5>Scanned Pages ({selectedScan.fullResults.pageResults.length})</h5>
                  </div>
                  <div className="pages-list-compact">
                    {selectedScan.fullResults.pageResults.map((page, pageIdx) => {
                      const pageKey = `${selectedScan.id}-page-${pageIdx}`;
                      const isPageExpanded = expandedPages.has(pageKey);
                      const cookieCount = page.cookieCount || page.cookies?.length || 0;

                      return (
                        <div key={pageIdx} className="page-card-compact">
                          <div
                            className="page-card-header-compact"
                            onClick={() => togglePageCookies(pageKey)}
                          >
                            <button className="page-expand-btn-compact">
                              {isPageExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <Globe size={12} />
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="page-url-compact"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {page.url}
                            </a>
                            <div className="page-stats-compact">
                              <span className="page-stat-compact">
                                <Cookie size={10} />
                                {cookieCount}
                              </span>
                              {page.duration && (
                                <span className="page-stat-compact">
                                  <Clock size={10} />
                                  {page.duration}
                                </span>
                              )}
                            </div>
                          </div>

                          {isPageExpanded && page.cookies && page.cookies.length > 0 && (
                            <div className="cookies-list-compact">
                              {page.cookies.map((cookie, cookieIdx) => (
                                <div key={cookieIdx} className="cookie-row-compact">
                                  <Cookie size={10} />
                                  <span className="cookie-name-compact">{cookie.name}</span>
                                  <span className={`cookie-cat-compact category-${cookie.category?.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {cookie.category}
                                  </span>
                                  <span className="cookie-domain-compact">{cookie.domain}</span>
                                  {cookie.requiresConsent && (
                                    <span className="consent-tag-compact">Consent</span>
                                  )}
                                </div>
                              ))}
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
      )}

      {/* Modal */}
      {modalScan && (
        <ScanResultModal
          scan={modalScan}
          onClose={() => setModalScan(null)}
        />
      )}
    </div>
  );
}

export default DomainScanHistory;
