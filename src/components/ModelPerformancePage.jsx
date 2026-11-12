import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Target, Database, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { getOverrideHistory, getOverrideStats } from './OverrideModal';
import { CategoryTag } from './ui/Chip';
import { pathForRoute } from '../lib/routes';
import './ModelPerformancePage.css';

// Everything on this page comes from the model the ML API is actually serving,
// so the numbers cannot drift from the deployed artifact.
const MODEL_INFO_URL = '/api/v1/ml/model-info';

// The model's class keys pair two names (Analytics_Performance); the app shows one.
const MODEL_CLASS_NAMES = { Analytics_Performance: 'Analytics', Marketing_Advertising: 'Marketing' };

// Pretty-print category names
const formatCategory = (cat) =>
  MODEL_CLASS_NAMES[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const percent = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`);

// The model's report scores three held-out tests. Each figure on this page names
// the one it comes from: they differ a lot, and only the strictest drives the gates.
const TEST_SETS = [
  {
    id: 'all',
    label: 'All cookies',
    description: "Every cookie on the held-out test websites, scored against that website's own label. Closest to what a real scan finds.",
    pick: (metrics) => metrics?.internal_site_holdout_all_cookies,
  },
  {
    id: 'consensus',
    label: "Other websites' labels accepted",
    description: 'The same cookies, but a pick also counts as right when at least 30% of the 3 or more websites declaring that cookie gave it. Websites disagree about many common cookies.',
    pick: (metrics) => metrics?.internal_site_holdout_all_cookies?.consensus,
  },
  {
    id: 'unseen',
    label: 'Never-seen names',
    description: 'Only cookies whose names never appear on a training website, the strictest test. The Macro F1 and Marketing recall gates are judged on it.',
    pick: (metrics) => metrics?.internal_site_holdout,
  },
];

const cookieCount = (scores) => (scores?.per_class
  ? Math.round(Object.values(scores.per_class).reduce((sum, c) => sum + (c.support || 0), 0))
  : null);

const GATE_LABELS = {
  macro_f1: 'Macro F1 meets the minimum',
  marketing_recall: 'Marketing recall meets the minimum',
  unclassified_precision: 'Unclassified precision meets the minimum',
  auto_precision: 'Auto-classification precision meets the target (new cookie names)',
  auto_precision_all_cookies: 'Auto-classification precision meets the target (all cookies on test websites)',
  site_holdout_is_disjoint: 'Test websites never seen in training',
  name_holdout_is_disjoint: 'Test cookie names never seen in training',
};

function ModelPerformancePage({ onNavigate }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [testSetId, setTestSetId] = useState('all');
  const overrideStats = useMemo(() => getOverrideStats(), []);
  const overrideHistory = useMemo(() => getOverrideHistory(), []);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_INFO_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => info?.categories || [], [info]);

  // Override analysis
  const overridesByCategory = useMemo(() => {
    const byCat = {};
    categories.forEach(c => { byCat[c] = { from: 0, to: 0 }; });
    overrideHistory.forEach(o => {
      const fromKey = Object.keys(byCat).find(k => formatCategory(k) === o.fromCategory || k === o.fromCategory);
      const toKey = Object.keys(byCat).find(k => formatCategory(k) === o.toCategory || k === o.toCategory);
      if (fromKey) byCat[fromKey].from++;
      if (toKey) byCat[toKey].to++;
    });
    return byCat;
  }, [overrideHistory, categories]);

  const mostOverriddenFrom = Object.entries(overridesByCategory)
    .sort((a, b) => b[1].from - a[1].from)[0];

  const header = (badge) => (
    <div className="mp-header">
      <div className="mp-header__left">
        <a
          className="mp-back-btn"
          href={pathForRoute('home')}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let new-tab clicks through
            e.preventDefault();
            onNavigate('home');
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </a>
        <div>
          <h2 className="mp-title">ML Model</h2>
          <p className="mp-subtitle">Offline evaluation of the served model on held-out websites</p>
        </div>
      </div>
      {badge}
    </div>
  );

  if (error) {
    return (
      <div className="mp-page">
        {header(null)}
        <div className="mp-card mp-status" role="alert">
          Model information is unavailable ({error}). The ML service may be down; scans still use the rule engine.
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="mp-page">
        {header(null)}
        <div className="mp-card mp-status" role="status">Loading model information…</div>
      </div>
    );
  }

  const testSets = TEST_SETS.map((set) => ({ ...set, scores: set.pick(info.metrics) }));
  const available = testSets.filter((set) => set.scores?.per_class);
  const shown = available.find((set) => set.id === testSetId) || available[0];
  const allCookies = testSets.find((set) => set.id === 'all').scores;
  const acceptance = info.acceptance || {};
  const promoted = Boolean(acceptance.promotion_eligible);
  const samples = info.samples || {};
  const totalSamples = (samples.training || 0) + (samples.calibration || 0) + (samples.test || 0);
  const gates = [
    ...Object.entries(acceptance.internal_gates || {}).map(([key, passed]) => [GATE_LABELS[key] || formatCategory(key), passed]),
    ['Independent external test set passes', Boolean(acceptance.external_holdout_gate)],
  ];

  return (
    <div className="mp-page">
      {header(
        <span className={`mp-version-badge ${promoted ? 'mp-version-badge--promoted' : ''}`}>
          v{info.model_version} · {promoted ? 'Promoted' : 'Review only'}
        </span>
      )}

      {/* Key Metrics: one tile per held-out test */}
      <div className="mp-stats">
        {testSets.map((set) => (
          <div key={set.id} className="mp-stat">
            <div className="mp-stat__value">{percent(set.scores?.accuracy)}</div>
            <div className="mp-stat__label">{`Accuracy · ${set.label}`}</div>
            <div className="mp-stat__caption">
              {cookieCount(set.scores) == null ? 'Not recorded for this model'
                : `${cookieCount(set.scores).toLocaleString()} test cookies · Macro F1 ${percent(set.scores.macro_f1)}`}
            </div>
          </div>
        ))}
        <div className="mp-stat">
          <div className="mp-stat__value">{info.feature_count}</div>
          <div className="mp-stat__label">Features</div>
          <div className="mp-stat__caption">{formatCategory(info.model_type || 'unknown')}</div>
        </div>
      </div>

      {/* Per-category performance */}
      <div className="mp-card">
        <h3 className="mp-card__title"><Target size={16} /> Performance by Category</h3>
        {shown ? (
          <>
          <div className="mp-tabs" role="tablist" aria-label="Test set">
            {available.map((set) => (
              <button
                key={set.id}
                type="button"
                role="tab"
                id={`mp-tab-${set.id}`}
                aria-selected={set.id === shown.id}
                aria-controls="mp-category-table"
                className="mp-tab"
                onClick={() => setTestSetId(set.id)}
              >
                {set.label}
              </button>
            ))}
          </div>
          <p className="mp-card__desc">{shown.description}</p>
          <div className="mp-table" id="mp-category-table" role="region" aria-label={`Performance by category: ${shown.label}`} tabIndex={0}>
            <div className="mp-table__header">
              <span>Category</span>
              <span>Precision</span>
              <span>Recall</span>
              <span>F1</span>
              <span>Test cookies</span>
            </div>
            {Object.entries(shown.scores.per_class).map(([category, scores]) => (
              <div key={category} className="mp-table__row">
                <span className="mp-table__name">{formatCategory(category)}</span>
                <span className="mono">{percent(scores.precision)}</span>
                <span className="mono">{percent(scores.recall)}</span>
                <span className="mono">{percent(scores['f1-score'])}</span>
                <span className="mono">{Math.round(scores.support).toLocaleString()}</span>
              </div>
            ))}
          </div>
          </>
        ) : (
          <p className="mp-card__desc">No held-out evaluation is recorded for this model.</p>
        )}
      </div>

      {/* Promotion gates */}
      <div className="mp-card">
        <h3 className="mp-card__title"><Shield size={16} /> Promotion Gates</h3>
        <p className="mp-card__desc">
          Automatic classification is {acceptance.auto_classification_enabled ? 'on' : 'off'}.
          {' '}It stays off until every gate passes; until then each model suggestion goes to the Review Queue.
          {' '}Macro F1 and Marketing recall are judged on never-seen cookie names, the strictest test.
        </p>
        <ul className="mp-gates">
          {gates.map(([label, passed]) => (
            <li key={label} className={`mp-gate ${passed ? 'mp-gate--pass' : 'mp-gate--fail'}`}>
              {passed ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
              <span>{label}</span>
              <span className="mp-gate__status">{passed ? 'Pass' : 'Not met'}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Training Data Stats */}
      <div className="mp-card">
        <h3 className="mp-card__title"><Database size={16} /> Training Data</h3>
        <div className="mp-training-stats">
          <div className="mp-training-stat">
            <div className="mp-training-stat__value mono">{(samples.training || 0).toLocaleString()}</div>
            <div className="mp-training-stat__label">Training rows</div>
          </div>
          <div className="mp-training-stat">
            <div className="mp-training-stat__value mono">{(samples.calibration || 0).toLocaleString()}</div>
            <div className="mp-training-stat__label">Calibration rows</div>
          </div>
          <div className="mp-training-stat">
            <div className="mp-training-stat__value mono">{(cookieCount(allCookies) ?? samples.test ?? 0).toLocaleString()}</div>
            <div className="mp-training-stat__label">Test cookies</div>
            {allCookies && <div className="mp-training-stat__caption">{`${(samples.test || 0).toLocaleString()} with never-seen names`}</div>}
          </div>
        </div>
        <div className="mp-categories-list">
          <h4 className="mp-categories-title">Classification Categories</h4>
          <div className="mp-categories-chips">
            {categories.map(cat => <CategoryTag key={cat} category={cat} />)}
          </div>
        </div>
      </div>

      {/* Override Impact on Model */}
      <div className="mp-card">
        <h3 className="mp-card__title"><Shield size={16} /> Override Impact & Retraining Signals</h3>
        <div className="mp-override-stats">
          <div className="mp-override-stat">
            <div className="mp-override-stat__label">Total Overrides Recorded</div>
            <div className="mp-override-stat__value">{overrideStats.total}</div>
          </div>
          <div className="mp-override-stat">
            <div className="mp-override-stat__label">Most Overridden From</div>
            <div className="mp-override-stat__value">
              {mostOverriddenFrom && mostOverriddenFrom[1].from > 0
                ? `${formatCategory(mostOverriddenFrom[0])} (${mostOverriddenFrom[1].from})`
                : 'None yet'}
            </div>
          </div>
          <div className="mp-override-stat">
            <div className="mp-override-stat__label">Retraining Recommended</div>
            {/* "Not yet" is a neutral state, not a success, so only "Yes" gets a colour */}
            <div className={`mp-override-stat__value ${overrideStats.total >= 50 ? 'mp-text-critical' : ''}`}>
              {overrideStats.total >= 50 ? 'Yes: enough override data to retrain' : `Not yet: ${overrideStats.total} of 50 overrides recorded`}
            </div>
          </div>
          <div className="mp-override-stat">
            <div className="mp-override-stat__label">Override-to-Sample Ratio</div>
            <div className="mp-override-stat__value">
              {totalSamples > 0 && overrideStats.total > 0 ? `${((overrideStats.total / totalSamples) * 100).toFixed(2)}%` : '0%'}
            </div>
          </div>
        </div>
      </div>

      {/* Trained At */}
      {info.trained_at && (
        <div className="mp-trained-footer">
          v{info.model_version} trained on {new Date(info.trained_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {info.feature_count} features · {info.serialization_format}
        </div>
      )}
    </div>
  );
}

export default ModelPerformancePage;
