import { useState } from 'react';
import { Search, LayoutGrid, List, Cookie, FileText, Calendar, XCircle, CalendarClock } from 'lucide-react';
import { Chip, StatusChip, ScanTypeChip } from './ui/Chip';
import DataTable from './ui/DataTable';
import EmptyState from './ui/EmptyState';
import MenuButton from './ui/MenuButton';
import PanelError from './ui/PanelError';
import { describeSchedule, scanStatus } from '../lib/scanResults';
import './ActiveScanPage.css';

// Active Scan (Figma 1:163566). One scan runs at a time (eng finding 7), so
// this shows: the running scan, a failed or just-finished one, and every
// scheduled job (decision 4A). Cards or table, per the Figma list/grid toggle.

function buildItems({ running, failure, completed, scheduledJobs, interrupted }) {
  const items = [];
  if (running) items.push({ kind: 'running', key: 'running', url: running.url, type: running.type, data: running });
  else if (interrupted) items.push({ kind: 'interrupted', key: 'interrupted', url: interrupted.url, type: interrupted.type, data: interrupted });
  else if (failure) items.push({ kind: 'failed', key: 'failed', url: failure.url, type: failure.type, data: failure });
  if (completed && !running) items.push({ kind: 'completed', key: `done-${completed.id}`, url: completed.url || completed.domain, type: completed.scanType, data: completed });
  for (const job of scheduledJobs) items.push({ kind: 'scheduled', key: job.id, url: job.url, type: job.scanType, data: job });
  return items;
}

const percentOf = (progress) => (progress && progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : null);

// Figma 12.08.43: "Progress" with the percentage, then the bar.
function Progress({ progress, pending = false }) {
  const pct = pending ? 0 : percentOf(progress);
  return (
    <div className="as-progress">
      <div className="as-progress__row">
        <span>Progress</span>
        <span className="as-progress__text">{pct == null ? 'Scanning…' : `${pct}%`}</span>
      </div>
      <div
        className={`as-progress__track ${pct == null ? 'as-progress__track--indeterminate' : ''}`}
        role="progressbar"
        aria-label="Pages scanned"
        aria-valuemin={pct == null ? undefined : 0}
        aria-valuemax={pct == null ? undefined : 100}
        aria-valuenow={pct == null ? undefined : pct}
      >
        <span className="as-progress__fill" style={pct == null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}

function progressText(item) {
  if (item.kind === 'scheduled') return 'Pending';
  if (item.kind === 'running') { const pct = percentOf(item.data.progress); return pct == null ? 'Scanning…' : `${pct}%`; }
  return statusChip(item);
}

const hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return (url || '').toLowerCase(); }
};

function statusChip(item) {
  if (item.kind === 'running') return <StatusChip status={item.data.paused ? 'paused' : 'running'} />;
  if (item.kind === 'failed') return <StatusChip status={item.data.cancelled ? 'cancelled' : 'failed'} />;
  if (item.kind === 'interrupted') return <Chip tone="marketing" size="sm">Interrupted</Chip>;
  if (item.kind === 'scheduled') return <StatusChip status={item.data.paused ? 'paused' : 'scheduled'} />;
  const st = scanStatus(item.data);
  return <StatusChip status={st.status} failed={st.failed} />;
}

function actionsFor(item, handlers) {
  switch (item.kind) {
    case 'running':
      return item.type === 'deep' ? [
        item.data.paused
          ? { label: 'Resume scan', onSelect: handlers.onResumeRunning }
          : { label: 'Pause scan', onSelect: handlers.onPauseRunning },
        { label: 'Cancel Scan', tone: 'critical', onSelect: handlers.onCancelRunning },
      ] : [];
    case 'failed':
      return [{ label: item.data.cancelled ? 'Run again' : 'Retry scan', onSelect: handlers.onRetryScan }];
    case 'interrupted':
      return [
        { label: 'Rescan', onSelect: () => handlers.onRescanInterrupted(item.data) },
        { label: 'Dismiss', onSelect: handlers.onDismissInterrupted },
      ];
    case 'completed':
      return [
        { label: 'View results', onSelect: () => handlers.onViewResults(item.data) },
        { label: 'Dismiss', onSelect: handlers.onDismissCompleted },
      ];
    default:
      return [
        { label: 'Reschedule', onSelect: () => handlers.onRescheduleJob(item.data) },
        { label: item.data.paused ? 'Resume' : 'Pause', onSelect: () => handlers.onTogglePauseJob(item.data.id) },
        { label: 'Cancel Scan', tone: 'critical', onSelect: () => handlers.onCancelJob(item.data.id) },
      ];
  }
}

function detail(item) {
  switch (item.kind) {
    case 'running': return (
      <>
        <Progress progress={item.data.progress} />
        <p className="as-card__stats">
          <span><Cookie size={16} aria-hidden="true" />Cookies counted when done</span>
          {item.data.progress?.total > 0 && <span><FileText size={16} aria-hidden="true" />{`${item.data.progress.current}/${item.data.progress.total} Pages`}</span>}
        </p>
      </>
    );
    case 'interrupted': return (
      <p className="as-card__meta">
        <span>{`Scan of ${item.data.domain} was interrupted`}</span>
        {item.data.startedAt && <span>{new Date(item.data.startedAt).toLocaleString()}</span>}
      </p>
    );
    case 'failed': return item.data.cancelled
      ? <p className="as-card__meta">Stopped before it finished; nothing was saved.</p>
      : <p className="as-card__failure">Scan failed: {item.data.message}</p>;
    case 'completed': return (
      <p className="as-card__meta">
        <span>{`${(item.data.totalCookies ?? 0).toLocaleString()} cookies found`}</span>
        {item.data.pagesScanned ? <span>{` · ${item.data.pagesScanned} pages`}</span> : null}
      </p>
    );
    default: return (
      <>
        <Progress pending />
        <p className="as-card__stats">
          {!item.data.paused && item.data.nextRun && (
            <span><Calendar size={16} aria-hidden="true" />{new Date(item.data.nextRun).toLocaleString()}</span>
          )}
          <span>{describeSchedule(item.data)}</span>
        </p>
      </>
    );
  }
}

function ActiveScanPage({
  running, failure, completed, scheduledJobs = [], interrupted = null, loading = false, error = false, onRetry, launchControl,
  onCancelRunning, onPauseRunning, onResumeRunning, onRescanInterrupted, onDismissInterrupted, onRetryScan, onViewResults, onDismissCompleted, onCancelJob, onRescheduleJob, onTogglePauseJob,
}) {
  const [view, setView] = useState('cards');
  const handlers = { onCancelRunning, onPauseRunning, onResumeRunning, onRescanInterrupted, onDismissInterrupted, onRetryScan, onViewResults, onDismissCompleted, onCancelJob, onRescheduleJob, onTogglePauseJob };
  const items = buildItems({ running, failure, completed, scheduledJobs, interrupted });
  const inProgress = items.filter((item) => item.kind === 'running' || item.kind === 'scheduled').length;

  let body;
  if (error) {
    body = <PanelError message="Couldn't load running scans." onRetry={onRetry} />;
  } else if (loading) {
    body = (
      <div className="as-cards" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="as-card as-card--skeleton ui-skeleton" aria-hidden="true"><span className="ui-skeleton__bar" /><span className="ui-skeleton__bar ui-skeleton__bar--md" /></div>)}
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={Search}
        title="No scans on record"
        description="Scan your website to detect and classify all cookies across your domain."
      />
    );
  } else if (view === 'table') {
    body = (
      <DataTable
        caption="Active and scheduled scans"
        rowKey={(item) => item.key}
        rows={items}
        columns={[
          { key: 'url', header: 'Name', render: (item) => hostOf(item.url) },
          { key: 'type', header: 'Scan Type', render: (item) => <ScanTypeChip type={item.kind === 'scheduled' ? 'schedule' : item.type === 'deep' ? 'deep' : 'quick'} variant="pill" /> },
          { key: 'progress', header: 'Progress', render: progressText },
          { key: 'cookies', header: 'Cookies Found', render: (item) => (item.kind === 'completed' ? (item.data.totalCookies ?? 0).toLocaleString() : 'NA') },
          { key: 'scheduled', header: 'Scheduled At', render: (item) => (item.kind === 'scheduled' && item.data.nextRun ? new Date(item.data.nextRun).toLocaleString() : 'NA') },
          {
            key: 'actions',
            header: 'Action',
            render: (item) => {
              const actions = actionsFor(item, handlers);
              return actions.length ? <MenuButton label={`Actions for ${item.url}`} items={actions} /> : null;
            },
          },
        ]}
      />
    );
  } else {
    body = (
      <div className="as-cards">
        {items.map((item) => (
          <article key={item.key} className={`as-card as-card--${item.kind === 'failed' && item.data.cancelled ? 'cancelled' : item.kind}`} aria-label={item.url}>
            <div className="as-card__body">
              <div className="as-card__head">
                <span className="as-card__url" title={item.url}>{hostOf(item.url)}</span>
                <ScanTypeChip type={item.kind === 'scheduled' ? 'schedule' : item.type === 'deep' ? 'deep' : 'quick'} variant="pill" />
              </div>
              {(!['running', 'scheduled'].includes(item.kind) || item.data.paused) && <div className="as-card__status">{statusChip(item)}</div>}
              {detail(item)}
            </div>
            {actionsFor(item, handlers).length > 0 && (
              <div className="as-card__foot">
                {actionsFor(item, handlers).map((a) => (
                  <button key={a.label} type="button" onClick={a.onSelect}
                    className={`as-card__action ${a.tone === 'critical' ? 'as-card__action--critical' : ''} ${['View results', 'Retry scan', 'Run again', 'Rescan'].includes(a.label) ? 'as-card__action--primary' : ''}`}>
                    {a.tone === 'critical' && <XCircle size={20} className="as-card__action-icon" aria-hidden="true" />}
                    {a.label === 'Reschedule' && <CalendarClock size={20} className="as-card__action-icon as-card__action-icon--brand" aria-hidden="true" />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="as-page">
      {launchControl && (
        <section className="as-launch" aria-labelledby="as-launch-heading">
          <h2 id="as-launch-heading" className="as-title">Launch new scan</h2>
          {launchControl}
        </section>
      )}
    <section className="as-page" aria-labelledby="as-heading">
      <div className="as-header">
        <div className="as-header__title">
          <h2 id="as-heading" className="as-title">Active Scan</h2>
          {inProgress > 0 && <Chip tone="count">{`${inProgress} in progress`}</Chip>}
        </div>
        {items.length > 0 && !error && !loading && (
          <div className="as-toggle" role="group" aria-label="Layout">
            <button type="button" className="as-toggle__btn" aria-label="Table view" aria-pressed={view === 'table'} onClick={() => setView('table')}>
              <List size={18} aria-hidden="true" />
            </button>
            <button type="button" className="as-toggle__btn" aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
              <LayoutGrid size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {body}
    </section>
    </div>
  );
}

export default ActiveScanPage;
