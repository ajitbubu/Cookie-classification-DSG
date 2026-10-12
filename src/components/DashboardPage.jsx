import { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button';
import { Bot, X, Globe, Cookie, ShieldAlert, Radar, Check, ChevronDown, Maximize2, MousePointerClick, RotateCcw, FileText } from 'lucide-react';
import KpiCard from './ui/KpiCard';
import DataTable from './ui/DataTable';
import { CategoryTag, Chip, ScanTypeChip } from './ui/Chip';
import TableToolbar from './ui/TableToolbar';
import Donut from './charts/Donut';
import BarSeries from './charts/BarSeries';
import { categoryMix, cookieRisk, dashboardKpis, latestPerDomain, recentActivity, recentCookies } from '../lib/dashboard';
import { manualCheckPrompt, pendingReviews, readApprovals, recordApproval } from '../lib/reviewQueue';
import Modal from './ui/Modal';
import { useToast } from './Toast';
import { publishCategory } from '../lib/categoryApi';
import { formatScanDate } from '../lib/scanResults';
import './DashboardPage.css';

const MODEL_INFO_URL = '/api/v1/ml/model-info';
const DISMISS_KEY = 'aiInsightsDismissed';

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

// AI Insights (Figma 12.06.32, decision 11A): every value is live; nothing is invented.
function AiInsights({ awaitingReview, unclassified, autoClassified, onNavigate, onDismiss }) {
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_INFO_URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const accuracy = info?.metrics?.internal_site_holdout?.accuracy;
  const auto = info?.acceptance?.auto_classification_enabled;

  return (
    <section className="ai-insights" aria-labelledby="ai-insights-title">
      <div className="ai-insights__body">
        <div className="ai-insights__head">
          <Bot size={22} className="ai-insights__bot" aria-hidden="true" />
          <h2 id="ai-insights-title" className="ai-insights__title">AI insights</h2>
          {info?.model_version && <span className="ai-insights__chip">{`Model v${info.model_version}`}</span>}
        </div>
        <p className="ai-insights__sub">Based on your recent reviews and classifications</p>
        <div className="ai-insights__stats">
          {failed ? (
            <p className="ai-insights__note">Model information is unavailable. Scans still use the rule engine.</p>
          ) : (
            <>
              <div className="ai-stat">
                <span className="ai-stat__label">Classification accuracy</span>
                <span className="ai-stat__value">{accuracy == null ? '—' : `${(accuracy * 100).toFixed(1)}%`}</span>
              </div>
              <div className="ai-stat">
                <span className="ai-stat__label">Cookies auto classified</span>
                <span className="ai-stat__value">{auto == null ? '—' : (auto ? autoClassified : 0).toLocaleString()}</span>
                {auto === false && <span className="ai-stat__caption">Auto-classification is off; every suggestion is reviewed</span>}
              </div>
            </>
          )}
          <div className="ai-stat">
            <span className="ai-stat__label">Suggestions awaiting review</span>
            <span className="ai-stat__value">{awaitingReview.toLocaleString()}</span>
          </div>
          <div className="ai-stat">
            <span className="ai-stat__label">Cookie Unclassified</span>
            <span className="ai-stat__value">{unclassified.toLocaleString()}</span>
          </div>
        </div>
        <button type="button" className="ai-insights__link" onClick={() => onNavigate('model')}>View ML model</button>
      </div>
      <Bot size={96} strokeWidth={1.25} className="ai-insights__art" aria-hidden="true" />
      <button type="button" className="ai-insights__dismiss" aria-label="Dismiss AI insights" onClick={onDismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}

// Figma 12.06.32 running-scan card on the Dashboard: domain, type, timings, progress.
function RunningScan({ running }) {
  const p = running.progress;
  const known = p && p.total > 0;
  const pct = known ? Math.min(100, Math.round((p.current / p.total) * 100)) : null;
  let host = running.url;
  try { host = new URL(running.url).hostname; } catch { /* keep the raw url */ }
  return (
    <section className="db-running" aria-label={`Scan of ${host} in progress`}>
      <div className="db-running__head">
        <span className="db-running__domain">{host}</span>
        <ScanTypeChip type={running.type === 'deep' ? 'deep' : 'quick'} variant="pill" />
        <dl className="db-running__stats">
          <div><dt>Scan Duration per Page</dt><dd>{p?.avgTimePerPage || '—'}</dd></div>
          <div><dt>Scan Duration</dt><dd>{p?.totalDuration || '—'}</dd></div>
          <div><dt>Pages Scanned</dt><dd>{known ? p.current : '—'}</dd></div>
        </dl>
      </div>
      <div className={`db-running__track ${pct == null ? 'db-running__track--indeterminate' : ''}`} role="progressbar" aria-label="Pages scanned"
        aria-valuemin={pct == null ? undefined : 0} aria-valuemax={pct == null ? undefined : 100} aria-valuenow={pct == null ? undefined : pct}>
        <span style={pct == null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="db-running__foot">
        <span><Cookie size={16} aria-hidden="true" />Cookies counted when the scan finishes</span>
        {known && <span><FileText size={16} aria-hidden="true" />{`${p.current}/${p.total} Pages`}</span>}
      </div>
    </section>
  );
}

const PERIODS = [{ value: '7', label: 'This Week', days: 7 }, { value: '30', label: 'This Month', days: 30 }, { value: 'all', label: 'All Time', days: null }];

function ChartCard({ id, title, period, onPeriod, onExpand, children }) {
  return (
    <section className="db-card" aria-labelledby={id}>
      <div className="db-card__head">
        <h2 id={id} className="db-card__title">{title}</h2>
        <span className="db-card__tools">
          <label className="db-period">
            <select value={period} onChange={(e) => onPeriod(e.target.value)} aria-label="Period">
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
          <button type="button" className="db-expand" aria-label={`Expand ${title}`} onClick={onExpand}>
            <Maximize2 size={18} aria-hidden="true" />
          </button>
        </span>
      </div>
      {children}
    </section>
  );
}

// Figma table panel: title (+ chip), See All, search box and filter icons, table.
function TablePanel({ id, title, chip, seeAllLabel, onSeeAll, query, onQuery, searchLabel, filters, filter, onFilter, children }) {
  return (
    <section className="db-card db-card--table" aria-labelledby={id}>
      <div className="db-card__head">
        <h2 id={id} className="db-card__title">{title}</h2>
        {chip && <span className="db-items">{chip}</span>}
        <button type="button" className="db-link" aria-label={seeAllLabel} onClick={onSeeAll}>See All</button>
      </div>
      <TableToolbar label={searchLabel} query={query} onQuery={onQuery} filters={filters} filter={filter} onFilter={onFilter} />
      {children}
    </section>
  );
}

const lc = (v) => (v || '').toLowerCase();

function DashboardPage({ scanHistory = [], launchControl, running = null, onNavigate, onOpenScan }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [barPeriod, setBarPeriod] = useState('7');
  const [donutPeriod, setDonutPeriod] = useState('7');
  const [expanded, setExpanded] = useState(null);
  const [queries, setQueries] = useState({ cookies: '', activity: '', pending: '' });
  const [cookieFilter, setCookieFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const setQuery = (key) => (v) => setQueries((q) => ({ ...q, [key]: v }));
  const [approvals, setApprovals] = useState(readApprovals);
  const [confirming, setConfirming] = useState(null); // pending item awaiting 12A confirmation
  const [rowState, setRowState] = useState({}); // key -> 'saving' | 'unpublished' | 'error' (E4)
  const toast = useToast();

  const kpis = useMemo(() => dashboardKpis(scanHistory), [scanHistory]);
  const daysOf = (v) => PERIODS.find((p) => p.value === v)?.days ?? null;
  // Figma labels "Strictly Necessary" as "Necessary" on the charts.
  const chartLabels = (mix) => mix.map((d) => (d.label === 'Strictly Necessary' ? { ...d, label: 'Necessary' } : d));
  const barMix = useMemo(() => chartLabels(categoryMix(scanHistory, { days: daysOf(barPeriod) })), [scanHistory, barPeriod]);
  const donutMix = useMemo(() => chartLabels(categoryMix(scanHistory, { days: daysOf(donutPeriod) })), [scanHistory, donutPeriod]);
  const cookies = useMemo(() => recentCookies(scanHistory, 50)
    .filter((c) => (!queries.cookies || lc(c.name).includes(lc(queries.cookies)) || lc(c.website).includes(lc(queries.cookies)))
      && (cookieFilter === 'all' || cookieRisk(c.category) === cookieFilter))
    .slice(0, 5), [scanHistory, queries.cookies, cookieFilter]);
  const activity = useMemo(() => recentActivity(scanHistory, 50)
    .filter((s) => (!queries.activity || lc(s.domain).includes(lc(queries.activity)))
      && (activityFilter === 'all' || (activityFilter === 'deep') === (s.scanType === 'deep')))
    .slice(0, 5), [scanHistory, queries.activity, activityFilter]);
  const autoClassified = useMemo(() => latestPerDomain(scanHistory).reduce((n, scan) => n
    + (scan.fullResults?.cookies || []).filter((c) => c.classificationSource === 'ml_prediction' && c.classificationStatus === 'classified').length, 0), [scanHistory]);
  const pending = useMemo(() => pendingReviews(scanHistory, approvals), [scanHistory, approvals]);
  const shownPending = pending.filter((r) => !queries.pending || lc(r.name).includes(lc(queries.pending)) || lc(r.website).includes(lc(queries.pending)));

  // An approval counts only once it is published (eng R1/R4, E4).
  const approve = async (item) => {
    const category = item.suggestion || item.rule;
    const mark = (state) => setRowState((prev) => ({ ...prev, [item.key]: state }));
    mark('saving');
    try {
      const { published } = await publishCategory({
        scanId: item.scanId, name: item.name, domain: item.domain, oldCategory: item.cookie?.category, newCategory: category,
      });
      if (!published) {
        mark('unpublished');
        toast.warning('Saved, but not published: the database is unavailable.');
        return;
      }
      setApprovals(recordApproval({
        key: item.key, name: item.name, domain: item.domain,
        originalCategory: item.suggestion, approvedCategory: category, confidence: item.confidence,
      }));
      mark(undefined);
      toast.success(`${item.name} approved as ${category}`);
    } catch {
      mark('error');
    }
  };
  const requestApprove = (item) => (item.manualCheck ? setConfirming(item) : approve(item));

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* per-viewer convenience only */ }
  };

  const insights = dismissed ? null : (
    <AiInsights awaitingReview={pending.length} unclassified={kpis.unclassified} autoClassified={autoClassified} onNavigate={onNavigate} onDismiss={dismiss} />
  );

  if (scanHistory.length === 0) {
    return (
      <div className="db-page">
        <div className="db-head"><h2 className="db-head__title">Dashboard</h2></div>
        {insights}
        <section className="db-card db-first-run" aria-labelledby="db-first-run">
          <Radar size={36} className="db-first-run__icon" aria-hidden="true" />
          <h2 id="db-first-run" className="db-card__title">Scan your first website</h2>
          <p className="db-first-run__text">Enter a website to find its cookies. Results, charts and the review queue fill in from your scans.</p>
          <div className="db-first-run__launch">{launchControl}</div>
        </section>
      </div>
    );
  }

  const lastUpdated = scanHistory[0]?.timestamp;

  return (
    <div className="db-page">
      {/* Figma 1:129426: "Dashboard  last Updated <time>" */}
      <div className="db-head">
        <h2 className="db-head__title">Dashboard</h2>
        {lastUpdated && <span className="db-head__updated">{`Last updated ${new Date(lastUpdated).toLocaleString()}`}</span>}
      </div>
      {insights}

      {running && <RunningScan running={running} />}

      <div className="db-kpis">
        <KpiCard label="Website" value={kpis.websites} icon={Globe} badge={{ text: `${kpis.activeThisWeek} Active`, tone: 'necessary' }} />
        <KpiCard label="Cookies" value={kpis.cookies} icon={Cookie} badge={{ text: `${kpis.unclassified} Unclassified`, tone: 'marketing' }} />
        <KpiCard
          label="Risk Score"
          value={kpis.risk ? `${kpis.risk.grade} (${kpis.risk.score})` : null}
          valueTone={kpis.risk && kpis.risk.score < 75 ? 'critical' : undefined}
          icon={ShieldAlert}
          badge={{ text: `${kpis.highRiskWebsites} Critical + High`, tone: 'unclassified' }}
        />
        <KpiCard label="Reviews" value={pending.length} icon={MousePointerClick} badge={{ text: `${pending.filter((r) => r.manualCheck).length} High Priority`, tone: 'necessary' }} />
      </div>
      <p className="db-kpi-note">Risk Score: 100 minus the share of GDPR, CCPA and DPDP risk flags across each website’s latest scan.</p>

      <div className="db-charts">
        <ChartCard id="db-bars" title="Cookies by category" period={barPeriod} onPeriod={setBarPeriod} onExpand={() => setExpanded('bars')}>
          <BarSeries title="Cookie count by category" valueLabel="cookies" categoryLabel="Category" data={barMix} yLabel="Count" xLabel="Cookies" showValues={false} />
        </ChartCard>
        <ChartCard id="db-mix" title="Cookies by category" period={donutPeriod} onPeriod={setDonutPeriod} onExpand={() => setExpanded('donut')}>
          <Donut title="Cookies by category" data={donutMix} layout="stacked" />
        </ChartCard>
      </div>

      <TablePanel
        id="db-recent-cookies" title="Recently Discovered Cookies" seeAllLabel="See all cookies" onSeeAll={() => onNavigate('inventory')}
        searchLabel="Search recent cookies" query={queries.cookies} onQuery={setQuery('cookies')}
        filters={[{ value: 'all', label: 'All risks' }, { value: 'Critical', label: 'Critical' }, { value: 'Low', label: 'Low' }]} filter={cookieFilter} onFilter={setCookieFilter}
      >
        <DataTable
          caption="Recently discovered cookies"
          rowKey={(c) => c.key}
          rows={cookies}
          empty={<p className="db-none">No cookies match.</p>}
          columns={[
            { key: 'name', header: 'Cookie', render: (c) => <span className="db-cookie">{c.name}</span> },
            { key: 'website', header: 'Site' },
            { key: 'category', header: 'Category', render: (c) => <CategoryTag category={c.category} /> },
            { key: 'risk', header: 'Risk', render: (c) => <Chip tone={cookieRisk(c.category) === 'Critical' ? 'unclassified' : 'necessary'} size="sm">{cookieRisk(c.category)}</Chip> },
            { key: 'when', header: 'Discovered', render: (c) => formatScanDate(c.foundAt) },
          ]}
        />
      </TablePanel>

      <TablePanel
        id="db-activity" title="Recent Activity" seeAllLabel="See all scans" onSeeAll={() => onNavigate('history')}
        searchLabel="Search recent activity" query={queries.activity} onQuery={setQuery('activity')}
        filters={[{ value: 'all', label: 'All scans' }, { value: 'quick', label: 'Quick scans' }, { value: 'deep', label: 'Deep scans' }]} filter={activityFilter} onFilter={setActivityFilter}
      >
        <DataTable
          caption="Recent activity"
          rowKey={(s) => s.id}
          rows={activity}
          empty={<p className="db-none">No scans match.</p>}
          columns={[
            {
              key: 'domain',
              header: 'Site',
              render: (s) => (
                <button type="button" className="db-site" onClick={() => onOpenScan(s)} disabled={!s.fullResults}>{s.domain}</button>
              ),
            },
            { key: 'type', header: 'Scan Type', render: (s) => <ScanTypeChip type={s.scanType === 'deep' ? 'deep' : 'quick'} /> },
            { key: 'when', header: 'Discovered', render: (s) => formatScanDate(s.timestamp) },
          ]}
        />
      </TablePanel>

      <TablePanel
        id="db-pending" title="Pending Review Queue" chip={`${pending.length} Items`} seeAllLabel="See all pending reviews" onSeeAll={() => onNavigate('review')}
        searchLabel="Search pending reviews" query={queries.pending} onQuery={setQuery('pending')}
      >
        <DataTable
          caption="Pending review"
          rowKey={(r) => r.key}
          rows={shownPending.slice(0, 5)}
          empty={<p className="db-none">Nothing to review. Every model suggestion has been handled.</p>}
          columns={[
            { key: 'name', header: 'Name', render: (r) => <span className="db-cookie db-cookie--plain">{r.name}</span> },
            {
              key: 'suggestion',
              header: 'Details',
              render: (r) => (
                <span className="db-suggestion">
                  <CategoryTag category={r.suggestion || r.rule} />
                  {r.manualCheck && <Chip tone="marketing" size="sm">Needs manual check</Chip>}
                  {r.suggestion && r.rule !== r.suggestion && <span className="db-note">{`Rule engine: ${r.rule}`}</span>}
                </span>
              ),
            },
            { key: 'confidence', header: 'Chances', render: (r) => (r.confidence == null ? '—' : `${Math.round(r.confidence * 100)}%`) },
            {
              key: 'actions',
              header: 'Action',
              render: (r) => (
                rowState[r.key] === 'unpublished' || rowState[r.key] === 'error' ? (
                  <span className="db-actions">
                    {rowState[r.key] === 'unpublished'
                      ? <Chip tone="marketing" size="sm">Not published</Chip>
                      : <span className="db-row-error">{"Couldn't save."}</span>}
                    <Button size="sm" aria-label={`Retry ${r.name}`} onClick={() => approve(r)}>Retry</Button>
                  </span>
                ) : (
                  <span className="db-actions">
                    <Button variant="success" size="sm" icon={Check} aria-label={`Approve ${r.name}`}
                      disabled={(!r.suggestion && r.rule === 'Unclassified') || rowState[r.key] === 'saving'} onClick={() => requestApprove(r)}>
                      Approve
                    </Button>
                    <Button variant="neutral" size="sm" icon={RotateCcw} aria-label={`Edit ${r.name}`} onClick={() => onNavigate('review')}>Edit</Button>
                  </span>
                )
              ),
            },
          ]}
        />
      </TablePanel>

      <Modal open={Boolean(expanded)} title="Cookies by category" size="lg" onClose={() => setExpanded(null)}>
        {expanded === 'bars' && <BarSeries title="Cookie count by category (expanded)" valueLabel="cookies" categoryLabel="Category" data={barMix} yLabel="Count" xLabel="Cookies" showValues={false} />}
        {expanded === 'donut' && <Donut title="Cookies by category (expanded)" data={donutMix} layout="stacked" />}
      </Modal>

      <Modal
        open={Boolean(confirming)}
        title="Approve without evidence?"
        variant="confirm"
        onClose={() => setConfirming(null)}
        footer={(
          <>
            <Button variant="outline" size="modal" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="success" size="modal" onClick={() => { const item = confirming; setConfirming(null); approve(item); }}>
              {confirming ? `Approve ${confirming.suggestion || confirming.rule}` : 'Approve'}
            </Button>
          </>
        )}
      >
        {confirming && <p className="db-confirm">{manualCheckPrompt(confirming.suggestion || confirming.rule)}</p>}
      </Modal>
    </div>
  );
}

export default DashboardPage;
