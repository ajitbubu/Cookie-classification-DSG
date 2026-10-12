import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Shield, CheckCircle, Search, ThumbsUp, Check } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import EmptyState from './ui/EmptyState';
import './ui/DataTable.css';
import { CategoryTag, Chip } from './ui/Chip';
import { ruleBasedClassify } from '../lib/classificationPolicy';
import { manualCheckPrompt, needsManualCheck, recordApproval } from '../lib/reviewQueue';
import { publishCategory, publishCategories, publishSummary } from '../lib/categoryApi';
import { useToast } from './Toast';
import './ReviewQueuePage.css';

const ReviewQueuePage = ({ scanHistory }) => {
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
  const [confirming, setConfirming] = useState(null); // { cookieKey, cookie, category } awaiting 12A confirmation
  // Per-row publish outcome (E4): { status: 'saving' | 'unpublished' | 'error', category }
  const [rowState, setRowState] = useState({});
  const toast = useToast();
  const setRow = (key, value) => setRowState((prev) => {
    const next = { ...prev };
    if (value) next[key] = value; else delete next[key];
    return next;
  });

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

  const logApproval = (cookieKey, cookie, category) => recordApproval({
    key: cookieKey,
    name: cookie?.name,
    domain: cookie?.domain || cookie?.scanDomain,
    originalCategory: cookie?.mlClassification || cookie?.category,
    approvedCategory: category,
    confidence: getConfidence(cookie || {}),
  });

  // An approval only counts once it is published (eng R1/R4): the API can save
  // to its file fallback and still answer success with knowledge_base_updated: false.
  const approveNow = async (cookieKey, cookie, category) => {
    setRow(cookieKey, { status: 'saving', category });
    try {
      const { published } = await publishCategory({
        scanId: cookie.scanId, name: cookie.name, domain: cookie.domain, oldCategory: cookie.category, newCategory: category,
      });
      if (published) {
        logApproval(cookieKey, cookie, category);
        setApprovedCookies((prev) => new Set(prev).add(cookieKey));
        setRow(cookieKey, null);
        toast.success(`${cookie.name} approved as ${category}`);
      } else {
        setRow(cookieKey, { status: 'unpublished', category });
        toast.warning('Saved, but not published: the database is unavailable.');
      }
    } catch {
      setRow(cookieKey, { status: 'error', category });
    }
  };

  // Decision 12A: a suggestion made without identity evidence needs an explicit confirmation.
  const handleApproveCookie = useCallback(
    (cookieKey, cookie) => {
      const chosenCat = categoryOverrides[cookieKey] || cookie?.mlClassification || cookie?.category || 'Unclassified';
      if (needsManualCheck(cookie)) setConfirming({ cookieKey, cookie, category: chosenCat });
      else approveNow(cookieKey, cookie, chosenCat);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- approveNow reads current state when called
    [categoryOverrides]
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
    const keyOf = (c) => `${c.scanDomain}:${c.name}`;
    const pool = selectedForBulk.size > 0 ? filteredCookies.filter((c) => selectedForBulk.has(keyOf(c))) : filteredCookies;
    // Manual-check rows (12A) each need their own confirmation, so bulk skips them.
    const target = pool.filter((c) => !needsManualCheck(c) && !approvedCookies.has(keyOf(c)));
    const held = pool.length - pool.filter((c) => !needsManualCheck(c)).length;
    const count = target.length;
    if (!window.confirm(`Approve ${count} cookie${count !== 1 ? 's' : ''} in this queue?`)) {
      return;
    }
    setBulkApproving(true);
    const categoryOf = (c) => categoryOverrides[keyOf(c)] || c.mlClassification || c.category || 'Unclassified';
    publishCategories(target.map((c) => ({
      scanId: c.scanId, name: c.name, domain: c.domain, oldCategory: c.category, newCategory: categoryOf(c),
    })))
      .then(({ total, published, publishedNames }) => {
        const done = new Set(publishedNames);
        const newApproved = new Set(approvedCookies);
        target.forEach((c) => {
          if (done.has(c.name)) {
            logApproval(keyOf(c), c, categoryOf(c));
            newApproved.add(keyOf(c));
            setRow(keyOf(c), null);
          } else {
            setRow(keyOf(c), { status: 'unpublished', category: categoryOf(c) });
          }
        });
        setApprovedCookies(newApproved);
        const summary = publishSummary({ total, published });
        toast[summary.tone](summary.text);
      })
      .catch(() => target.forEach((c) => setRow(keyOf(c), { status: 'error', category: categoryOf(c) })))
      .finally(() => setBulkApproving(false));
    setSelectedForBulk(new Set());
    if (held) notify(`${held} ${held === 1 ? 'needs' : 'need'} a manual check and stayed in the queue`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logApproval/notify are stable helpers
  }, [filteredCookies, approvedCookies, selectedForBulk, categoryOverrides]);

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

  const TABS = [
    ['high', 'High priority', queueStats.high],
    ['quick', 'Quick review', queueStats.quick],
    ['validation', 'Validation', queueStats.validation],
  ];
  const allSelected = displayedCookies.length > 0 && displayedCookies.every((c) => selectedForBulk.has(`${c.scanDomain}:${c.name}`));

  return (
    <section className="rq-panel" aria-labelledby="rq-title">
      <div className="rq-panel__head">
        <h2 id="rq-title" className="rq-title">
          Pending review queue
          <Chip tone="count">{`${queueStats.pending} Items`}</Chip>
        </h2>
        {displayedCookies.length > 0 && (
          <Button variant="success" icon={ThumbsUp} onClick={handleBulkApprove} disabled={bulkApproving}>
            {bulkApproving ? 'Approving…'
              : selectedForBulk.size > 0 ? `Approve Selected (${selectedForBulk.size})`
              : `Approve All (${displayedCookies.length})`}
          </Button>
        )}
      </div>

      {/* Queues as UCM underline tabs */}
      <div className="rq-tabs" role="tablist" aria-label="Review queues">
        {TABS.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className="rq-tab"
            onClick={() => setActiveTab(id)}
          >
            {label}
            <span className="rq-tab__count">{count}</span>
          </button>
        ))}
      </div>

      <div className="rq-controls">
        <label className="rq-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search review queue"
            placeholder="Search by cookie name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <select aria-label="Domain" value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="rq-select">
          <option value="all">All domains</option>
          {domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
        </select>
        <select aria-label="Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rq-select">
          <option value="all">All categories</option>
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {showNotification && (
        <div className="rq-notification" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {notificationMessage}
        </div>
      )}

      {displayedCookies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nothing to review"
          description={approvedCookies.size > 0 && (approvedCookies.size + skippedCookies.size) >= allCookies.length
            ? 'You have reviewed every cookie in this queue.'
            : 'Every model suggestion in this queue has been handled.'}
        />
      ) : (
        <div className="ui-table-scroll">
          <table className="ui-table rq-table">
            <caption className="ui-table__caption">Cookies awaiting review</caption>
            <thead>
              <tr>
                <th scope="col" className="rq-check">
                  <input type="checkbox" aria-label="Select all cookies" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th scope="col">Cookie</th>
                <th scope="col">Rule engine</th>
                <th scope="col">Model suggestion</th>
                <th scope="col" className="ui-table__cell--end">Model confidence</th>
                <th scope="col">Category</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedCookies.map((cookie) => {
                const cookieKey = `${cookie.scanDomain}:${cookie.name}`;
                const isApproved = approvedCookies.has(cookieKey);
                const confidencePercent = Math.round(getConfidence(cookie) * 100);
                const chosenCategory = categoryOverrides[cookieKey] || cookie.mlClassification || cookie.category || '';
                const bullets = getExplanationBullets(cookie);
                return (
                  <tr key={cookieKey} data-active={selectedForBulk.has(cookieKey) || undefined}>
                    <td className="rq-check">
                      <input type="checkbox" aria-label={`Select ${cookie.name}`} checked={selectedForBulk.has(cookieKey)} onChange={() => toggleBulkSelect(cookieKey)} />
                    </td>
                    <th scope="row" className="rq-cookie">
                      <span className="rq-cookie__name">{cookie.name}</span>
                      <span className="rq-cookie__domain">{cookie.domain || cookie.scanDomain}</span>
                      {bullets.length > 0 && (
                        <details className="rq-why">
                          <summary>{`Why ${cookie.mlClassification || 'this'}?`}</summary>
                          <ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                        </details>
                      )}
                    </th>
                    <td>{ruleBasedClassify(cookie)}</td>
                    <td>
                      <span className="rq-suggestion">
                        <CategoryTag category={cookie.mlClassification} />
                        {needsManualCheck(cookie) && <Chip tone="marketing" size="sm">Needs manual check</Chip>}
                      </span>
                    </td>
                    <td className="ui-table__cell--end">{`${confidencePercent}%`}</td>
                    <td>
                      <select
                        className="rq-select rq-select--row"
                        aria-label={`Category for ${cookie.name}`}
                        value={chosenCategory}
                        onChange={(e) => setCategoryOverrides((prev) => ({ ...prev, [cookieKey]: e.target.value }))}
                      >
                        {!['Strictly Necessary', 'Functional', 'Analytics', 'Marketing'].includes(chosenCategory) && (
                          <option value={chosenCategory}>{chosenCategory || 'Unclassified'}</option>
                        )}
                        {['Strictly Necessary', 'Functional', 'Analytics', 'Marketing'].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td>
                      {rowState[cookieKey]?.status === 'unpublished' && (
                        <span className="rq-row-state"><Chip tone="marketing" size="sm">Not published</Chip></span>
                      )}
                      {rowState[cookieKey]?.status === 'error' && (
                        <span className="rq-row-state rq-row-state--error">{"Couldn't save. Try again."}</span>
                      )}
                      {['unpublished', 'error'].includes(rowState[cookieKey]?.status) ? (
                        <Button size="sm" onClick={() => approveNow(cookieKey, cookie, rowState[cookieKey].category)}>Retry</Button>
                      ) : (
                      <span className="rq-actions">
                        <Button variant="success" size="sm" icon={Check} onClick={() => handleApproveCookie(cookieKey, cookie)} disabled={isApproved || rowState[cookieKey]?.status === 'saving'}>
                          {chosenCategory && chosenCategory !== (cookie.mlClassification || cookie.category) ? `Approve as ${chosenCategory}` : 'Approve'}
                        </Button>
                        <Button size="sm" onClick={() => handleSkipCookie(cookieKey)}>Skip</Button>
                      </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(confirming)}
        title="Approve without evidence?"
        variant="confirm"
        onClose={() => setConfirming(null)}
        footer={(
          <>
            <Button variant="outline" size="modal" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="success" size="modal" onClick={() => { const c = confirming; setConfirming(null); approveNow(c.cookieKey, c.cookie, c.category); }}>
              {confirming ? `Approve ${confirming.category}` : 'Approve'}
            </Button>
          </>
        )}
      >
        {confirming && <p className="rq-confirm-text">{manualCheckPrompt(confirming.category)}</p>}
      </Modal>
    </section>
  );
};

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
