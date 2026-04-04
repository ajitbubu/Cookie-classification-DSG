import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Clock, Play, Pause, Trash2, Edit3, Calendar, Zap, RefreshCw, CheckCircle } from 'lucide-react';
import './ScheduledScanPage.css';

const FREQUENCIES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const SCAN_TYPES = [
  { value: 'quick', name: 'Quick Scan', desc: 'Fast surface-level check' },
  { value: 'standard', name: 'Standard', desc: 'Full page cookie analysis' },
  { value: 'deep', name: 'Deep Scan', desc: 'Multi-page crawl + subdomains' },
];

function getScheduledJobs() {
  try {
    return JSON.parse(localStorage.getItem('scheduledJobs') || '[]');
  } catch { return []; }
}

function saveScheduledJobs(jobs) {
  localStorage.setItem('scheduledJobs', JSON.stringify(jobs));
}

function getNextRunTime(job) {
  const now = new Date();
  const next = new Date(now);

  switch (job.frequency) {
    case 'hourly':
      next.setHours(next.getHours() + 1, 0, 0, 0);
      break;
    case 'daily':
      if (job.time) {
        const [h, m] = job.time.split(':').map(Number);
        next.setHours(h, m, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
      } else {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'weekly':
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const targetDay = days.indexOf(job.day || 'sunday');
      let daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
      if (job.time) {
        const [h, m] = job.time.split(':').map(Number);
        next.setHours(h, m, 0, 0);
      }
      break;
    case 'monthly':
      const targetDate = job.date || 1;
      next.setMonth(next.getMonth() + 1, targetDate);
      if (job.time) {
        const [h, m] = job.time.split(':').map(Number);
        next.setHours(h, m, 0, 0);
      }
      break;
    default:
      break;
  }
  return next;
}

function formatRelative(date) {
  const now = new Date();
  const diff = date - now;
  if (diff < 0) return 'Overdue';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function ScheduledScanPage({ onNavigate }) {
  const [jobs, setJobs] = useState(getScheduledJobs);
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formFrequency, setFormFrequency] = useState('daily');
  const [formScanType, setFormScanType] = useState('standard');
  const [formTime, setFormTime] = useState('09:00');
  const [formDay, setFormDay] = useState('sunday');
  const [formDate, setFormDate] = useState(1);
  const [formNotify, setFormNotify] = useState(true);
  const [formAutoPublish, setFormAutoPublish] = useState(false);

  const activeJobs = jobs.filter(j => j.status === 'active');
  const pausedJobs = jobs.filter(j => j.status === 'paused');
  const totalScansThisWeek = jobs.reduce((sum, j) => {
    if (j.status !== 'active') return sum;
    if (j.frequency === 'hourly') return sum + 168;
    if (j.frequency === 'daily') return sum + 7;
    if (j.frequency === 'weekly') return sum + 1;
    return sum;
  }, 0);

  const handleCreate = () => {
    if (!formUrl.trim()) return;

    const newJob = {
      id: `job-${Date.now()}`,
      url: formUrl.trim().replace(/^(?!https?:\/\/)/, 'https://'),
      frequency: formFrequency,
      scanType: formScanType,
      time: formTime,
      day: formDay,
      date: formDate,
      notify: formNotify,
      autoPublish: formAutoPublish,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastRun: null,
      totalRuns: 0,
    };

    const updated = [...jobs, newJob];
    setJobs(updated);
    saveScheduledJobs(updated);

    // Reset form
    setFormUrl('');
    setFormFrequency('daily');
    setFormScanType('standard');
    setFormTime('09:00');
    setShowForm(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleJobStatus = (jobId) => {
    const updated = jobs.map(j =>
      j.id === jobId ? { ...j, status: j.status === 'active' ? 'paused' : 'active' } : j
    );
    setJobs(updated);
    saveScheduledJobs(updated);
  };

  const deleteJob = (jobId) => {
    const updated = jobs.filter(j => j.id !== jobId);
    setJobs(updated);
    saveScheduledJobs(updated);
  };

  const getFrequencyLabel = (job) => {
    switch (job.frequency) {
      case 'hourly': return 'Every hour';
      case 'daily': return `Daily at ${job.time || '09:00'}`;
      case 'weekly': return `Weekly on ${(job.day || 'sunday').charAt(0).toUpperCase() + (job.day || 'sunday').slice(1)}`;
      case 'monthly': return `Monthly on the ${job.date || 1}${['st','nd','rd'][((job.date || 1) - 1) % 10] || 'th'}`;
      default: return job.frequency;
    }
  };

  return (
    <div className="ss-page">
      <div className="ss-header">
        <div className="ss-header__left">
          <button className="ss-back-btn" onClick={() => onNavigate('home')}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="ss-title">Scheduled Scans</h1>
            <p className="ss-subtitle">Configure automated recurring scans for your websites</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="ss-stats">
        <div className="ss-stat">
          <div className="ss-stat__value">{jobs.length}</div>
          <div className="ss-stat__label">Total Jobs</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat__value ss-stat__value--active">{activeJobs.length}</div>
          <div className="ss-stat__label">Active</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat__value ss-stat__value--paused">{pausedJobs.length}</div>
          <div className="ss-stat__label">Paused</div>
        </div>
        <div className="ss-stat">
          <div className="ss-stat__value">{totalScansThisWeek}</div>
          <div className="ss-stat__label">Scans / Week</div>
        </div>
      </div>

      {/* New Job Form */}
      {!showForm ? (
        <button className="ss-btn ss-btn--primary" onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>
          <Plus size={14} /> Create Scheduled Scan
        </button>
      ) : (
        <div className="ss-new-job">
          <h3 className="ss-new-job__title"><Calendar size={16} /> New Scheduled Scan</h3>

          <div className="ss-form-grid">
            {/* URL */}
            <div className="ss-form-group ss-form-group--full">
              <label className="ss-form-label">Target URL</label>
              <input
                className="ss-input"
                type="url"
                placeholder="https://example.com"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
              />
            </div>

            {/* Scan Type */}
            <div className="ss-form-group ss-form-group--full">
              <label className="ss-form-label">Scan Type</label>
              <div className="ss-type-options">
                {SCAN_TYPES.map(t => (
                  <label key={t.value} className={`ss-type-option ${formScanType === t.value ? 'selected' : ''}`}>
                    <input type="radio" name="scanType" value={t.value} checked={formScanType === t.value} onChange={() => setFormScanType(t.value)} />
                    <span className="ss-type-name">{t.name}</span>
                    <span className="ss-type-desc">{t.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div className="ss-form-group ss-form-group--full">
              <label className="ss-form-label">Frequency</label>
              <div className="ss-freq-options">
                {FREQUENCIES.map(f => (
                  <label key={f.value} className={`ss-freq-option ${formFrequency === f.value ? 'selected' : ''}`}>
                    <input type="radio" name="frequency" value={f.value} checked={formFrequency === f.value} onChange={() => setFormFrequency(f.value)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Time (for daily/weekly/monthly) */}
            {formFrequency !== 'hourly' && (
              <div className="ss-form-group">
                <label className="ss-form-label">Time</label>
                <input className="ss-input" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} />
              </div>
            )}

            {/* Day (for weekly) */}
            {formFrequency === 'weekly' && (
              <div className="ss-form-group">
                <label className="ss-form-label">Day of Week</label>
                <select className="ss-select" value={formDay} onChange={e => setFormDay(e.target.value)}>
                  {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date (for monthly) */}
            {formFrequency === 'monthly' && (
              <div className="ss-form-group">
                <label className="ss-form-label">Day of Month</label>
                <select className="ss-select" value={formDate} onChange={e => setFormDate(parseInt(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Options */}
            <div className="ss-form-group">
              <label className="ss-form-label">Notifications</label>
              <select className="ss-select" value={formNotify ? 'yes' : 'no'} onChange={e => setFormNotify(e.target.value === 'yes')}>
                <option value="yes">Notify on completion</option>
                <option value="no">Silent</option>
              </select>
            </div>

            <div className="ss-form-group">
              <label className="ss-form-label">Auto-Publish Results</label>
              <select className="ss-select" value={formAutoPublish ? 'yes' : 'no'} onChange={e => setFormAutoPublish(e.target.value === 'yes')}>
                <option value="no">Manual review</option>
                <option value="yes">Auto-publish if rules pass</option>
              </select>
            </div>
          </div>

          <div className="ss-form-actions">
            <button className="ss-btn ss-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="ss-btn ss-btn--primary" disabled={!formUrl.trim()} onClick={handleCreate}>
              {saved ? <><CheckCircle size={14} /> Created!</> : <><Plus size={14} /> Create Job</>}
            </button>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="ss-jobs">
        <h3 className="ss-jobs__heading"><Clock size={16} /> Scheduled Jobs ({jobs.length})</h3>

        {jobs.length === 0 ? (
          <div className="ss-empty">
            <Calendar size={40} />
            <p>No scheduled scans yet</p>
            <span>Create your first scheduled scan to automate cookie monitoring</span>
          </div>
        ) : (
          jobs.map(job => {
            const nextRun = getNextRunTime(job);
            return (
              <div key={job.id} className={`ss-job-card ss-job-card--${job.status}`}>
                <div className={`ss-job-icon ss-job-icon--${job.status}`}>
                  {job.status === 'active' ? <Play size={16} /> : <Pause size={16} />}
                </div>
                <div className="ss-job-info">
                  <div className="ss-job-url">{job.url}</div>
                  <div className="ss-job-meta">
                    <span><strong>{getFrequencyLabel(job)}</strong></span>
                    <span>Type: <strong>{job.scanType}</strong></span>
                    <span>Runs: <strong>{job.totalRuns || 0}</strong></span>
                    {job.lastRun && <span>Last: <strong>{new Date(job.lastRun).toLocaleDateString()}</strong></span>}
                  </div>
                </div>
                {job.status === 'active' && (
                  <div className="ss-job-next">
                    <span className="ss-job-next__label">Next run</span>
                    <span className="ss-job-next__time">{formatRelative(nextRun)}</span>
                  </div>
                )}
                <span className={`ss-job-status ss-job-status--${job.status}`}>
                  {job.status === 'active' ? '● Active' : '○ Paused'}
                </span>
                <div className="ss-job-actions">
                  <button className="ss-job-action" title={job.status === 'active' ? 'Pause' : 'Resume'} onClick={() => toggleJobStatus(job.id)}>
                    {job.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button className="ss-job-action ss-job-action--danger" title="Delete" onClick={() => deleteJob(job.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ScheduledScanPage;
