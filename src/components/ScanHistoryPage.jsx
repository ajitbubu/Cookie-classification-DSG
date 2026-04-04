import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Globe,
  AlertTriangle,
  ArrowLeft,
  GitCompare,
  Clock,
  Shield
} from 'lucide-react';
import ScanHistory from './ScanHistory';
import DomainScanHistory from './DomainScanHistory';
import './ScanHistoryPage.css';

const ScanHistoryPage = ({
  scanHistory = [],
  domainHistory = {},
  onViewScan,
  onDeleteScan,
  onClearHistory,
  onDeleteDomain,
  deleteScanFromDomain,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState('all');

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalScans = scanHistory.length;
    const uniqueDomains = new Set(scanHistory.map(scan => scan.domain)).size;

    // Count high-risk scans (those with requiresConsent > 0 or high confidence in sensitive categories)
    const highRiskCount = scanHistory.filter(scan => {
      const requiresConsentCount = scan.requiresConsent || 0;
      const highRiskCategories = ['Marketing', 'Tracking', 'Analytics'];
      const hasHighRiskCookies = scan.cookies?.some(cookie =>
        highRiskCategories.includes(cookie.category)
      );
      return requiresConsentCount > 0 || hasHighRiskCookies;
    }).length;

    // Get the most recent scan timestamp
    const lastScanDate = scanHistory.length > 0
      ? new Date(scanHistory[0]?.timestamp || Date.now())
      : null;

    return {
      totalScans,
      uniqueDomains,
      highRiskCount,
      lastScanDate
    };
  }, [scanHistory]);

  const handleNavigateHome = () => {
    onNavigate('home');
  };

  const handleNavigateCompare = () => {
    onNavigate('compare');
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="shp-container">
      {/* Header Section */}
      <div className="shp-header">
        <div className="shp-header-top">
          <button
            className="shp-back-button"
            onClick={handleNavigateHome}
            aria-label="Back to Scanner"
            title="Back to Scanner"
          >
            <ArrowLeft size={18} />
            <span>Back to Scanner</span>
          </button>

          <div className="shp-header-content">
            <h1 className="shp-title">Scan History</h1>
            <p className="shp-description">
              View and manage your previous website scans and cookie analyses
            </p>
          </div>

          <button
            className="shp-compare-button"
            onClick={handleNavigateCompare}
            aria-label="Compare Scans"
            title="Compare Scans"
          >
            <GitCompare size={18} />
            <span>Compare Scans</span>
          </button>
        </div>

        {/* Summary Stats Bar */}
        <div className="shp-stats-bar">
          <div className="shp-stat-item">
            <div className="shp-stat-icon shp-stat-icon-scans">
              <Clock size={20} />
            </div>
            <div className="shp-stat-content">
              <div className="shp-stat-label">Total Scans</div>
              <div className="shp-stat-value">{stats.totalScans}</div>
            </div>
          </div>

          <div className="shp-stat-item">
            <div className="shp-stat-icon shp-stat-icon-domains">
              <Globe size={20} />
            </div>
            <div className="shp-stat-content">
              <div className="shp-stat-label">Unique Domains</div>
              <div className="shp-stat-value">{stats.uniqueDomains}</div>
            </div>
          </div>

          <div className="shp-stat-item">
            <div className="shp-stat-icon shp-stat-icon-risk">
              <AlertTriangle size={20} />
            </div>
            <div className="shp-stat-content">
              <div className="shp-stat-label">High Risk Scans</div>
              <div className="shp-stat-value">{stats.highRiskCount}</div>
            </div>
          </div>

          <div className="shp-stat-item">
            <div className="shp-stat-icon shp-stat-icon-time">
              <Calendar size={20} />
            </div>
            <div className="shp-stat-content">
              <div className="shp-stat-label">Last Scan</div>
              <div className="shp-stat-value">
                {stats.lastScanDate ? formatDate(stats.lastScanDate) : 'Never'}
              </div>
              {stats.lastScanDate && (
                <div className="shp-stat-subtext">{formatTime(stats.lastScanDate)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="shp-tabs-container">
        <div className="shp-tabs">
          <button
            className={`shp-tab ${activeTab === 'all' ? 'shp-tab-active' : ''}`}
            onClick={() => setActiveTab('all')}
            aria-selected={activeTab === 'all'}
            role="tab"
          >
            <Clock size={16} />
            <span>All Scans</span>
          </button>

          <button
            className={`shp-tab ${activeTab === 'domain' ? 'shp-tab-active' : ''}`}
            onClick={() => setActiveTab('domain')}
            aria-selected={activeTab === 'domain'}
            role="tab"
          >
            <Globe size={16} />
            <span>By Domain</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="shp-content">
        {scanHistory.length === 0 ? (
          <div className="shp-empty-state">
            <Shield size={48} />
            <h2>No Scans Yet</h2>
            <p>Start by running a scan to see your history here</p>
            <button
              className="shp-empty-action-button"
              onClick={handleNavigateHome}
            >
              <ArrowLeft size={16} />
              Go to Scanner
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'all' && (
              <div className="shp-tab-pane shp-tab-pane-active">
                <ScanHistory
                  history={scanHistory}
                  onViewScan={onViewScan}
                  onDeleteScan={onDeleteScan}
                  onClearHistory={onClearHistory}
                />
              </div>
            )}

            {activeTab === 'domain' && (
              <div className="shp-tab-pane shp-tab-pane-active">
                <DomainScanHistory
                  domainHistory={domainHistory}
                  onViewScan={onViewScan}
                  onDeleteScan={onDeleteScan}
                  onDeleteDomain={onDeleteDomain}
                  deleteScanFromDomain={deleteScanFromDomain}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScanHistoryPage;
