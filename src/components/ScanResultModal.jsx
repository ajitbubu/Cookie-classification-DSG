import React, { useState } from 'react';
import { X, Cookie, Layers, Globe, Shield, Calendar, Clock } from 'lucide-react';
import './ScanResultModal.css';

function ScanResultModal({ scan, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!scan) return null;

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

  const getRiskClass = (risk) => {
    switch (risk?.toUpperCase()) {
      case 'HIGH': return 'risk-high';
      case 'MEDIUM': return 'risk-medium';
      case 'LOW': return 'risk-low';
      default: return 'risk-unknown';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <h2 className="modal-title">Scan Results</h2>
            <div className="modal-meta">
              <span className="meta-badge">
                <Calendar size={14} />
                {formatDate(scan.timestamp)}
              </span>
              <span className="meta-badge">
                <Globe size={14} />
                {scan.domain}
              </span>
              <span className={`meta-badge scan-type ${scan.scanType}`}>
                {scan.scanType || 'quick'}
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="modal-stats-grid">
          <div className="modal-stat-card">
            <Cookie size={20} />
            <div className="stat-info">
              <span className="stat-label">Total Cookies</span>
              <span className="stat-value">{scan.totalCookies || 0}</span>
            </div>
          </div>
          <div className="modal-stat-card">
            <Layers size={20} />
            <div className="stat-info">
              <span className="stat-label">Categories</span>
              <span className="stat-value">{Object.keys(scan.categories || {}).length}</span>
            </div>
          </div>
          <div className="modal-stat-card">
            <Globe size={20} />
            <div className="stat-info">
              <span className="stat-label">Third Party</span>
              <span className="stat-value">{scan.thirdParty || 0}</span>
            </div>
          </div>
          <div className="modal-stat-card">
            <Shield size={20} />
            <div className="stat-info">
              <span className="stat-label">Require Consent</span>
              <span className="stat-value">{scan.requiresConsent || 0}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`modal-tab ${activeTab === 'cookies' ? 'active' : ''}`}
            onClick={() => setActiveTab('cookies')}
          >
            Cookies ({scan.totalCookies || 0})
          </button>
          {scan.fullResults?.pageResults && scan.fullResults.pageResults.length > 0 && (
            <button
              className={`modal-tab ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
            >
              Pages ({scan.fullResults.pageResults.length})
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="modal-content">
          {activeTab === 'overview' && (
            <div className="overview-content">
              {/* Risk Assessment */}
              <div className="overview-section">
                <h3 className="section-title">Risk Assessment</h3>
                <div className="risk-cards">
                  <div className="risk-card">
                    <span className="risk-label">GDPR</span>
                    <span className={`risk-badge ${getRiskClass(scan.gdprRisk)}`}>
                      {scan.gdprRisk || 'N/A'}
                    </span>
                  </div>
                  <div className="risk-card">
                    <span className="risk-label">CCPA</span>
                    <span className={`risk-badge ${getRiskClass(scan.ccpaRisk)}`}>
                      {scan.ccpaRisk || 'N/A'}
                    </span>
                  </div>
                  <div className="risk-card">
                    <span className="risk-label">DPDP</span>
                    <span className={`risk-badge ${getRiskClass(scan.dpdpRisk)}`}>
                      {scan.dpdpRisk || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Categories Breakdown */}
              <div className="overview-section">
                <h3 className="section-title">Cookie Categories</h3>
                <div className="categories-list">
                  {Object.entries(scan.categories || {}).map(([category, count]) => (
                    <div key={category} className="category-row">
                      <span className={`category-badge category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {category}
                      </span>
                      <span className="category-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="cookies-content">
              <div className="cookies-table-modal">
                <div className="table-header-modal">
                  <span className="col-name">Name</span>
                  <span className="col-category">Category</span>
                  <span className="col-domain">Domain</span>
                  <span className="col-consent">Consent</span>
                </div>
                <div className="table-body-modal">
                  {(scan.fullResults?.cookies || []).map((cookie, idx) => (
                    <div key={idx} className="table-row-modal">
                      <span className="col-name">
                        <Cookie size={12} />
                        {cookie.name}
                      </span>
                      <span className="col-category">
                        <span 
                          className={`category-badge category-${(cookie.category || 'uncategorized').toLowerCase().replace(/\s+/g, '-')}`}
                          role="status"
                          aria-label={`Cookie category: ${cookie.category || 'Uncategorized'}`}
                        >
                          {cookie.category || 'Uncategorized'}
                        </span>
                      </span>
                      <span className="col-domain">{cookie.domain}</span>
                      <span className="col-consent">
                        {cookie.requiresConsent ? (
                          <span className="consent-yes">Required</span>
                        ) : (
                          <span className="consent-no">Not Required</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pages' && scan.fullResults?.pageResults && (
            <div className="pages-content">
              {scan.fullResults.pageResults.map((page, idx) => (
                <div key={idx} className="page-item-modal">
                  <div className="page-header-modal">
                    <Globe size={14} />
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="page-url-modal">
                      {page.url}
                    </a>
                  </div>
                  <div className="page-stats-modal">
                    <span className="page-stat-modal">
                      <Cookie size={12} />
                      {page.cookieCount || page.cookies?.length || 0} cookies
                    </span>
                    {page.duration && (
                      <span className="page-stat-modal">
                        <Clock size={12} />
                        {page.duration}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanResultModal;
