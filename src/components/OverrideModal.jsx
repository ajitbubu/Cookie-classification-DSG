import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import './OverrideModal.css';

const CATEGORIES = ['Strictly Necessary', 'Functional', 'Analytics', 'Marketing'];

const OVERRIDE_REASONS = [
  'Legal team interpretation differs from AI classification',
  'Vendor confirmed different purpose for this cookie',
  'Internal policy requires different categorization',
  'Regulatory guidance updated — reclassification needed',
  'Other (specify below)',
];

// Persist overrides in localStorage
function getOverrideHistory() {
  try {
    return JSON.parse(localStorage.getItem('cookieOverrides') || '[]');
  } catch { return []; }
}

function saveOverride(entry) {
  const history = getOverrideHistory();
  history.unshift(entry);
  // Keep last 500 overrides
  localStorage.setItem('cookieOverrides', JSON.stringify(history.slice(0, 500)));
}

function getOverridesForCookie(cookieName, domain) {
  return getOverrideHistory().filter(
    o => o.cookieName === cookieName && o.domain === domain
  );
}

function getOverrideStats() {
  const history = getOverrideHistory();
  const total = history.length;
  const byFrom = {};
  const byTo = {};
  const byReason = {};
  history.forEach(o => {
    byFrom[o.fromCategory] = (byFrom[o.fromCategory] || 0) + 1;
    byTo[o.toCategory] = (byTo[o.toCategory] || 0) + 1;
    byReason[o.reasonTemplate || 'Other'] = (byReason[o.reasonTemplate || 'Other'] || 0) + 1;
  });
  return { total, byFrom, byTo, byReason };
}

// Find similar cookies — same prefix or same domain+category
function findSimilarCookies(cookie, allCookies) {
  if (!allCookies || !cookie) return [];
  const namePrefix = cookie.name.replace(/[0-9_]+$/, ''); // strip trailing numbers/underscores
  return allCookies.filter(c =>
    c.name !== cookie.name &&
    c.domain === cookie.domain &&
    (c.name.startsWith(namePrefix) || c.category === cookie.category)
  ).slice(0, 10);
}

function OverrideModal({ cookie, allCookies, onClose, onApply }) {
  const [newCategory, setNewCategory] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [applyToSimilar, setApplyToSimilar] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const currentCategory = cookie.mlClassification || cookie.category || 'Unknown';
  const similar = useMemo(() => findSimilarCookies(cookie, allCookies), [cookie, allCookies]);
  const overrideHistory = useMemo(() => getOverridesForCookie(cookie.name, cookie.domain), [cookie]);
  const confidence = Math.round((cookie.mlConfidence || 0.5) * 100);

  const reason = selectedReason === 'Other (specify below)' ? customReason : selectedReason;
  const canSubmit = newCategory && newCategory !== currentCategory && reason.trim().length > 5;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const entry = {
      id: `override-${Date.now()}`,
      cookieName: cookie.name,
      domain: cookie.domain,
      fromCategory: currentCategory,
      toCategory: newCategory,
      reasonTemplate: selectedReason,
      reason: reason,
      confidence: cookie.mlConfidence,
      overriddenAt: new Date().toISOString(),
      appliedToSimilar: applyToSimilar,
    };

    saveOverride(entry);

    // Also save overrides for similar cookies
    applyToSimilar.forEach(simName => {
      const simCookie = allCookies?.find(c => c.name === simName && c.domain === cookie.domain);
      if (simCookie) {
        saveOverride({
          ...entry,
          id: `override-${Date.now()}-${simName}`,
          cookieName: simName,
          fromCategory: simCookie.mlClassification || simCookie.category || 'Unknown',
          appliedToSimilar: [],
          bulkFrom: cookie.name,
        });
      }
    });

    onApply({
      cookie,
      newCategory,
      reason,
      similarCookies: applyToSimilar,
    });
  };

  const toggleSimilar = (name) => {
    setApplyToSimilar(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div className="ovm-overlay" onClick={onClose}>
      <div className="ovm-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ovm-header">
          <div>
            <h2 className="ovm-title">Manual Classification Override</h2>
            <p className="ovm-subtitle">Override AI classification for <strong>{cookie.name}</strong></p>
          </div>
          <button className="ovm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ovm-body">
          {/* Current Classification */}
          <div className="ovm-card">
            <h3 className="ovm-card__title">Current Classification</h3>
            <div className="ovm-current">
              <div className="ovm-current__row">
                <span className="ovm-current__label">Cookie</span>
                <span className="ovm-current__value ovm-current__value--mono">{cookie.name}</span>
              </div>
              <div className="ovm-current__row">
                <span className="ovm-current__label">Domain</span>
                <span className="ovm-current__value">{cookie.domain}</span>
              </div>
              <div className="ovm-current__row">
                <span className="ovm-current__label">AI Classification</span>
                <span className={`ovm-cat-badge cat-${currentCategory.toLowerCase().replace(/\s+/g, '-')}`}>
                  {currentCategory}
                </span>
              </div>
              <div className="ovm-current__row">
                <span className="ovm-current__label">Confidence</span>
                <span className="ovm-current__value">{confidence}% ({cookie.mlConfidenceLevel || 'N/A'})</span>
              </div>
              <div className="ovm-current__row">
                <span className="ovm-current__label">Status</span>
                <span className="ovm-current__value">{confidence >= 85 ? 'Auto-classified' : 'Requires review'}</span>
              </div>
            </div>
          </div>

          {/* New Category Selection */}
          <div className="ovm-card">
            <h3 className="ovm-card__title">Override Classification</h3>
            <div className="ovm-categories">
              {CATEGORIES.map(cat => (
                <label
                  key={cat}
                  className={`ovm-cat-option ${newCategory === cat ? 'selected' : ''} ${cat === currentCategory ? 'current' : ''}`}
                >
                  <input
                    type="radio"
                    name="newCategory"
                    value={cat}
                    checked={newCategory === cat}
                    onChange={() => setNewCategory(cat)}
                  />
                  <span className={`ovm-cat-dot cat-${cat.toLowerCase().replace(/\s+/g, '-')}`} />
                  <span className="ovm-cat-label">{cat}</span>
                  {cat === currentCategory && <span className="ovm-cat-current-tag">Current</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="ovm-card">
            <h3 className="ovm-card__title">
              Reason for Override <span className="ovm-required">(Required)</span>
            </h3>
            <div className="ovm-reasons">
              {OVERRIDE_REASONS.map(r => (
                <label key={r} className={`ovm-reason-option ${selectedReason === r ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                  />
                  <span className="ovm-reason-text">{r}</span>
                </label>
              ))}
            </div>
            {selectedReason === 'Other (specify below)' && (
              <textarea
                className="ovm-textarea"
                placeholder="Provide a detailed reason for this override..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                rows={3}
              />
            )}
          </div>

          {/* Impact Notice */}
          {newCategory && newCategory !== currentCategory && (
            <div className="ovm-card ovm-card--impact">
              <h3 className="ovm-card__title"><AlertTriangle size={14} /> Impact of Override</h3>
              <ul className="ovm-impact-list">
                <li>Category will change from <strong>{currentCategory}</strong> to <strong>{newCategory}</strong></li>
                <li>Consent requirement: {newCategory === 'Strictly Necessary' ? 'Not required (no consent needed)' : 'Required (explicit consent needed)'}</li>
                <li>This override will be used to train future ML models</li>
                <li>Audit trail will record this manual override</li>
              </ul>
            </div>
          )}

          {/* Apply to Similar Cookies */}
          {similar.length > 0 && (
            <div className="ovm-card">
              <h3 className="ovm-card__title">Apply to Similar Cookies</h3>
              <div className="ovm-similar-list">
                {similar.map(s => (
                  <label key={s.name} className={`ovm-similar-item ${applyToSimilar.includes(s.name) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={applyToSimilar.includes(s.name)}
                      onChange={() => toggleSimilar(s.name)}
                    />
                    <span className="ovm-similar-name">{s.name}</span>
                    <span className={`ovm-similar-cat cat-${(s.category || '').toLowerCase().replace(/\s+/g, '-')}`}>
                      {s.category} → {newCategory || '?'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Override History */}
          {overrideHistory.length > 0 && (
            <div className="ovm-card">
              <button className="ovm-history-toggle" onClick={() => setShowHistory(!showHistory)}>
                <Clock size={14} />
                Override History ({overrideHistory.length})
                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showHistory && (
                <div className="ovm-history">
                  {overrideHistory.map((h, i) => (
                    <div key={i} className="ovm-history-item">
                      <div className="ovm-history-date">
                        {new Date(h.overriddenAt).toLocaleString()}
                      </div>
                      <div className="ovm-history-change">
                        <span className={`ovm-cat-badge-sm cat-${h.fromCategory.toLowerCase().replace(/\s+/g, '-')}`}>{h.fromCategory}</span>
                        <span className="ovm-history-arrow">→</span>
                        <span className={`ovm-cat-badge-sm cat-${h.toCategory.toLowerCase().replace(/\s+/g, '-')}`}>{h.toCategory}</span>
                      </div>
                      <div className="ovm-history-reason">{h.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ovm-footer">
          <button className="ovm-btn ovm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className="ovm-btn ovm-btn--confirm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <CheckCircle size={14} />
            Confirm Override{applyToSimilar.length > 0 ? ` (${1 + applyToSimilar.length} cookies)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export { getOverrideHistory, getOverrideStats, getOverridesForCookie };
export default OverrideModal;
