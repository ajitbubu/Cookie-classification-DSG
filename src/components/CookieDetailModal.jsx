import React, { useState } from 'react';
import { X, Cookie, Shield, Globe, Clock, AlertTriangle, CheckCircle, Info, Lock, Unlock, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import './CookieDetailModal.css';
import { categorySource, heuristicSignals, signalsNote } from '../lib/classificationEvidence';

// Risk scoring per PRD Section 7 — 5 factors
function calculateCookieRiskScore(cookie) {
  const factors = [];

  // 1. Misclassification Risk (30% weight) — based on ML confidence
  const conf = cookie.mlConfidence ?? 0;
  const misclassScore = Math.round((1 - conf) * 100);
  factors.push({
    name: 'Misclassification Risk',
    score: misclassScore,
    weight: 30,
    detail: conf >= 0.85
      ? `High confidence (${Math.round(conf * 100)}%) in ${cookie.mlClassification || cookie.category} classification`
      : conf >= 0.65
        ? `Moderate confidence (${Math.round(conf * 100)}%) — needs review`
        : `Low confidence (${Math.round(conf * 100)}%) — high misclassification risk`
  });

  // 2. Consent Risk (25% weight)
  const isNonEssential = cookie.category !== 'Strictly Necessary';
  const consentScore = isNonEssential ? (cookie.requiresConsent ? 50 : 85) : 5;
  factors.push({
    name: 'Consent Risk',
    score: consentScore,
    weight: 25,
    detail: !isNonEssential
      ? 'Strictly Necessary — no consent required'
      : cookie.requiresConsent
        ? `${cookie.category} cookie — consent mechanism should be in place`
        : `${cookie.category} cookie used without explicit consent`
  });

  // 3. Data Transfer Risk (20% weight)
  const transferScore = cookie.isThirdParty ? 70 : 10;
  factors.push({
    name: 'Data Transfer Risk',
    score: transferScore,
    weight: 20,
    detail: cookie.isThirdParty
      ? `Third-party cookie — data shared with external domain (${cookie.domain})`
      : 'First-party cookie — data stays with site owner'
  });

  // 4. Vendor Risk (15% weight)
  const knownVendors = ['google', 'facebook', 'meta', 'adobe', 'hotjar', 'hubspot', 'linkedin', 'twitter', 'microsoft', 'amazon', 'cloudflare', 'stripe'];
  const domainLower = (cookie.domain || '').toLowerCase();
  const isKnownVendor = knownVendors.some(v => domainLower.includes(v));
  const vendorScore = cookie.isThirdParty ? (isKnownVendor ? 25 : 85) : 5;
  factors.push({
    name: 'Vendor Risk',
    score: vendorScore,
    weight: 15,
    detail: !cookie.isThirdParty
      ? 'First-party — no external vendor risk'
      : isKnownVendor
        ? `Known vendor (${cookie.domain}) with documented compliance`
        : `Unknown vendor (${cookie.domain}) — compliance status uncertain`
  });

  // 5. Transparency Risk (10% weight)
  const transparencyScore = cookie.category === 'Strictly Necessary' ? 5
    : cookie.isThirdParty ? 60 : 20;
  factors.push({
    name: 'Transparency Risk',
    score: transparencyScore,
    weight: 10,
    detail: cookie.category === 'Strictly Necessary'
      ? 'Essential cookie — minimal disclosure needed'
      : cookie.isThirdParty
        ? 'Third-party cookie must be disclosed in privacy policy'
        : 'Should be documented in cookie declaration'
  });

  // Weighted total
  const totalScore = Math.round(
    factors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0)
  );

  let level, icon;
  if (totalScore >= 76) { level = 'Critical'; icon = '🔴'; }
  else if (totalScore >= 51) { level = 'High'; icon = '🟠'; }
  else if (totalScore >= 26) { level = 'Medium'; icon = '🟡'; }
  else { level = 'Low'; icon = '🟢'; }

  return { totalScore, level, icon, factors };
}

// Alternative category probabilities
function getAlternativeProbabilities(cookie) {
  return (cookie.mlAlternativePredictions || []).map((alternative) => ({
    category: alternative.category,
    probability: Math.round((alternative.probability ?? 0) * 100),
  }));
}

function getRiskColor(score) {
  if (score >= 76) return '#ef4444';
  if (score >= 51) return '#f97316';
  if (score >= 26) return '#eab308';
  return '#22c55e';
}

function CookieDetailModal({ cookie, onClose, onOverride }) {
  const [activeSection, setActiveSection] = useState('classification');
  const [showAllReasons, setShowAllReasons] = useState(false);

  if (!cookie) return null;

  const risk = calculateCookieRiskScore(cookie);
  const source = categorySource(cookie);
  const signals = heuristicSignals(cookie);
  const note = signalsNote(signals);
  const alternatives = getAlternativeProbabilities(cookie);
  const confidence = Math.round((cookie.mlConfidence ?? 0) * 100);
  const category = cookie.mlClassification || cookie.category || 'Unknown';

  const sections = [
    { id: 'classification', label: 'Classification' },
    { id: 'risk', label: 'Risk Score' },
    { id: 'details', label: 'Details' },
  ];

  return (
    <div className="cdm-overlay" onClick={onClose}>
      <div className="cdm-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cdm-header">
          <div className="cdm-header__left">
            <Cookie size={20} className="cdm-header__icon" />
            <div>
              <h2 className="cdm-header__name">{cookie.name}</h2>
              <div className="cdm-header__meta">
                <span className="cdm-meta-pill">
                  <Globe size={11} />
                  {cookie.domain}
                </span>
                <span className={`cdm-meta-pill cdm-meta-pill--party ${cookie.isThirdParty ? 'third' : 'first'}`}>
                  {cookie.isThirdParty ? '🌐 Third-Party' : '🏠 First-Party'}
                </span>
                <span className={`cdm-meta-pill cdm-meta-pill--category cat-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                  {category}
                </span>
              </div>
            </div>
          </div>
          <button className="cdm-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Quick Stats */}
        <div className="cdm-stats-row">
          <div className="cdm-stat">
            <span className="cdm-stat__label">Confidence</span>
            <div className="cdm-stat__bar-wrap">
              <div
                className={`cdm-stat__bar cdm-stat__bar--${confidence >= 85 ? 'high' : confidence >= 65 ? 'med' : 'low'}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="cdm-stat__value">{confidence}%</span>
          </div>
          <div className="cdm-stat">
            <span className="cdm-stat__label">Risk Score</span>
            <div className="cdm-stat__risk" style={{ color: getRiskColor(risk.totalScore) }}>
              {risk.icon} {risk.totalScore}/100
            </div>
            <span className="cdm-stat__sublabel">{risk.level}</span>
          </div>
          <div className="cdm-stat">
            <span className="cdm-stat__label">Type</span>
            <span className="cdm-stat__value">{cookie.type || (cookie.expiry_days ? 'Persistent' : 'Session')}</span>
          </div>
          <div className="cdm-stat">
            <span className="cdm-stat__label">Consent</span>
            <span className={`cdm-stat__value ${cookie.requiresConsent ? 'cdm-stat--warn' : 'cdm-stat--ok'}`}>
              {cookie.requiresConsent ? 'Required' : 'Not Required'}
            </span>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="cdm-tabs">
          {sections.map(s => (
            <button
              key={s.id}
              className={`cdm-tab ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="cdm-body">
          {activeSection === 'classification' && (
            <div className="cdm-section">
              {/* Why This Category */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">
                  <Info size={16} />
                  Why {category}
                </h3>
                <p className="cdm-source">{source.text}</p>
                {source.warning && <p className="cdm-source cdm-source--warning cdm-stat--warn"><AlertTriangle size={14} aria-hidden="true" />{source.warning}</p>}
                <h4 className="cdm-card__subtitle">Other signals</h4>
                <p className="cdm-card__note">{"Simple checks on the cookie's name and flags, not the model's reasoning."}</p>
                {signals.length > 0 && (
                  <ul className="cdm-reasons">
                    {signals.map((signal) => (
                      <li key={signal.text} className="cdm-reason">
                        <span className="cdm-reason__text">{signal.text}</span>
                        {signal.weak && <span className="cdm-reason__weak">Weak signal</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {note && <p className="cdm-card__note cdm-card__note--verdict">{note}</p>}
              </div>

              {/* Alternative Possibilities */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">Alternative Possibilities</h3>
                <div className="cdm-alternatives">
                  {alternatives.map((alt, i) => (
                    <div key={i} className="cdm-alt">
                      <span className={`cdm-alt__badge cat-${alt.category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {alt.category}
                      </span>
                      <span className="cdm-alt__pct">{alt.probability}%</span>
                    </div>
                  ))}
                  {alternatives.length === 0 && (
                    <span className="cdm-alt__empty">No model alternatives were returned.</span>
                  )}
                </div>
              </div>

              {/* Party Classification Detail */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">
                  {cookie.isThirdParty ? '🌐' : '🏠'} Why {cookie.isThirdParty ? 'Third' : 'First'}-Party?
                </h3>
                <ul className="cdm-detail-list">
                  {cookie.isThirdParty ? (
                    <>
                      <li>Cookie domain (<strong>{cookie.domain}</strong>) different from visited site</li>
                      <li>Set by external tracking or service provider</li>
                      <li>Data shared with external party</li>
                      <li>Higher compliance risk — requires explicit disclosure</li>
                    </>
                  ) : (
                    <>
                      <li>Cookie domain (<strong>{cookie.domain}</strong>) matches or is subdomain of visited site</li>
                      <li>Data stays with website owner</li>
                      <li>Lower regulatory scrutiny</li>
                      <li>Consent depends on purpose ({category})</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'risk' && (
            <div className="cdm-section">
              {/* Overall Risk */}
              <div className="cdm-card">
                <div className="cdm-risk-header">
                  <h3 className="cdm-card__title">
                    <AlertTriangle size={16} />
                    Risk Score: {risk.totalScore}/100
                  </h3>
                  <span className="cdm-risk-level" style={{ color: getRiskColor(risk.totalScore) }}>
                    {risk.icon} {risk.level}
                  </span>
                </div>

                <div className="cdm-risk-factors">
                  {risk.factors.map((f, i) => (
                    <div key={i} className="cdm-risk-factor">
                      <div className="cdm-risk-factor__header">
                        <span className="cdm-risk-factor__name">{f.name}</span>
                        <span className="cdm-risk-factor__score" style={{ color: getRiskColor(f.score) }}>
                          {f.score}/100
                        </span>
                        <span className="cdm-risk-factor__weight">({f.weight}% weight)</span>
                      </div>
                      <div className="cdm-risk-factor__bar">
                        <div
                          className="cdm-risk-factor__fill"
                          style={{ width: `${f.score}%`, background: getRiskColor(f.score) }}
                        />
                      </div>
                      <p className="cdm-risk-factor__detail">{f.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance Impact */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">
                  <Shield size={16} />
                  Compliance Impact
                </h3>
                <div className="cdm-compliance-rows">
                  {cookie.requiresConsent && (
                    <div className="cdm-compliance-item cdm-compliance-item--warn">
                      <AlertTriangle size={14} />
                      <span>{category} cookie requires explicit consent under GDPR/CCPA</span>
                    </div>
                  )}
                  {cookie.isThirdParty && (
                    <div className="cdm-compliance-item cdm-compliance-item--warn">
                      <AlertTriangle size={14} />
                      <span>Third-party data transfer — verify Data Processing Agreements</span>
                    </div>
                  )}
                  {cookie.isThirdParty && category === 'Marketing' && (
                    <div className="cdm-compliance-item cdm-compliance-item--critical">
                      <AlertTriangle size={14} />
                      <span>Cross-border marketing transfer — Standard Contractual Clauses needed</span>
                    </div>
                  )}
                  {!cookie.requiresConsent && !cookie.isThirdParty && (
                    <div className="cdm-compliance-item cdm-compliance-item--ok">
                      <CheckCircle size={14} />
                      <span>Low compliance risk — first-party essential cookie</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'details' && (
            <div className="cdm-section">
              {/* Security Attributes */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">
                  <Lock size={16} />
                  Security Attributes
                </h3>
                <div className="cdm-detail-grid">
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">HTTP Only</span>
                    <span className={`cdm-detail-val ${cookie.httpOnly ? 'cdm-val--secure' : 'cdm-val--insecure'}`}>
                      {cookie.httpOnly ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Secure (HTTPS)</span>
                    <span className={`cdm-detail-val ${cookie.secure ? 'cdm-val--secure' : 'cdm-val--insecure'}`}>
                      {cookie.secure ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">SameSite</span>
                    <span className="cdm-detail-val">{cookie.sameSite || 'Not Set'}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Path</span>
                    <span className="cdm-detail-val">{cookie.path || '/'}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Expiry</span>
                    <span className="cdm-detail-val">
                      {cookie.expiry_days ? `${cookie.expiry_days} days` : 'Session'}
                    </span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Type</span>
                    <span className="cdm-detail-val">{cookie.type || (cookie.expiry_days ? 'Persistent' : 'Session')}</span>
                  </div>
                </div>
              </div>

              {/* Cookie Value (truncated) */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">
                  <Eye size={16} />
                  Cookie Value (Sample)
                </h3>
                <code className="cdm-code-block">
                  {cookie.value ? cookie.value.substring(0, 120) + (cookie.value.length > 120 ? '...' : '') : 'Not collected: scans never keep cookie values.'}
                </code>
              </div>

              {/* Raw Data */}
              <div className="cdm-card">
                <h3 className="cdm-card__title">Raw Attributes</h3>
                <div className="cdm-detail-grid">
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Cookie Name</span>
                    <span className="cdm-detail-val cdm-detail-val--mono">{cookie.name}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Domain</span>
                    <span className="cdm-detail-val cdm-detail-val--mono">{cookie.domain}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">ML Classification</span>
                    <span className="cdm-detail-val">{cookie.mlClassification || 'N/A'}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Rule-Based Category</span>
                    <span className="cdm-detail-val">{cookie.originalCategory || cookie.category || 'N/A'}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Confidence Level</span>
                    <span className="cdm-detail-val">{cookie.mlConfidenceLevel || 'N/A'}</span>
                  </div>
                  <div className="cdm-detail-row">
                    <span className="cdm-detail-key">Auto-Classified</span>
                    <span className="cdm-detail-val">{(cookie.mlConfidence || 0) >= 0.85 ? 'Yes' : 'No — requires review'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cdm-footer">
          {onOverride && (
            <button className="cdm-btn cdm-btn--override" onClick={() => onOverride(cookie)}>
              Override Classification
            </button>
          )}
          <button className="cdm-btn cdm-btn--close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export { calculateCookieRiskScore };
export default CookieDetailModal;
