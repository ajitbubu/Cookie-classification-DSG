import React, { useState, useMemo } from 'react';
import { ArrowLeft, Globe, Shield, AlertTriangle, Cookie, Search, ExternalLink } from 'lucide-react';
import './MyWebsitesPage.css';

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch { return url; }
}

function getRiskLevel(cookies) {
  if (!cookies || cookies.length === 0) return 'low';
  const thirdParty = cookies.filter(c => c.isThirdParty).length;
  const marketing = cookies.filter(c => (c.category || '').toLowerCase() === 'marketing').length;
  const lowConf = cookies.filter(c => (c.mlConfidence || 0) < 0.65).length;

  let score = 0;
  score += Math.min(thirdParty * 2, 30);
  score += Math.min(marketing * 5, 30);
  score += Math.min(lowConf * 3, 20);
  score += Math.min(cookies.length * 0.5, 20);

  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function getRiskLabel(level) {
  return { low: 'Low Risk', medium: 'Medium', high: 'High Risk', critical: 'Critical' }[level] || level;
}

function getCategoryBreakdown(cookies) {
  const cats = { necessary: 0, functional: 0, analytics: 0, marketing: 0 };
  cookies.forEach(c => {
    const cat = (c.category || '').toLowerCase();
    if (cat.includes('necessary')) cats.necessary++;
    else if (cat.includes('functional')) cats.functional++;
    else if (cat.includes('analytics')) cats.analytics++;
    else if (cat.includes('marketing')) cats.marketing++;
  });
  return cats;
}

function MyWebsitesPage({ domainHistory, scanHistory, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Build website portfolio from domainHistory and scanHistory
  const websites = useMemo(() => {
    const siteMap = {};

    // Process domainHistory (domain -> scans)
    if (domainHistory && typeof domainHistory === 'object') {
      Object.entries(domainHistory).forEach(([domain, scans]) => {
        if (!siteMap[domain]) {
          siteMap[domain] = { domain, scans: [], allCookies: [] };
        }
        const scanArr = Array.isArray(scans) ? scans : [];
        siteMap[domain].scans.push(...scanArr);
        scanArr.forEach(scan => {
          if (scan.cookies) siteMap[domain].allCookies.push(...scan.cookies);
        });
      });
    }

    // Process scanHistory
    if (Array.isArray(scanHistory)) {
      scanHistory.forEach(scan => {
        const domain = extractDomain(scan.url || scan.domain || '');
        if (!domain) return;
        if (!siteMap[domain]) {
          siteMap[domain] = { domain, scans: [], allCookies: [] };
        }
        siteMap[domain].scans.push(scan);
        if (scan.cookies) siteMap[domain].allCookies.push(...scan.cookies);
      });
    }

    // Deduplicate cookies per site (by name+domain)
    return Object.values(siteMap).map(site => {
      const seen = new Set();
      const uniqueCookies = [];
      site.allCookies.forEach(c => {
        const key = `${c.name}::${c.domain}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueCookies.push(c);
        }
      });

      const lastScan = site.scans.length > 0
        ? site.scans.reduce((latest, s) => {
            const d = new Date(s.timestamp || s.scannedAt || 0);
            return d > latest ? d : latest;
          }, new Date(0))
        : null;

      return {
        domain: site.domain,
        cookies: uniqueCookies,
        scanCount: site.scans.length,
        lastScan,
        risk: getRiskLevel(uniqueCookies),
        categories: getCategoryBreakdown(uniqueCookies),
        thirdPartyCount: uniqueCookies.filter(c => c.isThirdParty).length,
      };
    });
  }, [domainHistory, scanHistory]);

  // Filter & sort
  const filteredSites = useMemo(() => {
    let result = websites;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.domain.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => (b.lastScan || 0) - (a.lastScan || 0));
        break;
      case 'risk':
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        result.sort((a, b) => (riskOrder[a.risk] || 3) - (riskOrder[b.risk] || 3));
        break;
      case 'cookies':
        result.sort((a, b) => b.cookies.length - a.cookies.length);
        break;
      case 'alpha':
        result.sort((a, b) => a.domain.localeCompare(b.domain));
        break;
      default: break;
    }

    return result;
  }, [websites, searchQuery, sortBy]);

  // Aggregate stats
  const totalCookies = websites.reduce((s, w) => s + w.cookies.length, 0);
  const highRiskSites = websites.filter(w => w.risk === 'high' || w.risk === 'critical').length;
  const totalThirdParty = websites.reduce((s, w) => s + w.thirdPartyCount, 0);
  const avgCookiesPerSite = websites.length > 0 ? Math.round(totalCookies / websites.length) : 0;

  return (
    <div className="mw-page">
      <div className="mw-header">
        <div className="mw-header__left">
          <button className="mw-back-btn" onClick={() => onNavigate('home')}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="mw-title">My Websites</h1>
            <p className="mw-subtitle">Portfolio view of all scanned websites and their cookie compliance status</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mw-stats">
        <div className="mw-stat">
          <div className="mw-stat__value">{websites.length}</div>
          <div className="mw-stat__label">Websites</div>
        </div>
        <div className="mw-stat">
          <div className="mw-stat__value">{totalCookies}</div>
          <div className="mw-stat__label">Total Cookies</div>
        </div>
        <div className="mw-stat">
          <div className="mw-stat__value mw-stat__value--danger">{highRiskSites}</div>
          <div className="mw-stat__label">High Risk Sites</div>
        </div>
        <div className="mw-stat">
          <div className="mw-stat__value mw-stat__value--warn">{totalThirdParty}</div>
          <div className="mw-stat__label">Third-Party Cookies</div>
        </div>
        <div className="mw-stat">
          <div className="mw-stat__value">{avgCookiesPerSite}</div>
          <div className="mw-stat__label">Avg per Site</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mw-toolbar">
        <input
          className="mw-search"
          type="text"
          placeholder="Search websites..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select className="mw-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="recent">Most Recent</option>
          <option value="risk">Highest Risk</option>
          <option value="cookies">Most Cookies</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {/* Website Grid */}
      {filteredSites.length === 0 ? (
        <div className="mw-empty">
          <Globe size={40} />
          <p>{websites.length === 0 ? 'No websites scanned yet' : 'No websites match your search'}</p>
          <span>{websites.length === 0 ? 'Scan a website to see it appear here' : 'Try a different search term'}</span>
        </div>
      ) : (
        <div className="mw-grid">
          {filteredSites.map(site => {
            const total = site.cookies.length;
            const cats = site.categories;
            return (
              <div key={site.domain} className="mw-card" onClick={() => onNavigate('home')}>
                <div className="mw-card__header">
                  <div className="mw-card__favicon">
                    <Globe size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mw-card__domain">{site.domain}</div>
                    <span className="mw-card__url">{site.scanCount} scan{site.scanCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`mw-card__risk mw-card__risk--${site.risk}`}>
                    {getRiskLabel(site.risk)}
                  </span>
                </div>

                <div className="mw-card__cookies">
                  <div className="mw-card__cookie-stat">
                    <span>{total}</span>
                    <span>Total Cookies</span>
                  </div>
                  <div className="mw-card__cookie-stat">
                    <span>{site.thirdPartyCount}</span>
                    <span>Third-Party</span>
                  </div>
                  <div className="mw-card__cookie-stat">
                    <span>{cats.marketing}</span>
                    <span>Marketing</span>
                  </div>
                  <div className="mw-card__cookie-stat">
                    <span>{cats.analytics}</span>
                    <span>Analytics</span>
                  </div>
                </div>

                {/* Category distribution bar */}
                {total > 0 && (
                  <div className="mw-cat-bar">
                    {cats.necessary > 0 && <div className="mw-cat-bar__seg mw-cat-bar__seg--necessary" style={{ flex: cats.necessary }} />}
                    {cats.functional > 0 && <div className="mw-cat-bar__seg mw-cat-bar__seg--functional" style={{ flex: cats.functional }} />}
                    {cats.analytics > 0 && <div className="mw-cat-bar__seg mw-cat-bar__seg--analytics" style={{ flex: cats.analytics }} />}
                    {cats.marketing > 0 && <div className="mw-cat-bar__seg mw-cat-bar__seg--marketing" style={{ flex: cats.marketing }} />}
                  </div>
                )}

                <div className="mw-card__footer">
                  <span className="mw-card__last-scan">
                    {site.lastScan ? `Last: ${site.lastScan.toLocaleDateString()}` : 'Never scanned'}
                  </span>
                  <span className="mw-card__scan-count">{site.scanCount} scan{site.scanCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyWebsitesPage;
