import React, { useState } from 'react';
import {
  ArrowLeft, Settings, Bell, Shield, Clock, CheckCircle,
  AlertTriangle, Play, Zap, FileText, Globe, BookOpen,
  ChevronRight, Activity, Filter, Send
} from 'lucide-react';
import './AutoPublishPage.css';

const DEFAULT_SETTINGS = {
  enabled: false,
  triggers: {
    highConfAutoClassified: true,
    userReclassified: true,
    anyNewCookie: false,
    scheduledScanComplete: true,
    riskLevelChange: false,
  },
  categoryRules: {
    'Strictly Necessary': true,
    'Functional': true,
    'Analytics': true,
    'Marketing': false,
  },
  delay: '24h',
  outputs: {
    cookieDeclaration: true,
    privacyPolicy: false,
    consentBanner: true,
    internalDocs: true,
  },
  notifications: {
    email: true,
    emailAddress: '',
    slack: false,
    slackChannel: '',
    webhook: false,
    webhookUrl: '',
  },
  safety: {
    holdHighRisk: true,
    holdUnknownVendors: true,
    stagingFirst: true,
    maxPerDay: 50,
  },
};

function getPublishSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('autoPublishSettings') || '{}') };
  } catch { return DEFAULT_SETTINGS; }
}

function savePublishSettings(s) {
  localStorage.setItem('autoPublishSettings', JSON.stringify(s));
}

function getPublishQueue() {
  try { return JSON.parse(localStorage.getItem('autoPublishQueue') || '[]'); }
  catch { return []; }
}

function getPublishHistory() {
  try { return JSON.parse(localStorage.getItem('autoPublishHistory') || '[]'); }
  catch { return []; }
}

// ── Toggle Switch ──────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`ap-toggle${disabled ? ' ap-toggle--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="ap-toggle__track">
        <span className="ap-toggle__thumb" />
      </span>
    </label>
  );
}

// ── Pipeline Flow visual ───────────────────────────────────
function PipelineFlow({ settings }) {
  const steps = [
    { icon: <Activity size={14} />, label: 'Scan', desc: 'New cookies detected' },
    { icon: <Filter size={14} />, label: 'Filter', desc: 'Safety rules applied' },
    { icon: <Clock size={14} />, label: settings.delay === 'immediate' ? 'Instant' : settings.delay, desc: 'Delay window' },
    { icon: <Send size={14} />, label: 'Publish', desc: `${Object.values(settings.outputs).filter(Boolean).length} output${Object.values(settings.outputs).filter(Boolean).length !== 1 ? 's' : ''}` },
  ];
  return (
    <div className="ap-pipeline">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="ap-pipeline__step">
            <div className="ap-pipeline__icon">{s.icon}</div>
            <span className="ap-pipeline__label">{s.label}</span>
            <span className="ap-pipeline__desc">{s.desc}</span>
          </div>
          {i < steps.length - 1 && <ChevronRight size={14} className="ap-pipeline__arrow" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
function AutoPublishPage({ onNavigate }) {
  const [settings, setSettings] = useState(getPublishSettings);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  const [queue] = useState(getPublishQueue);
  const [history] = useState(getPublishHistory);

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    savePublishSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const delayOptions = [
    { value: 'immediate', label: 'Immediate' },
    { value: '1h', label: '1 hour' },
    { value: '6h', label: '6 hours' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
  ];

  const outputItems = [
    { key: 'cookieDeclaration', label: 'Cookie Declaration', icon: <FileText size={13} />, desc: 'HTML embed on your website', warn: null },
    { key: 'consentBanner', label: 'Consent Banner', icon: <Globe size={13} />, desc: 'Updates banner cookie list', warn: null },
    { key: 'internalDocs', label: 'Internal Docs', icon: <BookOpen size={13} />, desc: 'Internal audit documentation', warn: null },
    { key: 'privacyPolicy', label: 'Privacy Policy', icon: <Shield size={13} />, desc: 'Requires legal review', warn: 'Manual update recommended' },
  ];

  return (
    <div className="ap-page">

      {/* Header */}
      <div className="ap-header">
        <div className="ap-header__left">
          <button className="ap-back-btn" onClick={() => onNavigate('home')}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 className="ap-title">Auto-Publishing</h1>
            <p className="ap-subtitle">Automatically publish cookie declarations when new cookies are discovered</p>
          </div>
        </div>
        <span className={`ap-status-badge ${settings.enabled ? 'ap-status-badge--on' : 'ap-status-badge--off'}`}>
          <span className="ap-status-badge__dot" />
          {settings.enabled ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Pipeline preview (only when enabled) */}
      {settings.enabled && <PipelineFlow settings={settings} />}

      {/* Tabs */}
      <div className="ap-tabs">
        {[
          { id: 'settings', icon: <Settings size={13} />, label: 'Settings' },
          { id: 'queue',    icon: <Clock size={13} />,    label: `Queue (${queue.length})` },
          { id: 'history',  icon: <CheckCircle size={13} />, label: `History (${history.length})` },
        ].map(t => (
          <button
            key={t.id}
            className={`ap-tab ${activeTab === t.id ? 'ap-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── SETTINGS TAB ───────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="ap-settings">

          {/* Master Toggle */}
          <div className={`ap-card ap-card--master ${settings.enabled ? 'ap-card--master-on' : ''}`}>
            <div className="ap-card__row">
              <div className="ap-card__body">
                <div className="ap-card__title">
                  <Zap size={15} />
                  Enable Auto-Publishing
                </div>
                <p className="ap-card__desc">
                  When active, the pipeline below runs automatically — no manual action needed.
                </p>
              </div>
              <Toggle
                checked={settings.enabled}
                onChange={e => updateSetting('enabled', e.target.checked)}
              />
            </div>
          </div>

          {/* Trigger Conditions */}
          <div className="ap-card">
            <div className="ap-card__header">
              <div className="ap-card__title"><Play size={14} /> Trigger Conditions</div>
              <p className="ap-card__desc">Which events start the publishing pipeline?</p>
            </div>
            <div className="ap-toggle-list">
              {[
                {
                  key: 'highConfAutoClassified',
                  label: 'Auto-classified cookies (≥85% confidence)',
                  badge: 'Recommended',
                  badgeType: 'success',
                },
                {
                  key: 'userReclassified',
                  label: 'Cookies reclassified by a user',
                  badge: 'Recommended',
                  badgeType: 'success',
                },
                {
                  key: 'scheduledScanComplete',
                  label: 'Scheduled scan completes',
                  badge: 'Recommended',
                  badgeType: 'success',
                },
                {
                  key: 'anyNewCookie',
                  label: 'Any new cookie (regardless of confidence)',
                  badge: 'Risky',
                  badgeType: 'warn',
                  warn: 'May publish unreviewed cookies',
                },
                {
                  key: 'riskLevelChange',
                  label: 'Risk level changes significantly',
                  badge: null,
                },
              ].map(t => (
                <div key={t.key} className="ap-toggle-row">
                  <div className="ap-toggle-row__left">
                    <span className="ap-toggle-row__label">{t.label}</span>
                    <div className="ap-toggle-row__meta">
                      {t.badge && (
                        <span className={`ap-badge ap-badge--${t.badgeType}`}>{t.badge}</span>
                      )}
                      {t.warn && (
                        <span className="ap-warn">
                          <AlertTriangle size={10} /> {t.warn}
                        </span>
                      )}
                    </div>
                  </div>
                  <Toggle
                    checked={settings.triggers[t.key]}
                    onChange={e => updateSetting(`triggers.${t.key}`, e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Category Rules */}
          <div className="ap-card">
            <div className="ap-card__header">
              <div className="ap-card__title"><Shield size={14} /> Category Rules</div>
              <p className="ap-card__desc">Control which cookie categories auto-publish vs. hold for review</p>
            </div>
            <div className="ap-cat-grid">
              {[
                { key: 'Strictly Necessary', color: 'green',  note: 'No consent required — always safe' },
                { key: 'Functional',          color: 'yellow', note: 'Preference cookies — low risk' },
                { key: 'Analytics',           color: 'blue',   note: 'Tracking cookies — medium risk' },
                { key: 'Marketing',           color: 'purple', note: 'Ad cookies — requires legal review' },
              ].map(({ key, color, note }) => (
                <div key={key} className={`ap-cat-card ${settings.categoryRules[key] ? 'ap-cat-card--on' : 'ap-cat-card--off'}`}>
                  <div className="ap-cat-card__top">
                    <span className={`ap-cat-pill ap-cat-pill--${color}`}>{key}</span>
                    <Toggle
                      checked={settings.categoryRules[key]}
                      onChange={e => updateSetting(`categoryRules.${key}`, e.target.checked)}
                    />
                  </div>
                  <p className="ap-cat-card__note">{note}</p>
                  <span className={`ap-cat-card__status ${settings.categoryRules[key] ? 'on' : 'off'}`}>
                    {settings.categoryRules[key] ? '✓ Auto-publish' : '⏸ Hold for review'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delay */}
          <div className="ap-card">
            <div className="ap-card__header">
              <div className="ap-card__title"><Clock size={14} /> Review Window</div>
              <p className="ap-card__desc">How long to wait before publishing — gives your team time to intervene</p>
            </div>
            <div className="ap-delay-grid">
              {delayOptions.map(d => (
                <label
                  key={d.value}
                  className={`ap-delay-btn ${settings.delay === d.value ? 'ap-delay-btn--active' : ''}`}
                >
                  <input type="radio" name="delay" value={d.value} checked={settings.delay === d.value}
                    onChange={() => updateSetting('delay', d.value)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          {/* What to Publish */}
          <div className="ap-card">
            <div className="ap-card__header">
              <div className="ap-card__title"><FileText size={14} /> What to Auto-Publish</div>
              <p className="ap-card__desc">Choose which outputs get updated automatically</p>
            </div>
            <div className="ap-output-grid">
              {outputItems.map(o => (
                <div
                  key={o.key}
                  className={`ap-output-card ${settings.outputs[o.key] ? 'ap-output-card--on' : ''}`}
                  onClick={() => updateSetting(`outputs.${o.key}`, !settings.outputs[o.key])}
                >
                  <div className="ap-output-card__top">
                    <span className="ap-output-card__icon">{o.icon}</span>
                    <input type="checkbox" checked={settings.outputs[o.key]} readOnly />
                  </div>
                  <span className="ap-output-card__label">{o.label}</span>
                  <span className="ap-output-card__desc">{o.desc}</span>
                  {o.warn && (
                    <span className="ap-warn ap-warn--sm">
                      <AlertTriangle size={9} /> {o.warn}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="ap-card">
            <div className="ap-card__header">
              <div className="ap-card__title"><Bell size={14} /> Notifications</div>
              <p className="ap-card__desc">Get notified when auto-publishing runs</p>
            </div>
            <div className="ap-toggle-list">
              <div className="ap-toggle-row">
                <div className="ap-toggle-row__left">
                  <span className="ap-toggle-row__label">Email</span>
                </div>
                <Toggle checked={settings.notifications.email} onChange={e => updateSetting('notifications.email', e.target.checked)} />
              </div>
              {settings.notifications.email && (
                <input
                  className="ap-input"
                  type="email"
                  placeholder="privacy-team@company.com"
                  value={settings.notifications.emailAddress}
                  onChange={e => updateSetting('notifications.emailAddress', e.target.value)}
                />
              )}
              <div className="ap-toggle-row">
                <div className="ap-toggle-row__left">
                  <span className="ap-toggle-row__label">Slack</span>
                </div>
                <Toggle checked={settings.notifications.slack} onChange={e => updateSetting('notifications.slack', e.target.checked)} />
              </div>
              {settings.notifications.slack && (
                <input
                  className="ap-input"
                  type="text"
                  placeholder="#privacy-alerts"
                  value={settings.notifications.slackChannel}
                  onChange={e => updateSetting('notifications.slackChannel', e.target.value)}
                />
              )}
              <div className="ap-toggle-row">
                <div className="ap-toggle-row__left">
                  <span className="ap-toggle-row__label">Webhook</span>
                </div>
                <Toggle checked={settings.notifications.webhook} onChange={e => updateSetting('notifications.webhook', e.target.checked)} />
              </div>
              {settings.notifications.webhook && (
                <input
                  className="ap-input"
                  type="url"
                  placeholder="https://hooks.example.com/..."
                  value={settings.notifications.webhookUrl}
                  onChange={e => updateSetting('notifications.webhookUrl', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Safety Controls */}
          <div className="ap-card ap-card--safety">
            <div className="ap-card__header">
              <div className="ap-card__title"><Shield size={14} /> Safety Controls</div>
              <p className="ap-card__desc">Guardrails that prevent accidental publishing</p>
            </div>
            <div className="ap-toggle-list">
              {[
                { key: 'holdHighRisk',       label: 'Hold cookies with risk score > 75 for manual review' },
                { key: 'holdUnknownVendors', label: 'Hold cookies from unidentified vendors' },
                { key: 'stagingFirst',       label: 'Publish to staging first, then production after 1 hour' },
              ].map(s => (
                <div key={s.key} className="ap-toggle-row">
                  <span className="ap-toggle-row__label">{s.label}</span>
                  <Toggle checked={settings.safety[s.key]} onChange={e => updateSetting(`safety.${s.key}`, e.target.checked)} />
                </div>
              ))}
              <div className="ap-toggle-row">
                <span className="ap-toggle-row__label">Max auto-publishes per day</span>
                <select
                  className="ap-select"
                  value={settings.safety.maxPerDay}
                  onChange={e => updateSetting('safety.maxPerDay', parseInt(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div className="ap-save-bar">
            <button className={`ap-save-btn ${saved ? 'ap-save-btn--saved' : ''}`} onClick={handleSave}>
              {saved
                ? <><CheckCircle size={14} /> Saved!</>
                : 'Save Settings'
              }
            </button>
          </div>
        </div>
      )}

      {/* ── QUEUE TAB ──────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="ap-pane">
          {queue.length === 0 ? (
            <div className="ap-empty">
              <div className="ap-empty__icon"><Clock size={28} /></div>
              <p className="ap-empty__title">Queue is empty</p>
              <p className="ap-empty__desc">
                When auto-publishing is active and a trigger fires, cookies awaiting their review window appear here.
              </p>
              <div className="ap-empty__example">
                <div className="ap-queue-card ap-queue-card--example">
                  <div className="ap-queue-card__left">
                    <code className="ap-queue-card__name">_ga</code>
                    <span className="ap-queue-card__meta">Analytics · Risk: 32 · example.com</span>
                    <span className="ap-queue-card__time">Publishes in 18h 42m</span>
                  </div>
                  <span className="ap-queue-badge ap-queue-badge--pending">Pending</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="ap-list">
              {queue.map((item, i) => (
                <div key={i} className="ap-queue-card">
                  <div className="ap-queue-card__left">
                    <code className="ap-queue-card__name">{item.cookieName}</code>
                    <span className="ap-queue-card__meta">{item.category} · Risk: {item.risk}</span>
                    <span className="ap-queue-card__time">Scheduled: {item.scheduledAt}</span>
                  </div>
                  <span className={`ap-queue-badge ap-queue-badge--${item.status}`}>{item.statusLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="ap-pane">
          {history.length === 0 ? (
            <div className="ap-empty">
              <div className="ap-empty__icon"><CheckCircle size={28} /></div>
              <p className="ap-empty__title">No history yet</p>
              <p className="ap-empty__desc">
                Every auto-publish run is logged here with the cookie count, outputs updated, and timestamp.
              </p>
              <div className="ap-empty__example">
                <div className="ap-history-card ap-history-card--example">
                  <span className="ap-history-card__icon ap-history-card__icon--ok"><CheckCircle size={13} /></span>
                  <div className="ap-history-card__body">
                    <span className="ap-history-card__desc">Cookie Declaration updated — 3 new cookies</span>
                    <span className="ap-history-card__date">Today at 09:14 AM</span>
                  </div>
                  <span className="ap-history-badge ap-history-badge--ok">Published</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="ap-list">
              {history.map((item, i) => (
                <div key={i} className="ap-history-card">
                  <span className="ap-history-card__icon ap-history-card__icon--ok"><CheckCircle size={13} /></span>
                  <div className="ap-history-card__body">
                    <span className="ap-history-card__desc">{item.description}</span>
                    <span className="ap-history-card__date">{item.publishedAt}</span>
                  </div>
                  <span className="ap-history-badge ap-history-badge--ok">{item.cookieCount} cookies</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AutoPublishPage;
