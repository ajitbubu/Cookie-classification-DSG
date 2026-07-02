import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Cookie
} from 'lucide-react';

const CompareScanPage = ({ scanHistory, onNavigate }) => {
  const [scanAId, setScanAId] = useState(null);
  const [scanBId, setScanBId] = useState(null);
  const [hasCompared, setHasCompared] = useState(false);
  const [expandedUnchanged, setExpandedUnchanged] = useState(false);

  // Initialize default scans on mount
  React.useEffect(() => {
    if (scanHistory.length >= 2) {
      // Try to find two most recent scans from the same domain
      const sortedByTime = [...scanHistory].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      const firstScanDomain = sortedByTime[0].domain;
      const sameDomainScans = sortedByTime.filter(s => s.domain === firstScanDomain);

      if (sameDomainScans.length >= 2) {
        setScanAId(sameDomainScans[1].id);
        setScanBId(sameDomainScans[0].id);
      } else {
        // Default to first two most recent scans
        setScanAId(sortedByTime[1].id);
        setScanBId(sortedByTime[0].id);
      }
    }
  }, [scanHistory]);

  // Comparison logic
  const comparisonData = useMemo(() => {
    if (!scanAId || !scanBId) return null;

    const scanA = scanHistory.find(s => s.id === scanAId);
    const scanB = scanHistory.find(s => s.id === scanBId);

    if (!scanA || !scanB) return null;

    // Check if we have full results available
    if (!scanA.fullResults?.cookies || !scanB.fullResults?.cookies) {
      return { error: 'Detailed comparison unavailable for one or both scans' };
    }

    const cookiesA = scanA.fullResults.cookies;
    const cookiesB = scanB.fullResults.cookies;

    // Create a map for quick lookup
    const mapA = new Map(cookiesA.map(c => [`${c.name}|${c.domain}`, c]));
    const mapB = new Map(cookiesB.map(c => [`${c.name}|${c.domain}`, c]));

    // Find new cookies (in B but not in A)
    const newCookies = Array.from(mapB.values()).filter(
      cookie => !mapA.has(`${cookie.name}|${cookie.domain}`)
    );

    // Find removed cookies (in A but not in B)
    const removedCookies = Array.from(mapA.values()).filter(
      cookie => !mapB.has(`${cookie.name}|${cookie.domain}`)
    );

    // Find changed cookies (category changes)
    const changedCookies = Array.from(mapB.values())
      .filter(cookieB => {
        const cookieA = mapA.get(`${cookieB.name}|${cookieB.domain}`);
        return cookieA && cookieA.category !== cookieB.category;
      })
      .map(cookieB => {
        const cookieA = mapA.get(`${cookieB.name}|${cookieB.domain}`);
        return {
          ...cookieB,
          oldCategory: cookieA.category
        };
      });

    // Count first-party vs third-party
    const countFirstParty = (cookies) => {
      return cookies.filter(c => c.type === 'first-party' || !c.type).length;
    };

    const countThirdParty = (cookies) => {
      return cookies.filter(c => c.type === 'third-party').length;
    };

    const firstPartyA = countFirstParty(cookiesA);
    const thirdPartyA = countThirdParty(cookiesA);
    const firstPartyB = countFirstParty(cookiesB);
    const thirdPartyB = countThirdParty(cookiesB);

    // Unchanged cookies
    const unchangedCookies = Array.from(mapB.values()).filter(
      cookieB => {
        const cookieA = mapA.get(`${cookieB.name}|${cookieB.domain}`);
        return cookieA && cookieA.category === cookieB.category;
      }
    );

    return {
      scanA,
      scanB,
      newCookies,
      removedCookies,
      changedCookies,
      unchangedCookies,
      summaryA: {
        total: cookiesA.length,
        firstParty: firstPartyA,
        thirdParty: thirdPartyA
      },
      summaryB: {
        total: cookiesB.length,
        firstParty: firstPartyB,
        thirdParty: thirdPartyB
      }
    };
  }, [scanAId, scanBId, scanHistory]);

  const handleCompare = useCallback(() => {
    setHasCompared(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!comparisonData || comparisonData.error) return;

    const { scanA, scanB, newCookies, removedCookies, changedCookies } = comparisonData;

    const rows = [];
    rows.push(['Cookie Comparison Report']);
    rows.push([`Scan A: ${new Date(scanA.timestamp).toLocaleString()} - ${scanA.domain}`]);
    rows.push([`Scan B: ${new Date(scanB.timestamp).toLocaleString()} - ${scanB.domain}`]);
    rows.push([]);

    // New cookies
    rows.push(['NEW COOKIES']);
    rows.push(['Name', 'Category', 'Domain', 'Type', 'Risk Level']);
    newCookies.forEach(c => {
      rows.push([c.name, c.category, c.domain, c.type || 'first-party', c.risk || 'unknown']);
    });
    rows.push([]);

    // Removed cookies
    rows.push(['REMOVED COOKIES']);
    rows.push(['Name', 'Category', 'Domain', 'Type', 'Risk Level']);
    removedCookies.forEach(c => {
      rows.push([c.name, c.category, c.domain, c.type || 'first-party', c.risk || 'unknown']);
    });
    rows.push([]);

    // Changed cookies
    rows.push(['CATEGORY CHANGES']);
    rows.push(['Name', 'Old Category', 'New Category', 'Domain']);
    changedCookies.forEach(c => {
      rows.push([c.name, c.oldCategory, c.category, c.domain]);
    });

    // Create CSV content
    const csvContent = rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookie-comparison-${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [comparisonData]);

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high':
        return 'csp-risk-high';
      case 'medium':
        return 'csp-risk-medium';
      case 'low':
        return 'csp-risk-low';
      default:
        return 'csp-risk-unknown';
    }
  };

  const formatDelta = (oldVal, newVal) => {
    const delta = newVal - oldVal;
    if (delta === 0) return null;
    return {
      value: Math.abs(delta),
      isPositive: delta > 0,
      delta
    };
  };

  return (
    <div className="csp-page">
      {/* Header */}
      <div className="csp-header">
        <button
          className="csp-back-btn"
          onClick={() => onNavigate('history')}
          aria-label="Go back to scan history"
        >
          <ArrowLeft size={20} />
          <span>Back to Scan History</span>
        </button>
        <div className="csp-title-section">
          <div className="csp-title-icon">
            <GitCompare size={32} />
          </div>
          <div>
            <h1 className="csp-title">Compare Scans</h1>
            <p className="csp-description">
              Select two scans to compare cookie changes, additions, and removals
            </p>
          </div>
        </div>
      </div>

      {/* Scan Selection */}
      <div className="csp-section">
        <h2 className="csp-section-title">Select Scans to Compare</h2>
        <div className="csp-selection-container">
          <div className="csp-dropdown-wrapper">
            <label className="csp-label">Scan A (Earlier)</label>
            <select
              className="csp-dropdown"
              value={scanAId || ''}
              onChange={(e) => setScanAId(e.target.value || null)}
            >
              <option value="">Choose a scan...</option>
              {scanHistory.map(scan => (
                <option key={scan.id} value={scan.id}>
                  {new Date(scan.timestamp).toLocaleDateString()} -{' '}
                  {scan.domain} ({scan.totalCookies} cookies)
                </option>
              ))}
            </select>
          </div>

          <div className="csp-comparison-icon">
            <GitCompare size={24} />
          </div>

          <div className="csp-dropdown-wrapper">
            <label className="csp-label">Scan B (Later)</label>
            <select
              className="csp-dropdown"
              value={scanBId || ''}
              onChange={(e) => setScanBId(e.target.value || null)}
            >
              <option value="">Choose a scan...</option>
              {scanHistory.map(scan => (
                <option key={scan.id} value={scan.id}>
                  {new Date(scan.timestamp).toLocaleDateString()} -{' '}
                  {scan.domain} ({scan.totalCookies} cookies)
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="csp-compare-btn"
          onClick={handleCompare}
          disabled={!scanAId || !scanBId}
        >
          <GitCompare size={18} />
          Compare
        </button>
      </div>

      {/* Results */}
      {hasCompared && comparisonData && (
        <>
          {comparisonData.error ? (
            <div className="csp-section csp-error-message">
              <AlertTriangle size={20} />
              <p>{comparisonData.error}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="csp-section">
                <h2 className="csp-section-title">Summary</h2>
                <div className="csp-summary-cards">
                  <div className="csp-summary-card">
                    <div className="csp-summary-label">Total Cookies</div>
                    <div className="csp-summary-values">
                      <span className="csp-value-a">
                        {comparisonData.summaryA.total}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className="csp-value-b">
                        {comparisonData.summaryB.total}
                      </span>
                    </div>
                    {(() => {
                      const delta = formatDelta(
                        comparisonData.summaryA.total,
                        comparisonData.summaryB.total
                      );
                      return delta && (
                        <div className={`csp-delta ${delta.isPositive ? 'csp-positive' : 'csp-negative'}`}>
                          {delta.isPositive ? (
                            <ArrowUpRight size={14} />
                          ) : (
                            <ArrowDownRight size={14} />
                          )}
                          {delta.value}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="csp-summary-card">
                    <div className="csp-summary-label">First-Party</div>
                    <div className="csp-summary-values">
                      <span className="csp-value-a">
                        {comparisonData.summaryA.firstParty}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className="csp-value-b">
                        {comparisonData.summaryB.firstParty}
                      </span>
                    </div>
                    {(() => {
                      const delta = formatDelta(
                        comparisonData.summaryA.firstParty,
                        comparisonData.summaryB.firstParty
                      );
                      return delta && (
                        <div className={`csp-delta ${delta.isPositive ? 'csp-positive' : 'csp-negative'}`}>
                          {delta.isPositive ? (
                            <ArrowUpRight size={14} />
                          ) : (
                            <ArrowDownRight size={14} />
                          )}
                          {delta.value}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="csp-summary-card">
                    <div className="csp-summary-label">Third-Party</div>
                    <div className="csp-summary-values">
                      <span className="csp-value-a">
                        {comparisonData.summaryA.thirdParty}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className="csp-value-b">
                        {comparisonData.summaryB.thirdParty}
                      </span>
                    </div>
                    {(() => {
                      const delta = formatDelta(
                        comparisonData.summaryA.thirdParty,
                        comparisonData.summaryB.thirdParty
                      );
                      return delta && (
                        <div className={`csp-delta ${delta.isPositive ? 'csp-positive' : 'csp-negative'}`}>
                          {delta.isPositive ? (
                            <ArrowUpRight size={14} />
                          ) : (
                            <ArrowDownRight size={14} />
                          )}
                          {delta.value}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="csp-summary-card">
                    <div className="csp-summary-label">GDPR Risk</div>
                    <div className="csp-summary-values">
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanA.gdprRisk)}`}>
                        {comparisonData.scanA.gdprRisk || 'unknown'}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanB.gdprRisk)}`}>
                        {comparisonData.scanB.gdprRisk || 'unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="csp-summary-card">
                    <div className="csp-summary-label">CCPA Risk</div>
                    <div className="csp-summary-values">
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanA.ccpaRisk)}`}>
                        {comparisonData.scanA.ccpaRisk || 'unknown'}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanB.ccpaRisk)}`}>
                        {comparisonData.scanB.ccpaRisk || 'unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="csp-summary-card">
                    <div className="csp-summary-label">DPDP Risk</div>
                    <div className="csp-summary-values">
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanA.dpdpRisk)}`}>
                        {comparisonData.scanA.dpdpRisk || 'unknown'}
                      </span>
                      <span className="csp-arrow">→</span>
                      <span className={`csp-risk-badge ${getRiskColor(comparisonData.scanB.dpdpRisk)}`}>
                        {comparisonData.scanB.dpdpRisk || 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* New Cookies Table */}
              {comparisonData.newCookies.length > 0 && (
                <div className="csp-section">
                  <h2 className="csp-section-title csp-new-cookies">
                    <span>New Cookies</span>
                    <span className="csp-count">{comparisonData.newCookies.length}</span>
                  </h2>
                  <div className="csp-table-container">
                    <table className="csp-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Domain</th>
                          <th>Type</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.newCookies.map((cookie, idx) => (
                          <tr key={idx} className="csp-row-new">
                            <td className="csp-cookie-name">
                              <Cookie size={14} />
                              {cookie.name}
                            </td>
                            <td>{cookie.category}</td>
                            <td className="csp-domain">{cookie.domain}</td>
                            <td>{cookie.type === 'third-party' ? '3rd-party' : '1st-party'}</td>
                            <td>
                              <span className={`csp-risk-badge ${getRiskColor(cookie.risk)}`}>
                                {cookie.risk || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Removed Cookies Table */}
              {comparisonData.removedCookies.length > 0 && (
                <div className="csp-section">
                  <h2 className="csp-section-title csp-removed-cookies">
                    <span>Removed Cookies</span>
                    <span className="csp-count">{comparisonData.removedCookies.length}</span>
                  </h2>
                  <div className="csp-table-container">
                    <table className="csp-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Domain</th>
                          <th>Type</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.removedCookies.map((cookie, idx) => (
                          <tr key={idx} className="csp-row-removed">
                            <td className="csp-cookie-name">
                              <Cookie size={14} />
                              {cookie.name}
                            </td>
                            <td>{cookie.category}</td>
                            <td className="csp-domain">{cookie.domain}</td>
                            <td>{cookie.type === 'third-party' ? '3rd-party' : '1st-party'}</td>
                            <td>
                              <span className={`csp-risk-badge ${getRiskColor(cookie.risk)}`}>
                                {cookie.risk || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Category Changes Table */}
              {comparisonData.changedCookies.length > 0 && (
                <div className="csp-section">
                  <h2 className="csp-section-title csp-changed-cookies">
                    <span>Category Changes</span>
                    <span className="csp-count">{comparisonData.changedCookies.length}</span>
                  </h2>
                  <div className="csp-table-container">
                    <table className="csp-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Old Category</th>
                          <th>New Category</th>
                          <th>Domain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.changedCookies.map((cookie, idx) => (
                          <tr key={idx} className="csp-row-changed">
                            <td className="csp-cookie-name">
                              <Cookie size={14} />
                              {cookie.name}
                            </td>
                            <td>{cookie.oldCategory}</td>
                            <td>{cookie.category}</td>
                            <td className="csp-domain">{cookie.domain}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Unchanged Cookies Collapsible */}
              {comparisonData.unchangedCookies.length > 0 && (
                <div className="csp-section">
                  <button
                    className="csp-collapsible-header"
                    onClick={() => setExpandedUnchanged(!expandedUnchanged)}
                  >
                    <div className="csp-collapsible-title">
                      <span>Unchanged Cookies</span>
                      <span className="csp-count">{comparisonData.unchangedCookies.length}</span>
                    </div>
                    {expandedUnchanged ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>

                  {expandedUnchanged && (
                    <div className="csp-table-container">
                      <table className="csp-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Domain</th>
                            <th>Type</th>
                            <th>Risk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonData.unchangedCookies.map((cookie, idx) => (
                            <tr key={idx} className="csp-row-unchanged">
                              <td className="csp-cookie-name">
                                <Check size={14} />
                                {cookie.name}
                              </td>
                              <td>{cookie.category}</td>
                              <td className="csp-domain">{cookie.domain}</td>
                              <td>{cookie.type === 'third-party' ? '3rd-party' : '1st-party'}</td>
                              <td>
                                <span className={`csp-risk-badge ${getRiskColor(cookie.risk)}`}>
                                  {cookie.risk || 'unknown'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Export Button */}
              <div className="csp-section csp-export-section">
                <button
                  className="csp-export-btn"
                  onClick={handleExportCSV}
                >
                  <Download size={18} />
                  Export Comparison to CSV
                </button>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .csp-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
          min-height: 100vh;
        }

        .csp-header {
          margin-bottom: 40px;
        }

        .csp-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background-color: transparent;
          color: #6366f1;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
          transition: color 0.2s;
        }

        .csp-back-btn:hover {
          color: #4f46e5;
        }

        .csp-title-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .csp-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background-color: #f0f4ff;
          border-radius: 12px;
          color: #6366f1;
        }

        .csp-title {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: #111827;
        }

        .csp-description {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .csp-section {
          background-color: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid #e5e7eb;
        }

        .csp-section-title {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .csp-section-title.csp-new-cookies {
          color: #059669;
        }

        .csp-section-title.csp-removed-cookies {
          color: #dc2626;
        }

        .csp-section-title.csp-changed-cookies {
          color: #f59e0b;
        }

        .csp-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          background-color: #f3f4f6;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
        }

        .csp-selection-container {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: flex-end;
          margin-bottom: 20px;
        }

        .csp-dropdown-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .csp-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .csp-dropdown {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background-color: white;
          color: #111827;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .csp-dropdown:hover {
          border-color: #9ca3af;
        }

        .csp-dropdown:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .csp-comparison-icon {
          display: flex;
          justify-content: center;
          color: #d1d5db;
        }

        .csp-compare-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background-color: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .csp-compare-btn:hover:not(:disabled) {
          background-color: #4f46e5;
        }

        .csp-compare-btn:disabled {
          background-color: #d1d5db;
          cursor: not-allowed;
        }

        .csp-summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .csp-summary-card {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          position: relative;
        }

        .csp-summary-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .csp-summary-values {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .csp-value-a,
        .csp-value-b {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }

        .csp-arrow {
          font-size: 14px;
          color: #d1d5db;
        }

        .csp-delta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .csp-delta.csp-positive {
          color: #059669;
          background-color: #ecfdf5;
        }

        .csp-delta.csp-negative {
          color: #dc2626;
          background-color: #fef2f2;
        }

        .csp-risk-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .csp-risk-high {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .csp-risk-medium {
          background-color: #fef3c7;
          color: #92400e;
        }

        .csp-risk-low {
          background-color: #dcfce7;
          color: #166534;
        }

        .csp-risk-unknown {
          background-color: #f3f4f6;
          color: #6b7280;
        }

        .csp-table-container {
          overflow-x: auto;
          margin-top: 12px;
        }

        .csp-table {
          width: 100%;
          border-collapse: collapse;
        }

        .csp-table thead {
          background-color: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }

        .csp-table th {
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .csp-table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
          color: #374151;
        }

        .csp-row-new {
          background-color: #f0fdf4;
        }

        .csp-row-removed {
          background-color: #fef2f2;
        }

        .csp-row-changed {
          background-color: #fffbeb;
        }

        .csp-row-unchanged {
          background-color: #f9fafb;
        }

        .csp-cookie-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: #111827;
        }

        .csp-domain {
          color: #6b7280;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
        }

        .csp-collapsible-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          transition: color 0.2s;
        }

        .csp-collapsible-header:hover {
          color: #6366f1;
        }

        .csp-collapsible-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .csp-export-section {
          text-align: center;
        }

        .csp-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background-color: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .csp-export-btn:hover {
          background-color: #4f46e5;
        }

        .csp-error-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #991b1b;
          font-size: 14px;
        }

        .csp-error-message svg {
          flex-shrink: 0;
          color: #dc2626;
        }

        @media (max-width: 768px) {
          .csp-page {
            padding: 16px;
          }

          .csp-title {
            font-size: 24px;
          }

          .csp-selection-container {
            grid-template-columns: 1fr;
          }

          .csp-comparison-icon {
            display: none;
          }

          .csp-summary-cards {
            grid-template-columns: 1fr;
          }

          .csp-table {
            font-size: 13px;
          }

          .csp-table th,
          .csp-table td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default CompareScanPage;
