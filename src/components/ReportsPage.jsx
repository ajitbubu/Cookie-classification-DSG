import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  FileText,
  Shield,
  BookOpen,
  Globe,
  Download,
  Copy,
  Check,
  ChevronDown,
  AlertTriangle,
  Clock,
  BarChart3,
  Layers,
  Filter,
} from 'lucide-react';
import './ReportsPage.css';

const ReportsPage = ({ scanHistory, domainHistory, scanResult, onNavigate }) => {
  const [activeReport, setActiveReport] = useState('declaration');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [copied, setCopied] = useState(false);

  // Get unique domains for selector
  const domains = useMemo(() => {
    if (!domainHistory) return [];
    return Object.keys(domainHistory).sort();
  }, [domainHistory]);

  // Compute cookie data for selected domain(s)
  const cookieData = useMemo(() => {
    let cookies = [];
    let scans = [];

    if (selectedDomain === 'all') {
      Object.keys(domainHistory || {}).forEach((domain) => {
        const domainScans = domainHistory[domain];
        if (domainScans && domainScans.length > 0) {
          const latestScan = domainScans[domainScans.length - 1];
          if (latestScan.fullResults?.cookies) {
            cookies = [...cookies, ...latestScan.fullResults.cookies];
            scans.push(latestScan);
          }
        }
      });
    } else {
      const domainScans = domainHistory?.[selectedDomain];
      if (domainScans && domainScans.length > 0) {
        const latestScan = domainScans[domainScans.length - 1];
        if (latestScan.fullResults?.cookies) {
          cookies = latestScan.fullResults.cookies;
          scans = [latestScan];
        }
      }
    }

    return { cookies, scans };
  }, [selectedDomain, domainHistory]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const { cookies, scans } = cookieData;
    const byCategory = {};
    const byType = { first: 0, third: 0 };
    let consentRequired = 0;

    cookies.forEach((cookie) => {
      const cat = cookie.category || 'Unknown';
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      if (cookie.type === 'first-party') {
        byType.first++;
      } else {
        byType.third++;
      }

      if (cookie.consentRequired) {
        consentRequired++;
      }
    });

    return {
      total: cookies.length,
      byCategory,
      byType,
      consentRequired,
      scans,
      cookies,
    };
  }, [cookieData]);

  // Compute compliance risk summary
  const complianceData = useMemo(() => {
    const { scans, cookies } = summaryStats;

    const regulations = {
      GDPR: {
        label: 'GDPR',
        riskLevel: 'medium',
        affectedCookies: 0,
        criticalIssues: [],
        actionItems: [],
      },
      CCPA: {
        label: 'CCPA',
        riskLevel: 'medium',
        affectedCookies: 0,
        criticalIssues: [],
        actionItems: [],
      },
      DPDP: {
        label: 'DPDP',
        riskLevel: 'low',
        affectedCookies: 0,
        criticalIssues: [],
        actionItems: [],
      },
    };

    scans.forEach((scan) => {
      if (scan.gdprRisk && scan.gdprRisk !== 'none') {
        regulations.GDPR.riskLevel = 'high';
      }
      if (scan.ccpaRisk && scan.ccpaRisk !== 'none') {
        regulations.CCPA.riskLevel = 'high';
      }
      if (scan.dpdpRisk && scan.dpdpRisk !== 'none') {
        regulations.DPDP.riskLevel = 'medium';
      }
    });

    // Count cookies needing consent
    const consentCookies = cookies.filter((c) => c.consentRequired);
    const thirdPartyCookies = cookies.filter((c) => c.type !== 'first-party');
    const trackerCookies = cookies.filter(
      (c) => c.category === 'Analytics' || c.category === 'Marketing'
    );

    regulations.GDPR.affectedCookies = consentCookies.length;
    regulations.CCPA.affectedCookies = thirdPartyCookies.length;
    regulations.DPDP.affectedCookies = consentCookies.length;

    if (consentCookies.length > 0) {
      regulations.GDPR.criticalIssues.push(
        `${consentCookies.length} cookies require explicit consent`
      );
      regulations.GDPR.actionItems.push('Implement granular consent for all non-essential cookies');
    }

    if (thirdPartyCookies.length > 0) {
      regulations.CCPA.criticalIssues.push(
        `${thirdPartyCookies.length} third-party cookies detected`
      );
      regulations.CCPA.actionItems.push('Add third-party cookie disclosure to privacy policy');
    }

    if (trackerCookies.length > 0) {
      regulations.GDPR.criticalIssues.push(`${trackerCookies.length} tracking cookies found`);
      regulations.GDPR.actionItems.push('Obtain explicit user consent for tracking');
    }

    return regulations;
  }, [summaryStats]);

  // Extract vendor info
  const vendorData = useMemo(() => {
    const { cookies } = summaryStats;
    const vendors = {};

    cookies.forEach((cookie) => {
      const domain = cookie.domain || 'Unknown';
      if (!vendors[domain]) {
        vendors[domain] = {
          domain,
          count: 0,
          categories: new Set(),
          hasRisk: false,
        };
      }
      vendors[domain].count++;
      if (cookie.category) {
        vendors[domain].categories.add(cookie.category);
      }
      if (cookie.consentRequired) {
        vendors[domain].hasRisk = true;
      }
    });

    return Object.values(vendors).sort((a, b) => b.count - a.count);
  }, [summaryStats]);

  // Generate privacy policy text
  const privacyPolicyText = useMemo(() => {
    const { byCategory, total, byType } = summaryStats;
    let text = '# Privacy Policy - Cookies Section\n\n';

    text += '## What Cookies We Use\n\n';
    text += `Our website uses ${total} cookies and similar tracking technologies to enhance your browsing experience, measure website performance, and deliver personalized content.\n\n`;

    text += '## Cookie Categories\n\n';
    Object.entries(byCategory).forEach(([category, count]) => {
      text += `**${category}** (${count} cookie${count !== 1 ? 's' : ''})\n`;
      text += `We use ${category.toLowerCase()} cookies to improve our service.\n\n`;
    });

    text += '## First-Party vs Third-Party\n\n';
    text += `Our website sets ${byType.first} first-party cookie${byType.first !== 1 ? 's' : ''} directly. `;
    text += `Additionally, ${byType.third} third-party cookie${byType.third !== 1 ? 's' : ''} are set by partners.\n\n`;

    text += '## Third-Party Services\n\n';
    text += vendorData
      .slice(0, 5)
      .map((v) => `- **${v.domain}**: ${v.count} cookie${v.count !== 1 ? 's' : ''}`)
      .join('\n');
    if (vendorData.length > 5) {
      text += `\n- And ${vendorData.length - 5} other vendor${vendorData.length - 5 !== 1 ? 's' : ''}`;
    }
    text += '\n\n';

    text += '## Managing Your Cookies\n\n';
    text +=
      'You can control cookies through your browser settings. Most browsers allow you to refuse cookies or alert you when a website is setting cookies. Learn more about managing cookies at www.allaboutcookies.org.\n\n';

    text +=
      'For questions about our cookie practices, please contact our privacy team at privacy@example.com.';

    return text;
  }, [summaryStats, vendorData]);

  // CSV export function
  const handleExportCSV = () => {
    const { cookies } = summaryStats;
    let csv =
      'Name,Category,Domain,Type,Consent Required,Duration,Purpose\n';

    cookies.forEach((cookie) => {
      const name = `"${cookie.name || ''}"`;
      const category = cookie.category || 'Unknown';
      const domain = cookie.domain || 'Unknown';
      const type = cookie.type === 'first-party' ? 'First-Party' : 'Third-Party';
      const consent = cookie.consentRequired ? 'Yes' : 'No';
      const duration = cookie.duration || 'Not Specified';
      const purpose = `"${cookie.purpose || ''}"`;

      csv += `${name},${category},${domain},${type},${consent},${duration},${purpose}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cookie-report-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy to clipboard function
  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Risk level badge styling
  const getRiskColor = (level) => {
    switch (level) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f97316';
      case 'low':
        return '#22c55e';
      default:
        return '#8b8fa3';
    }
  };

  return (
    <div className="rp-container">
      {/* Header */}
      <div className="rp-header">
        <button className="rp-back-btn" onClick={() => onNavigate('home')}>
          <ArrowLeft size={20} />
          Back to Scanner
        </button>
        <h1 className="rp-title">Compliance Reports</h1>
        <p className="rp-subtitle">Analyze and export cookie compliance data</p>
      </div>

      {/* Report Type Selection */}
      <div className="rp-report-selector">
        <div className="rp-report-card" onClick={() => setActiveReport('declaration')}>
          <div className={`rp-report-icon ${activeReport === 'declaration' ? 'active' : ''}`}>
            <FileText size={24} />
          </div>
          <h3>Cookie Declaration</h3>
          <p>Full inventory & export</p>
        </div>

        <div className="rp-report-card" onClick={() => setActiveReport('compliance')}>
          <div className={`rp-report-icon ${activeReport === 'compliance' ? 'active' : ''}`}>
            <Shield size={24} />
          </div>
          <h3>Compliance Report</h3>
          <p>Regulatory risk summary</p>
        </div>

        <div className="rp-report-card" onClick={() => setActiveReport('privacy')}>
          <div className={`rp-report-icon ${activeReport === 'privacy' ? 'active' : ''}`}>
            <BookOpen size={24} />
          </div>
          <h3>Privacy Policy</h3>
          <p>Auto-generated text</p>
        </div>

        <div className="rp-report-card" onClick={() => setActiveReport('vendors')}>
          <div className={`rp-report-icon ${activeReport === 'vendors' ? 'active' : ''}`}>
            <Globe size={24} />
          </div>
          <h3>Vendor Report</h3>
          <p>Third-party analysis</p>
        </div>
      </div>

      {/* Report Content */}
      <div className="rp-report-content">
        {/* Cookie Declaration Report */}
        {activeReport === 'declaration' && (
          <div className="rp-report">
            <div className="rp-report-header">
              <h2>Cookie Declaration Report</h2>
              <div className="rp-controls">
                <div className="rp-domain-selector">
                  <Filter size={18} />
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="rp-select"
                  >
                    <option value="all">All Domains</option>
                    {domains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="rp-select-icon" />
                </div>
                <button className="rp-btn-primary" onClick={handleExportCSV}>
                  <Download size={18} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="rp-stats-grid">
              <div className="rp-stat-card">
                <div className="rp-stat-icon" style={{ background: '#1A6DFF' }}>
                  <Layers size={20} />
                </div>
                <div className="rp-stat-content">
                  <div className="rp-stat-value">{summaryStats.total}</div>
                  <div className="rp-stat-label">Total Cookies</div>
                </div>
              </div>

              <div className="rp-stat-card">
                <div className="rp-stat-icon" style={{ background: '#1A6DFF' }}>
                  <AlertTriangle size={20} />
                </div>
                <div className="rp-stat-content">
                  <div className="rp-stat-value">{summaryStats.consentRequired}</div>
                  <div className="rp-stat-label">Require Consent</div>
                </div>
              </div>

              <div className="rp-stat-card">
                <div className="rp-stat-icon" style={{ background: '#1A6DFF' }}>
                  <Globe size={20} />
                </div>
                <div className="rp-stat-content">
                  <div className="rp-stat-value">{summaryStats.byType.third}</div>
                  <div className="rp-stat-label">Third-Party</div>
                </div>
              </div>

              <div className="rp-stat-card">
                <div className="rp-stat-icon" style={{ background: '#1A6DFF' }}>
                  <Clock size={20} />
                </div>
                <div className="rp-stat-content">
                  <div className="rp-stat-value">{summaryStats.byType.first}</div>
                  <div className="rp-stat-label">First-Party</div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="rp-category-breakdown">
              <h3>Cookies by Category</h3>
              <div className="rp-category-list">
                {Object.entries(summaryStats.byCategory).map(([category, count]) => (
                  <div key={category} className="rp-category-item">
                    <span className="rp-category-name">{category}</span>
                    <div className="rp-category-bar">
                      <div
                        className="rp-category-fill"
                        style={{
                          width: `${(count / summaryStats.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="rp-category-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cookies Table */}
            <div className="rp-table-container">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Category</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Consent</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryStats.cookies.map((cookie, idx) => (
                    <tr key={idx}>
                      <td className="rp-cookie-name">{cookie.name || 'Unknown'}</td>
                      <td>
                        <span className="rp-category-badge">
                          {cookie.category || 'Unknown'}
                        </span>
                      </td>
                      <td className="rp-domain">{cookie.domain || 'Unknown'}</td>
                      <td>
                        <span
                          className={`rp-type-badge ${
                            cookie.type === 'first-party' ? 'first' : 'third'
                          }`}
                        >
                          {cookie.type === 'first-party' ? '1st Party' : '3rd Party'}
                        </span>
                      </td>
                      <td>
                        {cookie.consentRequired ? (
                          <span className="rp-consent-yes">Required</span>
                        ) : (
                          <span className="rp-consent-no">Not Required</span>
                        )}
                      </td>
                      <td>{cookie.duration || 'Session'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Compliance Report */}
        {activeReport === 'compliance' && (
          <div className="rp-report">
            <h2>Compliance Risk Assessment</h2>
            <p className="rp-report-subtitle">
              Multi-regulation analysis of your cookie compliance status
            </p>

            <div className="rp-compliance-grid">
              {Object.entries(complianceData).map(([regKey, reg]) => (
                <div key={regKey} className="rp-compliance-card">
                  <div className="rp-compliance-header">
                    <h3>{reg.label}</h3>
                    <span
                      className="rp-risk-badge"
                      style={{ background: getRiskColor(reg.riskLevel) }}
                    >
                      {reg.riskLevel.toUpperCase()}
                    </span>
                  </div>

                  <div className="rp-compliance-meta">
                    <div className="rp-meta-item">
                      <span className="rp-meta-label">Affected Cookies:</span>
                      <span className="rp-meta-value">{reg.affectedCookies}</span>
                    </div>
                  </div>

                  {reg.criticalIssues.length > 0 && (
                    <div className="rp-compliance-issues">
                      <h4>Critical Issues</h4>
                      <ul>
                        {reg.criticalIssues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reg.actionItems.length > 0 && (
                    <div className="rp-action-items">
                      <h4>Recommended Actions</h4>
                      <ul>
                        {reg.actionItems.map((action, idx) => (
                          <li key={idx}>
                            <Check size={16} />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Priority Actions Summary */}
            <div className="rp-priority-actions">
              <h3>
                <AlertTriangle size={20} />
                Priority Action Items
              </h3>
              <div className="rp-action-list">
                {Object.values(complianceData)
                  .filter((reg) => reg.riskLevel === 'high')
                  .flatMap((reg) => reg.actionItems.map((action) => ({ reg: reg.label, action })))
                  .map((item, idx) => (
                    <div key={idx} className="rp-priority-item">
                      <div className="rp-priority-indicator" />
                      <div className="rp-priority-content">
                        <strong>{item.reg}:</strong> {item.action}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <button className="rp-btn-primary" onClick={handleExportCSV}>
              <Download size={18} />
              Download Full Report
            </button>
          </div>
        )}

        {/* Privacy Policy Report */}
        {activeReport === 'privacy' && (
          <div className="rp-report">
            <div className="rp-report-header">
              <h2>Privacy Policy - Cookies Section</h2>
              <button
                className="rp-btn-secondary"
                onClick={() => handleCopyToClipboard(privacyPolicyText)}
              >
                <Copy size={18} />
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>

            <div className="rp-policy-preview">
              <div className="rp-policy-content">
                {privacyPolicyText.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return (
                      <h1 key={idx} className="rp-policy-h1">
                        {line.replace('# ', '')}
                      </h1>
                    );
                  }
                  if (line.startsWith('## ')) {
                    return (
                      <h2 key={idx} className="rp-policy-h2">
                        {line.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <p key={idx} className="rp-policy-bold">
                        {line.replace(/\*\*/g, '')}
                      </p>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <li key={idx} className="rp-policy-item">
                        {line.replace('- ', '')}
                      </li>
                    );
                  }
                  if (line.trim()) {
                    return (
                      <p key={idx} className="rp-policy-p">
                        {line}
                      </p>
                    );
                  }
                  return <div key={idx} style={{ height: '0.5rem' }} />;
                })}
              </div>
            </div>

            <div className="rp-policy-note">
              <p>
                This is an auto-generated privacy policy section based on your detected cookies.
                Review and customize for your specific use case before publication.
              </p>
            </div>
          </div>
        )}

        {/* Vendor Report */}
        {activeReport === 'vendors' && (
          <div className="rp-report">
            <div className="rp-report-header">
              <h2>Third-Party Vendor Report</h2>
              <div className="rp-vendor-summary">
                <div className="rp-vendor-stat">
                  <BarChart3 size={20} />
                  <span>{vendorData.length} vendors identified</span>
                </div>
              </div>
            </div>

            <div className="rp-vendor-grid">
              {vendorData.map((vendor, idx) => (
                <div key={idx} className="rp-vendor-card">
                  <div className="rp-vendor-header">
                    <h3>{vendor.domain}</h3>
                    {vendor.hasRisk && (
                      <span className="rp-risk-indicator">
                        <AlertTriangle size={14} />
                      </span>
                    )}
                  </div>

                  <div className="rp-vendor-stats">
                    <div className="rp-vendor-stat-item">
                      <span className="rp-stat-label">Cookies:</span>
                      <span className="rp-stat-val">{vendor.count}</span>
                    </div>
                  </div>

                  <div className="rp-vendor-categories">
                    <p className="rp-categories-label">Categories:</p>
                    <div className="rp-categories-tags">
                      {Array.from(vendor.categories).map((cat) => (
                        <span key={cat} className="rp-cat-tag">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {vendor.hasRisk && (
                    <div className="rp-vendor-risk">
                      <AlertTriangle size={14} />
                      <span>Requires consent</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {vendorData.length === 0 && (
              <div className="rp-empty-state">
                <Globe size={40} />
                <p>No vendors detected in current selection</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
