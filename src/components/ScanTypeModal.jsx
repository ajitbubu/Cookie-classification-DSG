import { useEffect, useId, useState } from 'react';
import { Zap, ScanLine, Calendar } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { Chip } from './ui/Chip';
import { scanUrlError } from '../lib/scanUrl';
import './ScanForm.css';
import './ScanTypeModal.css';

const TYPES = [
  { value: 'quick', label: 'Quick Scan', detail: 'Home Page + Key Pages, Results in ~1 Min', icon: Zap, badge: 'Fast', tone: 'advertising' },
  { value: 'deep', label: 'Deep Scan', detail: 'Full crawl with cookie and tracker analysis', icon: ScanLine, badge: 'Thorough', tone: 'necessary' },
  { value: 'schedule', label: 'Schedule Scan', detail: 'Recurring auto scans on your timeline', icon: Calendar, badge: 'Auto', tone: 'marketing' },
];

// New Scan pop-up (Figma 12.07.06): pick a scan type card. Quick Scan opens
// its URL field here and runs from the pop-up; Deep and Schedule continue to
// their own pop-ups.
function ScanTypeModal({ open, initialUrl = '', onClose, onContinue, onQuickScan }) {
  const [type, setType] = useState(null);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState(null);
  const name = useId();
  const headingId = useId();
  const urlId = useId();
  const errorId = useId();

  useEffect(() => {
    if (open) { setType(null); setUrl(initialUrl); setError(null); }
  }, [open, initialUrl]);

  const runQuick = (e) => {
    e.preventDefault();
    const problem = scanUrlError(url);
    setError(problem);
    if (!problem) onQuickScan(url.trim());
  };

  return (
    <Modal
      open={open}
      title="Launch New Scan"
      size="lg"
      onClose={onClose}
      footer={type === 'quick' ? null : (
        <>
          <Button variant="outline" size="modal" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="modal" disabled={!type} onClick={() => onContinue(type)}>Continue</Button>
        </>
      )}
    >
      <div className="scan-form__intro">
        <h3 id={headingId} className="scan-form__heading">Launch New Scan</h3>
        <p className="scan-form__sub">Pick the right scan for your use case.</p>
      </div>
      <div className="scan-type" role="radiogroup" aria-labelledby={headingId}>
        {TYPES.map((t) => (
          <label key={t.value} className={`scan-type__card${type === t.value ? ' scan-type__card--checked' : ''}`}>
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
            />
            <span className="scan-type__top">
              <t.icon size={24} aria-hidden="true" />
              <Chip tone={t.tone} size="sm">{t.badge}</Chip>
            </span>
            <span className="scan-type__label">{t.label}</span>
            <span className="scan-type__detail">{t.detail}</span>
          </label>
        ))}
      </div>

      {type === 'quick' && (
        <form className="scan-type__quick" onSubmit={runQuick} noValidate>
          <div className="scan-type__quick-head">
            <Zap size={24} aria-hidden="true" />
            <span>
              <label htmlFor={urlId} className="scan-type__label">Quick Scan URL</label>
              <span className="scan-type__detail">Home Page + Key Pages, Results in ~1 Min</span>
            </span>
          </div>
          <div className="scan-type__quick-row">
            <input
              id={urlId}
              type="url"
              className="scan-form__input"
              value={url}
              placeholder="https://www.example.com"
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
            <Button type="submit" variant="primary">Run Quick Scan</Button>
          </div>
          {error && <p id={errorId} className="scan-form__error scan-type__error">{error}</p>}
        </form>
      )}
    </Modal>
  );
}

export default ScanTypeModal;
