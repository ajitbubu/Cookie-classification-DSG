import React, { useState, useMemo } from 'react';
import { Calendar, Filter, Download, Trash2, Eye, RefreshCw, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import './ScanHistory.css';

const ScanHistory = ({ history = [], onClearHistory, onViewScan, onDeleteScan }) => {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    domain: '',
    riskLevel: 'all',
    regulation: 'all',
    minCookies: '',
    maxCookies: ''
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: 'timestamp',
    direction: 'desc'
  });
  
  const [selectedScans, setSelectedScans] = useState(new Set());

  // Calculate differences from previous scan
  const getComparisonWithPrevious = (currentScan, index) => {
    if (index >= sortedHistory.length - 1) return null;
    
    // Find the previous scan for the same domain
    const previousScan = sortedHistory.slice(index + 1).find(s => s.domain === currentScan.domain);
    if (!previousScan) return null;
    
    return {
      totalCookies: (currentScan.totalCookies || 0) - (previousScan.totalCookies || 0),
      requiresConsent: (currentScan.requiresConsent || 0) - (previousScan.requiresConsent || 0),
      thirdParty: (currentScan.thirdParty || 0) - (previousScan.thirdParty || 0)
    };
  };

  // Apply filters
  const filteredHistory = useMemo(() => {
    return history.filter(scan => {
      // Date range filter
      if (filters.dateFrom) {
        const scanDate = new Date(scan.timestamp);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (scanDate < fromDate) return false;
      }
      
      if (filters.dateTo) {
        const scanDate = new Date(scan.timestamp);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (scanDate > toDate) return false;
      }
      
      // Domain filter
      if (filters.domain && !scan.domain.toLowerCase().includes(filters.domain.toLowerCase())) {
        return false;
      }
      
      // Risk level filter
      if (filters.riskLevel !== 'all') {
        const hasHighRisk = scan.gdprRisk === 'HIGH' || scan.ccpaRisk === 'HIGH' || scan.dpdpRisk === 'HIGH';
        const hasMediumRisk = scan.gdprRisk === 'MEDIUM' || scan.ccpaRisk === 'MEDIUM' || scan.dpdpRisk === 'MEDIUM';
        const hasLowRisk = scan.gdprRisk === 'LOW' && scan.ccpaRisk === 'LOW' && scan.dpdpRisk === 'LOW';
        
        if (filters.riskLevel === 'high' && !hasHighRisk) return false;
        if (filters.riskLevel === 'medium' && !hasMediumRisk) return false;
        if (filters.riskLevel === 'low' && !hasLowRisk) return false;
      }
      
      // Regulation-specific filter
      if (filters.regulation !== 'all') {
        const riskMap = {
          'gdpr': scan.gdprRisk,
          'ccpa': scan.ccpaRisk,
          'dpdp': scan.dpdpRisk
        };
        if (riskMap[filters.regulation] === 'LOW') return false;
      }
      
      // Cookie count range
      if (filters.minCookies && scan.totalCookies < parseInt(filters.minCookies)) {
        return false;
      }
      
      if (filters.maxCookies && scan.totalCookies > parseInt(filters.maxCookies)) {
        return false;
      }
      
      return true;
    });
  }, [history, filters]);

  // Apply sorting
  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];
    
    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle timestamp separately
      if (sortConfig.key === 'timestamp') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
    
    return sorted;
  }, [filteredHistory, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      domain: '',
      riskLevel: 'all',
      regulation: 'all',
      minCookies: '',
      maxCookies: ''
    });
  };

  const toggleSelectScan = (id) => {
    setSelectedScans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedScans.size === sortedHistory.length) {
      setSelectedScans(new Set());
    } else {
      setSelectedScans(new Set(sortedHistory.map(s => s.id)));
    }
  };

  const deleteSelected = () => {
    if (window.confirm(`Delete ${selectedScans.size} selected scan(s)?`)) {
      selectedScans.forEach(id => onDeleteScan(id));
      setSelectedScans(new Set());
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Domain', 'URL', 'Total Cookies', 'Requires Consent', 'GDPR Risk', 'CCPA Risk', 'DPDP Risk'];
    const rows = sortedHistory.map(scan => [
      new Date(scan.timestamp).toLocaleString(),
      scan.domain,
      scan.url,
      scan.totalCookies,
      scan.requiresConsent,
      scan.gdprRisk,
      scan.ccpaRisk,
      scan.dpdpRisk
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskBadgeClass = (risk) => {
    return `risk-badge risk-${risk.toLowerCase()}`;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp className="sort-icon inactive" size={16} />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="sort-icon active" size={16} />
      : <ChevronDown className="sort-icon active" size={16} />;
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  return (
    <div className="scan-history-container">
      <div className="history-header">
        <div className="header-left">
          <Calendar className="header-icon" />
          <div>
            <h2>Scan History</h2>
            <p className="subtitle">
              {sortedHistory.length} of {history.length} scans
              {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
            </p>
          </div>
        </div>
        
        <div className="header-actions">
          {selectedScans.size > 0 && (
            <button onClick={deleteSelected} className="btn btn-danger">
              <Trash2 className="icon" size={16} />
              Delete ({selectedScans.size})
            </button>
          )}
          
          <button onClick={exportToCSV} className="btn btn-secondary" disabled={sortedHistory.length === 0}>
            <Download className="icon" size={16} />
            Export CSV
          </button>
          
          <button onClick={onClearHistory} className="btn btn-secondary">
            <Trash2 className="icon" size={16} />
            Clear All
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <div className="filters-title">
            <Filter className="icon" size={18} />
            <span>Filters</span>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="btn-link">
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>
        
        <div className="filters-grid">
          {/* Date Range */}
          <div className="filter-group">
            <label>Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="filter-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="filter-input"
            />
          </div>
          
          {/* Domain Search */}
          <div className="filter-group">
            <label>Domain</label>
            <div className="input-with-icon">
              <Search className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Search domain..."
                value={filters.domain}
                onChange={(e) => handleFilterChange('domain', e.target.value)}
                className="filter-input with-icon"
              />
            </div>
          </div>
          
          {/* Risk Level */}
          <div className="filter-group">
            <label>Risk Level</label>
            <select
              value={filters.riskLevel}
              onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
          
          {/* Regulation */}
          <div className="filter-group">
            <label>Regulation</label>
            <select
              value={filters.regulation}
              onChange={(e) => handleFilterChange('regulation', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Regulations</option>
              <option value="gdpr">GDPR Issues</option>
              <option value="ccpa">CCPA Issues</option>
              <option value="dpdp">DPDP Issues</option>
            </select>
          </div>
          
          {/* Cookie Count Range */}
          <div className="filter-group">
            <label>Min Cookies</label>
            <input
              type="number"
              placeholder="Min"
              value={filters.minCookies}
              onChange={(e) => handleFilterChange('minCookies', e.target.value)}
              className="filter-input"
              min="0"
            />
          </div>
          
          <div className="filter-group">
            <label>Max Cookies</label>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxCookies}
              onChange={(e) => handleFilterChange('maxCookies', e.target.value)}
              className="filter-input"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Total Scans:</span>
          <span className="stat-value">{sortedHistory.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Cookies:</span>
          <span className="stat-value">
            {sortedHistory.length > 0 
              ? Math.round(sortedHistory.reduce((sum, s) => sum + (s.totalCookies || 0), 0) / sortedHistory.length)
              : 0}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">High Risk:</span>
          <span className="stat-value stat-danger">
            {sortedHistory.filter(s => 
              s.gdprRisk === 'HIGH' || s.ccpaRisk === 'HIGH' || s.dpdpRisk === 'HIGH'
            ).length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input
                  type="checkbox"
                  checked={selectedScans.size === sortedHistory.length && sortedHistory.length > 0}
                  onChange={toggleSelectAll}
                  disabled={sortedHistory.length === 0}
                />
              </th>
              <th onClick={() => handleSort('timestamp')} className="sortable">
                <div className="th-content">
                  Scan Date & Time
                  <SortIcon columnKey="timestamp" />
                </div>
              </th>
              <th onClick={() => handleSort('domain')} className="sortable">
                <div className="th-content">
                  Domain
                  <SortIcon columnKey="domain" />
                </div>
              </th>
              <th onClick={() => handleSort('totalCookies')} className="sortable">
                <div className="th-content">
                  Total Cookies
                  <SortIcon columnKey="totalCookies" />
                </div>
              </th>
              <th onClick={() => handleSort('requiresConsent')} className="sortable">
                <div className="th-content">
                  Requires Consent
                  <SortIcon columnKey="requiresConsent" />
                </div>
              </th>
              <th>Party Type</th>
              <th>Categories</th>
              <th>Changes</th>
              <th>GDPR</th>
              <th>CCPA</th>
              <th>DPDP</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.length === 0 ? (
              <tr>
                <td colSpan="12" className="empty-state">
                  <div className="empty-content">
                    <Calendar className="empty-icon" size={48} />
                    <p className="empty-title">No scans found</p>
                    <p className="empty-subtitle">
                      {history.length === 0 
                        ? 'Start scanning to see history here'
                        : 'Try adjusting your filters'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedHistory.map((scan, index) => {
                const comparison = getComparisonWithPrevious(scan, index);
                return (
                  <tr key={scan.id} className={selectedScans.has(scan.id) ? 'selected' : ''}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selectedScans.has(scan.id)}
                        onChange={() => toggleSelectScan(scan.id)}
                      />
                    </td>
                    <td className="timestamp-cell">
                      <div className="timestamp-content">
                        <span className="date">{new Date(scan.timestamp).toLocaleDateString()}</span>
                        <span className="time">{new Date(scan.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="domain-cell">
                      <div className="domain-content">
                        <span className="domain-name">{scan.domain}</span>
                        <span className="domain-url" title={scan.url}>{scan.url}</span>
                      </div>
                    </td>
                    <td className="number-cell">
                      <span className="cookie-count">{scan.totalCookies}</span>
                    </td>
                    <td className="number-cell">
                      <span className={`consent-count ${scan.requiresConsent > 0 ? 'has-consent' : ''}`}>
                        {scan.requiresConsent}
                      </span>
                    </td>
                    <td className="party-type-cell">
                      <div className="party-breakdown">
                        <div className="party-item">
                          <span className="party-badge first-party">1st Party</span>
                          <span className="party-count">{(scan.totalCookies || 0) - (scan.thirdParty || 0)}</span>
                        </div>
                        <div className="party-item">
                          <span className="party-badge third-party">3rd Party</span>
                          <span className="party-count">{scan.thirdParty || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td className="categories-cell">
                      <div className="categories-list">
                        {scan.categories && Object.entries(scan.categories).map(([category, count]) => (
                          <div key={category} className="category-item">
                            <span className={`category-badge-small ${category.toLowerCase().replace(/\s+/g, '-')}`}>
                              {category}
                            </span>
                            <span className="category-count">{count}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="changes-cell">
                      {comparison ? (
                        <div className="changes-container">
                          {!isNaN(comparison.totalCookies) && comparison.totalCookies !== 0 && (
                            <div className={`change-badge ${comparison.totalCookies > 0 ? 'increase' : 'decrease'}`}>
                              <span className="change-label">Total:</span>
                              <span className="change-value">
                                {comparison.totalCookies > 0 ? '+' : ''}{comparison.totalCookies}
                              </span>
                            </div>
                          )}
                          {!isNaN(comparison.requiresConsent) && comparison.requiresConsent !== 0 && (
                            <div className={`change-badge ${comparison.requiresConsent > 0 ? 'increase' : 'decrease'}`}>
                              <span className="change-label">Consent:</span>
                              <span className="change-value">
                                {comparison.requiresConsent > 0 ? '+' : ''}{comparison.requiresConsent}
                              </span>
                            </div>
                          )}
                          {!isNaN(comparison.thirdParty) && comparison.thirdParty !== 0 && (
                            <div className={`change-badge ${comparison.thirdParty > 0 ? 'increase' : 'decrease'}`}>
                              <span className="change-label">3rd Party:</span>
                              <span className="change-value">
                                {comparison.thirdParty > 0 ? '+' : ''}{comparison.thirdParty}
                              </span>
                            </div>
                          )}
                          {(isNaN(comparison.totalCookies) || comparison.totalCookies === 0) && 
                           (isNaN(comparison.requiresConsent) || comparison.requiresConsent === 0) && 
                           (isNaN(comparison.thirdParty) || comparison.thirdParty === 0) && (
                            <span className="no-change">No change</span>
                          )}
                        </div>
                      ) : (
                        <span className="first-scan">First scan</span>
                      )}
                    </td>
                    <td>
                    <span className={getRiskBadgeClass(scan.gdprRisk)}>
                      {scan.gdprRisk}
                    </span>
                  </td>
                  <td>
                    <span className={getRiskBadgeClass(scan.ccpaRisk)}>
                      {scan.ccpaRisk}
                    </span>
                  </td>
                  <td>
                    <span className={getRiskBadgeClass(scan.dpdpRisk)}>
                      {scan.dpdpRisk}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        onClick={() => onViewScan(scan)}
                        className="btn-icon"
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteScan(scan.id)}
                        className="btn-icon btn-icon-danger"
                        title="Delete scan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScanHistory;
