import { useEffect, useId, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ScanChecks from './ScanChecks';
import { scanUrlError } from '../lib/scanUrl';
import { nextRunTime, scheduleFromStartDate, utcTimeToLocal } from '../lib/schedule';
import './ScanForm.css';

const PAGE_LIMITS = [20, 50, 100, 500];
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const LOCAL_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'; } catch { return 'Local time'; }
})();

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());

const Req = () => <span className="scan-form__req" aria-hidden="true">*</span>;

// Schedule Scan pop-up (Figma 12.08.27). Produces the job settings the
// scheduler runs on (unit, interval, day, date, time) plus the start date.
// "Homepage only" is a Quick scan; "Key pages" a Deep scan up to the page
// limit. `initial` (an existing job) pre-fills every field for Reschedule;
// a minutes/hourly job keeps its interval as a Frequency option.
function ScheduleScanModal({ open, initialUrl = '', initial = null, title = 'Schedule Scan', submitLabel = 'Schedule Scan', onSchedule, onClose }) {
  const [url, setUrl] = useState(initialUrl);
  const [scope, setScope] = useState('home');
  const [pageLimit, setPageLimit] = useState(20);
  const [startDate, setStartDate] = useState(today);
  const [unit, setUnit] = useState('weekly');
  const [time, setTime] = useState('02:00');
  const [tz, setTz] = useState('local');
  const [error, setError] = useState(null);
  const errorId = useId();
  const ids = { url: useId(), limit: useId(), start: useId(), freq: useId(), time: useId(), tz: useId() };

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUrl(initial?.url ?? initialUrl);
    setTz('local');
    if (initial) {
      setScope(initial.scanType === 'deep' ? 'key' : 'home');
      setPageLimit(initial.maxPages > 1 ? initial.maxPages : 20);
      setUnit(initial.unit || 'weekly');
      setTime(initial.scheduleTime || '02:00');
      setStartDate(initial.startDate || (initial.nextRun ? isoDate(new Date(initial.nextRun)) : today()));
    }
  }, [open, initialUrl, initial]);

  const repeating = unit === 'minutes' || unit === 'hourly';
  const frequencies = repeating
    ? [{ value: unit, label: unit === 'minutes' ? `Every ${initial?.interval || 30} minutes` : `Every ${initial?.interval || 1} hour(s)` }, ...FREQUENCIES]
    : FREQUENCIES;
  const pageLimits = PAGE_LIMITS.includes(pageLimit) ? PAGE_LIMITS : [...PAGE_LIMITS, pageLimit].sort((a, b) => a - b);

  const job = useMemo(() => {
    const { day, date } = scheduleFromStartDate(startDate);
    const localTime = tz === 'UTC' ? utcTimeToLocal(time, startDate) : time;
    return {
      unit,
      interval: repeating ? (initial?.interval || 30) : 1,
      scheduleDay: day || 'sunday',
      scheduleDate: date || 1,
      scheduleTime: localTime || '02:00',
      startDate: startDate || null,
    };
  }, [startDate, tz, time, unit, repeating, initial]);

  const nextRun = useMemo(() => {
    if (!time || (!startDate && !repeating)) return null;
    return nextRunTime(job);
  }, [job, time, startDate, repeating]);

  const submit = (e) => {
    e.preventDefault();
    const problem = scanUrlError(url);
    setError(problem);
    if (problem) return;
    const deep = scope === 'key';
    onSchedule({
      url: url.trim(),
      scanType: deep ? 'deep' : 'quick',
      unit: job.unit,
      interval: job.interval,
      day: job.scheduleDay,
      date: job.scheduleDate,
      time: job.scheduleTime,
      startDate: job.startDate,
      maxPages: deep ? pageLimit : 1,
      maxDepth: initial?.maxDepth > 1 ? initial.maxDepth : 3,
      concurrency: initial?.concurrency > 1 ? initial.concurrency : 20,
    });
  };

  return (
    <Modal
      open={open}
      title={title}
      onBack={onClose}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" size="modal" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="modal" form="schedule-scan-form">{submitLabel}</Button>
        </>
      )}
    >
      <form id="schedule-scan-form" className="scan-form" onSubmit={submit} noValidate>
        <div className="scan-form__intro">
          <h3 className="scan-form__heading">Set up schedule</h3>
          <p className="scan-form__sub">Auto-scan your site and get alerts when issues appear.</p>
        </div>

        <div className="scan-form__field">
          <label htmlFor={ids.url} className="scan-form__label">Website URL</label>
          <input
            id={ids.url}
            type="url"
            className="scan-form__input"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            placeholder="https://example.com"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {error && <p id={errorId} className="scan-form__error">{error}</p>}

        <fieldset className="scan-form__fieldset">
          <legend className="scan-form__label">Scan Scope<Req /></legend>
          <div className="scan-form__options">
            <label className="scan-form__option">
              <input type="radio" name="schedule-scope" checked={scope === 'home'} onChange={() => setScope('home')} />
              Homepage only
            </label>
            <label className="scan-form__option">
              <input type="radio" name="schedule-scope" checked={scope === 'key'} onChange={() => setScope('key')} />
              Key pages
            </label>
          </div>
        </fieldset>

        <div className="scan-form__field">
          <label htmlFor={ids.limit} className="scan-form__label">Page Limit<Req /></label>
          <select id={ids.limit} className="scan-form__input" value={pageLimit} disabled={scope === 'home'} onChange={(e) => setPageLimit(Number(e.target.value))}>
            {pageLimits.map((n) => <option key={n} value={n}>{`${n} pages`}</option>)}
          </select>
        </div>

        <ScanChecks />

        <fieldset className="scan-form__fieldset">
          <legend className="scan-form__heading scan-form__heading--sm">Scheduler</legend>
          <div className="scan-form__grid scan-form__grid--4">
            <div className="scan-form__field">
              <label htmlFor={ids.start} className="scan-form__label">Start Date</label>
              <input id={ids.start} type="date" className="scan-form__input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="scan-form__field">
              <label htmlFor={ids.freq} className="scan-form__label">Frequency</label>
              <select id={ids.freq} className="scan-form__input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="scan-form__field">
              <label htmlFor={ids.time} className="scan-form__label">Run Time</label>
              <input id={ids.time} type="time" className="scan-form__input" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="scan-form__field">
              <label htmlFor={ids.tz} className="scan-form__label">Timezone</label>
              <select id={ids.tz} className="scan-form__input" value={tz} onChange={(e) => setTz(e.target.value)}>
                <option value="local">{LOCAL_TZ}</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </fieldset>

        <p className="scan-form__next">
          <span className="scan-form__next-label">Next Run</span>
          {nextRun ? nextRun.toLocaleString() : 'Choose a start date, time, and frequency.'}
        </p>
      </form>
    </Modal>
  );
}

export default ScheduleScanModal;
