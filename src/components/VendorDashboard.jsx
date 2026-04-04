import React, { useState, useMemo } from 'react';
import { Globe, Shield, AlertTriangle, Search, ChevronDown, ChevronUp, ExternalLink, Cookie, ArrowLeft } from 'lucide-react';
import './VendorDashboard.css';

// Known vendor database — maps domain patterns to vendor info
const VENDOR_DB = {
  'google': { name: 'Google LLC', hq: 'United States', category: 'Analytics & Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'google.com', privacy: 'policies.google.com/privacy' },
  'facebook': { name: 'Meta Platforms', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'facebook.com', privacy: 'facebook.com/privacy' },
  'meta': { name: 'Meta Platforms', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'meta.com', privacy: 'facebook.com/privacy' },
  'doubleclick': { name: 'Google Ads (DoubleClick)', hq: 'United States', category: 'Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'google.com', privacy: 'policies.google.com/privacy' },
  'adobe': { name: 'Adobe Inc.', hq: 'United States', category: 'Analytics', gdprCompliant: true, dpa: true, scc: true, website: 'adobe.com', privacy: 'adobe.com/privacy' },
  'hotjar': { name: 'Hotjar Ltd', hq: 'Malta (EU)', category: 'Analytics', gdprCompliant: true, dpa: true, scc: false, website: 'hotjar.com', privacy: 'hotjar.com/legal/policies/privacy/' },
  'hubspot': { name: 'HubSpot Inc.', hq: 'United States', category: 'Marketing', gdprCompliant: true, dpa: true, scc: true, website: 'hubspot.com', privacy: 'hubspot.com/privacy' },
  'linkedin': { name: 'LinkedIn Corp.', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'linkedin.com', privacy: 'linkedin.com/legal/privacy-policy' },
  'twitter': { name: 'X Corp.', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: false, website: 'x.com', privacy: 'twitter.com/privacy' },
  'microsoft': { name: 'Microsoft Corp.', hq: 'United States', category: 'Analytics & Cloud', gdprCompliant: true, dpa: true, scc: true, website: 'microsoft.com', privacy: 'privacy.microsoft.com' },
  'amazon': { name: 'Amazon.com Inc.', hq: 'United States', category: 'Cloud & Advertising', gdprCompliant: true, dpa: true, scc: true, website: 'amazon.com', privacy: 'amazon.com/privacy' },
  'cloudflare': { name: 'Cloudflare Inc.', hq: 'United States', category: 'CDN & Security', gdprCompliant: true, dpa: true, scc: true, website: 'cloudflare.com', privacy: 'cloudflare.com/privacypolicy/' },
  'stripe': { name: 'Stripe Inc.', hq: 'United States', category: 'Payments', gdprCompliant: true, dpa: true, scc: true, website: 'stripe.com', privacy: 'stripe.com/privacy' },
  'tiktok': { name: 'TikTok (ByteDance)', hq: 'China/Singapore', category: 'Social & Advertising', gdprCompliant: false, dpa: false, scc: false, website: 'tiktok.com', privacy: 'tiktok.com/legal/privacy-policy' },
  'pinterest': { name: 'Pinterest Inc.', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: false, website: 'pinterest.com', privacy: 'pinterest.com/privacy' },
  'snapchat': { name: 'Snap Inc.', hq: 'United States', category: 'Social & Advertising', gdprCompliant: true, dpa: true, scc: false, website: 'snapchat.com', privacy: 'snap.com/privacy' },
};

function identifyVendor(domain) {
  const d = (domain || '').toLowerCase();
  for (const [key, info] of Object.entries(VENDOR_DB)) {
    if (d.includes(key)) return { ...info, matched: key };
  }
  return null;
}

function getVendorRisk(vendor, cookies) {
  if (!vendor) return { score: 85, level: 'High', icon: '🔴', reason: 'Unknown vendor — compliance status uncertain' };
  const thirdPartyCount = cookies.filter(c => c.isThirdParty).length;
  const marketingCount = cookies.filter(c => c.category === 'Marketing').length;

  let score = 10;
  if (!vendor.gdprCompliant) score += 30;
  if (!vendor.dpa) score += 20;
  if (!vendor.scc) score += 15;
  if (thirdPartyCount > 5) score += 10;
  if (marketingCount > 3) score += 10;

  let level, icon;
  if (score >= 76) { level = 'Critical'; icon = '🔴'; }
  else if (score >= 51) { level = 'High'; icon = '🟠'; }
  else if (score >= 26) { level = 'Medium'; icon = '🟡'; }
  else { level = 'Low'; icon = '🟢'; }

  return { score, level, icon, reason: `${vendor.name} — ${vendor.hq}` };
}

function VendorDashboard({ scanHistory, domainHistory, onNavigate }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('cookies'); // cookies, risk, name
  const [filterRisk, setFilterRisk] = useState('all');
  const [expandedVendor, setExpandedVendor] = useState(null);

  // Aggregate all cookies across scan history
  const allCookies = useMemo(() => {
    const cookies = [];
    const seen = new Set();
    // From domainHistory
    Object.values(domainHistory || {}).forEach(scans => {
      (scans || []).forEach(scan => {
        (scan.fullResults?.cookies || scan.cookies || []).forEach(c => {
          const key = `${c.name}|${c.domain}`;
          if (!seen.has(key)) {
            seen.add(key);
            cookies.push(c);
          }
        });
      });
    });
    // From scanHistory
    (scanHistory || []).forEach(scan => {
      (scan.fullResults?.cookies || scan.cookies || []).forEach(c => {
        const key = `${c.name}|${c.domain}`;
        if (!seen.has(key)) {
          seen.add(key);
          cookies.push(c);
        }
      });
    });
    return cookies;
  }, [scanHistory, domainHistory]);

  // Group cookies by vendor domain
  const vendors = useMemo(() => {
    const map = {};
    allCookies.forEach(cookie => {
      const domain = cookie.domain || 'unknown';
      if (!map[domain]) map[domain] = { domain, cookies: [], vendor: identifyVendor(domain) };
      map[domain].cookies.push(cookie);
    });

    return Object.values(map).map(v => ({
      ...v,
      risk: getVendorRisk(v.vendor, v.cookies),
      mainCategory: getMajorityCategory(v.cookies),
      isThirdParty: v.cookies.some(c => c.isThirdParty),
    }));
  }, [allCookies]);

  // Filtering + Sorting
  const filteredVendors = useMemo(() => {
    let list = vendors.filter(v => {
      const nameMatch = !search ||
        v.domain.toLowerCase().includes(search.toLowerCase()) ||
        (v.vendor?.name || '').toLowerCase().includes(search.toLowerCase());
      const riskMatch = filterRisk === 'all' || v.risk.level.toLowerCase() === filterRisk;
      return nameMatch && riskMatch;
    });

    list.sort((a, b) => {
      if (sortBy === 'cookies') return b.cookies.length - a.cookies.length;
      if (sortBy === 'risk') return b.risk.score - a.risk.score;
      return (a.vendor?.name || a.domain).localeCompare(b.vendor?.name || b.domain);
    });

    return list;
  }, [vendors, search, filterRisk, sortBy]);

  const identifiedCount = vendors.filter(v => v.vendor).length;
  const unknownCount = vendors.filter(v => !v.vendor).length;
  const criticalCount = vendors.filter(v => v.risk.level === 'Critical' || v.risk.level === 'High').length;

  return (
    <div className="vd-page">
      <div className="vd-header">
        <div className="vd-header__left">
          <button className="vd-back-btn" onClick={() => onNavigate('home')}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="vd-title">Vendor Dashboard</h1>
            <p className="vd-subtitle">Track third-party vendors, compliance status, and data processing agreements</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="vd-stats">
        <div className="vd-stat-card">
          <span className="vd-stat-card__value">{vendors.length}</span>
          <span className="vd-stat-card__label">Total Vendors</span>
        </div>
        <div className="vd-stat-card vd-stat-card--ok">
          <span className="vd-stat-card__value">{identifiedCount}</span>
          <span className="vd-stat-card__label">Identified ({vendors.length > 0 ? Math.round(identifiedCount / vendors.length * 100) : 0}%)</span>
        </div>
        <div className="vd-stat-card vd-stat-card--warn">
          <span className="vd-stat-card__value">{unknownCount}</span>
          <span className="vd-stat-card__label">Unknown</span>
        </div>
        <div className="vd-stat-card vd-stat-card--critical">
          <span className="vd-stat-card__value">{criticalCount}</span>
          <span className="vd-stat-card__label">High/Critical Risk</span>
        </div>
        <div className="vd-stat-card">
          <span className="vd-stat-card__value">{allCookies.length}</span>
          <span className="vd-stat-card__label">Total Cookies</span>
        </div>
      </div>

      {/* Filters */}
      <div className="vd-toolbar">
        <div className="vd-search-wrap">
          <Search size={14} className="vd-search-icon" />
          <input
            type="text"
            className="vd-search"
            placeholder="Search vendors or domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="vd-select" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
          <option value="all">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="vd-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="cookies">Sort: Cookie Count</option>
          <option value="risk">Sort: Risk Score</option>
          <option value="name">Sort: Name</option>
        </select>
        <span className="vd-count">{filteredVendors.length} vendors</span>
      </div>

      {/* Vendor Cards */}
      <div className="vd-list">
        {filteredVendors.length === 0 && (
          <div className="vd-empty">
            <Globe size={40} />
            <p>No vendors found. Run a scan to discover cookie vendors.</p>
          </div>
        )}

        {filteredVendors.map((v, i) => {
          const isExpanded = expandedVendor === v.domain;
          const categories = {};
          v.cookies.forEach(c => { categories[c.category] = (categories[c.category] || 0) + 1; });

          return (
            <div key={v.domain} className={`vd-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="vd-card__header" onClick={() => setExpandedVendor(isExpanded ? null : v.domain)}>
                <div className="vd-card__left">
                  <div className="vd-card__icon-wrap">
                    <Globe size={18} />
                  </div>
                  <div>
                    <h3 className="vd-card__name">
                      {v.vendor ? v.vendor.name : v.domain}
                      {!v.vendor && <span className="vd-unknown-tag">Unknown</span>}
                    </h3>
                    <span className="vd-card__domain">{v.domain}</span>
                  </div>
                </div>
                <div className="vd-card__right">
                  <span className="vd-card__cookies">
                    <Cookie size={12} /> {v.cookies.length} cookies
                  </span>
                  <span className={`vd-risk-pill vd-risk-pill--${v.risk.level.toLowerCase()}`}>
                    {v.risk.icon} {v.risk.level}
                  </span>
                  <span className={`vd-party-badge ${v.isThirdParty ? 'third' : 'first'}`}>
                    {v.isThirdParty ? '3rd Party' : '1st Party'}
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isExpanded && (
                <div className="vd-card__body">
                  {/* Vendor Info */}
                  {v.vendor && (
                    <div className="vd-info-grid">
                      <div className="vd-info-row">
                        <span className="vd-info-key">Headquarters</span>
                        <span className="vd-info-val">{v.vendor.hq}</span>
                      </div>
                      <div className="vd-info-row">
                        <span className="vd-info-key">Vendor Category</span>
                        <span className="vd-info-val">{v.vendor.category}</span>
                      </div>
                      <div className="vd-info-row">
                        <span className="vd-info-key">Website</span>
                        <span className="vd-info-val vd-info-val--link">{v.vendor.website}</span>
                      </div>
                      <div className="vd-info-row">
                        <span className="vd-info-key">Privacy Policy</span>
                        <span className="vd-info-val vd-info-val--link">{v.vendor.privacy}</span>
                      </div>
                    </div>
                  )}

                  {/* Compliance Status */}
                  <div className="vd-compliance-section">
                    <h4 className="vd-section-title">Compliance Status</h4>
                    <div className="vd-compliance-checks">
                      {v.vendor ? (
                        <>
                          <div className={`vd-check ${v.vendor.gdprCompliant ? 'ok' : 'fail'}`}>
                            {v.vendor.gdprCompliant ? '✓' : '✗'} GDPR Compliant
                          </div>
                          <div className={`vd-check ${v.vendor.dpa ? 'ok' : 'fail'}`}>
                            {v.vendor.dpa ? '✓' : '✗'} Data Processing Agreement
                          </div>
                          <div className={`vd-check ${v.vendor.scc ? 'ok' : 'fail'}`}>
                            {v.vendor.scc ? '✓' : '✗'} Standard Contractual Clauses
                          </div>
                        </>
                      ) : (
                        <div className="vd-check fail">
                          <AlertTriangle size={12} /> Vendor not identified — compliance status unknown
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cookie Breakdown */}
                  <div className="vd-cookies-section">
                    <h4 className="vd-section-title">Cookies by Category</h4>
                    <div className="vd-cat-bars">
                      {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                        <div key={cat} className="vd-cat-row">
                          <span className={`vd-cat-badge cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}>{cat}</span>
                          <div className="vd-cat-bar-track">
                            <div
                              className="vd-cat-bar-fill"
                              style={{ width: `${(count / v.cookies.length) * 100}%` }}
                            />
                          </div>
                          <span className="vd-cat-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cookie List */}
                  <div className="vd-cookie-list">
                    <h4 className="vd-section-title">Cookies ({v.cookies.length})</h4>
                    <div className="vd-cookie-table">
                      {v.cookies.map((c, ci) => (
                        <div key={ci} className="vd-cookie-row">
                          <span className="vd-cookie-name">{c.name}</span>
                          <span className={`vd-cookie-cat cat-${(c.category || '').toLowerCase().replace(/\s+/g, '-')}`}>
                            {c.category}
                          </span>
                          <span className="vd-cookie-conf">
                            {c.mlConfidence ? `${Math.round(c.mlConfidence * 100)}%` : '--'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getMajorityCategory(cookies) {
  const counts = {};
  cookies.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
}

export default VendorDashboard;
