import { useState } from 'react';
import './charts.css';

// Category colours from the Figma donut. The legend and the hidden table carry
// the numbers, so meaning never depends on colour alone.
const CATEGORY_COLORS = {
  // Figma 12.06.45 donut series; Advertising is not in the frame, so it keeps
  // the design system's indigo.
  'Strictly Necessary': 'var(--ucm-chart-necessary)',
  Necessary: 'var(--ucm-chart-necessary)',
  Functional: 'var(--ucm-chart-functional)',
  Analytics: 'var(--ucm-chart-analytics)',
  Marketing: 'var(--ucm-chart-marketing)',
  Advertising: 'var(--ucm-indigo)',
  Unclassified: 'var(--ucm-chart-unclassified)',
};
const colorFor = (label) => CATEGORY_COLORS[label] || 'var(--ucm-icon-muted)';

const R = 70;
const CIRC = 2 * Math.PI * R;

function Donut({ title, data = [], layout = 'side' }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  if (total === 0) return <p className="chart-empty">No cookies recorded yet</p>;

  let offset = 0;
  const segments = data.map((d) => {
    const length = (d.value / total) * CIRC;
    const seg = { ...d, length, offset };
    offset += length;
    return seg;
  });

  return (
    <div className={`chart chart-donut${layout === 'stacked' ? ' chart-donut--stacked' : ''}`}>
      <div className="chart-donut__figure">
        <svg viewBox="0 0 180 180" aria-hidden="true" focusable="false">
          <g transform="rotate(-90 90 90)">
            {segments.map((s) => (
              <circle
                key={s.label}
                className="chart-donut__segment"
                cx="90" cy="90" r={R}
                fill="none"
                stroke={colorFor(s.label)}
                strokeWidth={hover === s.label ? 26 : 22}
                strokeDasharray={`${Math.max(s.length - 1.5, 0)} ${CIRC}`}
                strokeDashoffset={-s.offset}
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        <div className="chart-donut__center" aria-hidden="true">
          <span className="chart-donut__total">{total.toLocaleString()}</span>
          <span className="chart-donut__caption">cookies</span>
        </div>
        {hover && (
          <div className="chart-tooltip" aria-hidden="true">
            {`${hover}: ${data.find((d) => d.label === hover).value} (${pct(data.find((d) => d.label === hover).value)}%)`}
          </div>
        )}
      </div>

      <ul className="chart-legend" aria-hidden="true">
        {data.map((d) => (
          <li key={d.label} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: colorFor(d.label) }} />
            <span className="chart-legend__label">{d.label}</span>
            <span className="chart-legend__value">{d.value}</span>
          </li>
        ))}
      </ul>

      <table className="chart-sr-table">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Cookies</th><th scope="col">Share</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th scope="row">{d.label}</th><td>{d.value}</td><td>{`${pct(d.value)}%`}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Donut;
