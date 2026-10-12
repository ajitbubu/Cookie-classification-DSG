import { useId, useState } from 'react';
import Button from './ui/Button';
import { Zap, Layers, Clock, Play, RefreshCw, ChevronDown } from 'lucide-react';
import MenuButton from './ui/MenuButton';
import { scanUrlError } from '../lib/scanUrl';
import './LaunchScan.css';

// Launch New Scan control (decision 27C, Figma 1:189760): URL field, scan type
// menu, Start Scan. Enter starts a Quick scan; Deep and Schedule open their
// modals with the URL pre-filled. An empty URL keeps today's Quick scan of
// this page.
function LaunchScan({ value, onChange, onQuickScan, onDeepScan, onScheduleScan, scanning = false, inputRef }) {
  const [error, setError] = useState(null);
  const inputId = useId();
  const errorId = useId();

  const startQuick = () => {
    if (scanning) return;
    const text = value.trim();
    const problem = text ? scanUrlError(text) : null;
    setError(problem);
    if (!problem) onQuickScan(text);
  };

  return (
    <div className="launch-scan">
      <div className="launch-scan__row">
        {/* Figma 1:190494: URL and scan type share one field */}
        <div className={`launch-scan__box ${error ? 'launch-scan__box--error' : ''}`}>
          <label htmlFor={inputId} className="sr-only">Website URL</label>
          <input
            id={inputId}
            ref={inputRef}
            type="url"
            inputMode="url"
            className="launch-scan__input"
            placeholder="www.example.com"
            value={value}
            onChange={(e) => { onChange(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startQuick(); } }}
            disabled={scanning}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <span className="launch-scan__divider" aria-hidden="true" />
          <MenuButton
            label="Scan type: Quick"
            align="end"
            items={[
              { label: 'Quick Scan', icon: Zap, onSelect: () => {} },
              { label: 'Deep Scan…', icon: Layers, onSelect: () => onDeepScan(value.trim()) },
              { label: 'Schedule Scan…', icon: Clock, onSelect: () => onScheduleScan(value.trim()) },
            ]}
          >
            <Zap size={20} aria-hidden="true" />
            <span className="launch-scan__type">Quick Scan</span>
            <ChevronDown size={18} aria-hidden="true" />
          </MenuButton>
        </div>

        <Button variant="success" icon={scanning ? RefreshCw : Play} className="launch-scan__start" onClick={startQuick} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Start Scan'}
        </Button>
      </div>

      {error ? (
        <p id={errorId} className="launch-scan__error">{error}</p>
      ) : (
        !value.trim() && !scanning && (
          <p className="launch-scan__hint">Leave the URL empty to Quick scan this page ({window.location.hostname}).</p>
        )
      )}
    </div>
  );
}

export default LaunchScan;
