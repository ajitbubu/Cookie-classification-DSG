import { useEffect, useId, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ScanChecks from './ScanChecks';
import { scanUrlError } from '../lib/scanUrl';
import './ScanForm.css';

// Figma "Crawl Mode" and "Crawl Depth" (12.08.02), mapped onto the crawler's
// settings: subdomains on/off, or a single page; depth presets set the page cap.
const CRAWL_MODES = [
  { value: 'internal', label: 'Follow internal links only' },
  { value: 'subdomains', label: 'Follow internal + subdomain links' },
  { value: 'single', label: 'Strict single page check' },
];
const DEPTHS = [
  { value: 20, label: 'Light - Upto 20 pages' },
  { value: 100, label: 'Standard - Upto 100 pages' },
  { value: 500, label: 'Extended - Upto 500 pages' },
  { value: 2000, label: 'Full - Upto 2,000 pages' },
];

const Req = () => <span className="scan-form__req" aria-hidden="true">*</span>;

// Deep Scan pop-up (Figma 12.08.02).
function DeepScanModal({ open, initialUrl = '', defaults, onStart, onClose }) {
  const [url, setUrl] = useState(initialUrl);
  const [mode, setMode] = useState('internal');
  const [depth, setDepth] = useState(100);
  const [error, setError] = useState(null);
  const errorId = useId();
  const urlId = useId();
  const modeId = useId();
  const depthId = useId();

  useEffect(() => {
    if (open) { setUrl(initialUrl); setError(null); }
  }, [open, initialUrl]);

  const submit = (e) => {
    e.preventDefault();
    const problem = scanUrlError(url);
    setError(problem);
    if (problem) return;
    const single = mode === 'single';
    onStart({
      url: url.trim(),
      maxPages: single ? 1 : depth,
      maxDepth: single ? 1 : defaults.maxDepth,
      concurrency: defaults.concurrency,
      includeSubdomains: mode === 'subdomains',
    });
  };

  return (
    <Modal
      open={open}
      title="Deep Scan"
      onBack={onClose}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" size="modal" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="modal" form="deep-scan-form">Start Deep Scan</Button>
        </>
      )}
    >
      <form id="deep-scan-form" className="scan-form" onSubmit={submit} noValidate>
        <div className="scan-form__intro">
          <h3 className="scan-form__heading">Configure deep scan</h3>
          <p className="scan-form__sub">Full crawl with detailed cookie, tracker &amp; consent analysis.</p>
        </div>

        <div className="scan-form__field">
          <label htmlFor={urlId} className="scan-form__label">Website URL<Req /></label>
          <input
            id={urlId}
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

        <div className="scan-form__field">
          <label htmlFor={modeId} className="scan-form__label">Crawl Mode<Req /></label>
          <select id={modeId} className="scan-form__input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {CRAWL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="scan-form__field">
          <label htmlFor={depthId} className="scan-form__label">Crawl Depth<Req /></label>
          <select id={depthId} className="scan-form__input" value={depth} disabled={mode === 'single'} onChange={(e) => setDepth(Number(e.target.value))}>
            {DEPTHS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <ScanChecks />
      </form>
    </Modal>
  );
}

export default DeepScanModal;
