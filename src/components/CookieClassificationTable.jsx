import React from 'react';
import { ServerCrash, Cookie, ChevronsUp, ChevronsDown, Equal, History } from 'lucide-react';
import { CategoryTag } from './ui/Chip';
import MLClassificationDropdown from './MLClassificationDropdown';
import { normalizeCategory } from '../lib/classificationPolicy';
import './CookieClassificationTable.css';

const ABSTAIN_REASON_TEXT = {
  model_unavailable: 'ML service unavailable',
  missing_classification_result: 'No result returned',
};

/**
 * Resolve how the rule engine and the ML model relate for one cookie.
 *   - 'no-call'  the model never ran (fell back to rules)
 *   - 'agree'    the model picked the cookie's current category
 *   - 'differ'   the model picked something else -> row is flagged
 */
function resolveAgreement(cookie) {
  const rule = normalizeCategory(cookie.originalCategory || cookie.category);
  const current = normalizeCategory(cookie.category);
  const ml = normalizeCategory(cookie.mlSuggestedClassification || cookie.mlClassification);
  const noCall =
    cookie.classificationSource === 'rules_fallback' ||
    cookie.classificationStatus === 'abstained' ||
    !cookie.mlClassification;

  if (noCall) return { state: 'no-call', rule, current, ml: null };
  return { state: ml === current ? 'agree' : 'differ', rule, current, ml };
}

// Figma confidence: double chevron up (High, green), equals (Medium, amber),
// double chevron down (Low, red).
const CONFIDENCE = {
  high: { icon: ChevronsUp, label: 'High' },
  medium: { icon: Equal, label: 'Medium' },
  low: { icon: ChevronsDown, label: 'Low' },
};

function Confidence({ level }) {
  const c = CONFIDENCE[(level || '').toLowerCase()];
  if (!c) return <span className="cct-muted">—</span>;
  return (
    <span className={`cct-confidence cct-confidence--${c.label.toLowerCase()}`}>
      <c.icon size={18} aria-hidden="true" />
      {c.label}
    </span>
  );
}

/**
 * Cookie classification results in the Figma Domain Details columns
 * (12.12.39). Category is what the cookie is filed under now, with the rule
 * engine's answer noted when it differs; ML Classification is the model's
 * suggestion in the publish dropdown; Confidence is the model's level. A row
 * where the model disagrees with the current category is flagged.
 */
function CookieClassificationTable({
  cookies,
  scanId,
  totalCount,
  onCategoryUpdate,
  onSelectCookie,
  // Optional row selection for bulk update (Domain Details). Keys are "name|domain".
  selectedKeys,
  onToggleSelect,
  onToggleSelectAll,
}) {
  const selectable = Boolean(onToggleSelect);
  const rowKey = (cookie) => `${cookie.name}|${cookie.domain}`;
  const selectedCount = selectable ? cookies.filter((c) => selectedKeys?.has(rowKey(c))).length : 0;
  const agreements = cookies.map(resolveAgreement);
  const noCallCount = agreements.filter((a) => a.state === 'no-call').length;
  const modelDown = noCallCount > 0 && noCallCount === cookies.length;

  if (cookies.length === 0) {
    const filteredOut = (totalCount ?? 0) > 0;
    return (
      <div className="cct cct-empty">
        <Cookie size={32} className="cct-empty__icon" aria-hidden="true" />
        <h3 className="cct-empty__title">
          {filteredOut ? 'No cookies match these filters' : 'No cookies found'}
        </h3>
        <p className="cct-empty__msg">
          {filteredOut
            ? `The scan found ${totalCount} cookies, but the current filters hide all of them. Clear a filter to see them.`
            : 'This page did not set any cookies while it was scanned. Try a Deep scan to crawl more pages, or scan a different URL.'}
        </p>
      </div>
    );
  }

  return (
    <div className="cct">
      {modelDown && (
        <p className="cct-down" role="status">
          <ServerCrash size={16} aria-hidden="true" />
          ML model did not run — showing rule engine only
        </p>
      )}

      <div className="cct-scroll">
        <table className="cct-table">
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="cct-select">
                  <input
                    type="checkbox"
                    aria-label="Select all cookies"
                    checked={selectedCount > 0 && selectedCount === cookies.length}
                    ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < cookies.length; }}
                    onChange={() => onToggleSelectAll?.()}
                  />
                </th>
              )}
              <th scope="col">Cookie Name</th>
              <th scope="col">Domain</th>
              <th scope="col">Category</th>
              <th scope="col">ML Classification</th>
              <th scope="col">Confidence</th>
              <th scope="col">Consent</th>
              <th scope="col">Party Type</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((cookie, idx) => {
              const { state, rule, current, ml } = agreements[idx];
              const reason = state === 'no-call' && !modelDown ? ABSTAIN_REASON_TEXT[cookie.abstainReason] : null;
              return (
                <tr key={`${cookie.name}-${cookie.domain}-${idx}`} data-flagged={state === 'differ'}>
                  {selectable && (
                    <td className="cct-select">
                      <input
                        type="checkbox"
                        aria-label={`Select ${cookie.name}`}
                        checked={Boolean(selectedKeys?.has(rowKey(cookie)))}
                        onChange={() => onToggleSelect(cookie)}
                      />
                    </td>
                  )}
                  <td className="cct-name">{cookie.name}</td>
                  <td className="cct-domain">{cookie.domain}</td>
                  <td>
                    <span className="cct-category">
                      <CategoryTag category={current} solid />
                      {rule !== current && <span className="cct-note">{`Rule engine: ${rule}`}</span>}
                    </span>
                  </td>
                  <td>
                    <span className="cct-ml">
                      <MLClassificationDropdown
                        currentMLClassification={ml}
                        actualCategory={cookie.category}
                        displayValue={ml || 'Select category'}
                        mlConfidence={cookie.mlConfidence}
                        mlConfidenceLevel={cookie.mlConfidenceLevel}
                        cookieName={cookie.name}
                        cookieDomain={cookie.domain}
                        scanId={scanId}
                        onCategoryUpdate={onCategoryUpdate}
                        showConfidence={false}
                        showAgreement={false}
                      />
                      {state === 'no-call' && <span className="cct-note">No prediction</span>}
                      {reason && <span className="cct-note">{reason}</span>}
                    </span>
                  </td>
                  <td>{state === 'no-call' ? <span className="cct-muted">—</span> : <Confidence level={cookie.mlConfidenceLevel} />}</td>
                  <td>
                    {cookie.requiresConsent
                      ? <span className="cct-flag">Required</span>
                      : <span>Not Required</span>}
                  </td>
                  <td>
                    {cookie.isThirdParty
                      ? <span className="cct-flag">3rd Party</span>
                      : <span>1st Party</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cct-history"
                      aria-label={`History for ${cookie.name}`}
                      onClick={() => onSelectCookie?.(cookie)}
                      disabled={!onSelectCookie}
                    >
                      <History size={22} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CookieClassificationTable;
