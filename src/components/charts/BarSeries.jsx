import { useState } from 'react';
import './charts.css';

const H = 100; // bar area height in viewBox units

// A round axis maximum and ~5 ticks: 0, 100, 200 … (Figma 12.06.32 y-axis).
export function niceTicks(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((m) => m >= raw);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

function BarSeries({ title, data = [], valueLabel, categoryLabel = 'Day', yLabel, xLabel, showValues = true }) {
  const [hover, setHover] = useState(null);
  const ticks = yLabel ? niceTicks(Math.max(0, ...data.map((d) => d.value))) : null;
  const max = ticks ? ticks[ticks.length - 1] : Math.max(1, ...data.map((d) => d.value));
  const slot = 100 / Math.max(data.length, 1);
  const barW = slot * 0.56;

  return (
    <div className={`chart chart-bars${yLabel ? ' chart-bars--axes' : ''}`}>
      {yLabel && <span className="chart-bars__ylabel" aria-hidden="true">{yLabel}</span>}
      {ticks && (
        <div className="chart-bars__yticks" aria-hidden="true">
          {[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}
        </div>
      )}
      <div className="chart-bars__figure">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" className="chart-bars__svg">
          {data.map((d, i) => {
            const height = (d.value / max) * H;
            const x = i * slot + (slot - barW) / 2;
            return (
              <g key={d.label}>
                <rect className="chart-bars__bar" x={x} y={H - height} width={barW} height={height} rx="1.5"
                  fill={hover === i ? 'var(--ucm-btn-primary)' : 'var(--ucm-chart-5)'} />
                <rect className="chart-bars__hit" x={i * slot} y="0" width={slot} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="chart-tooltip" aria-hidden="true">{`${data[hover].label}: ${data[hover].value} ${valueLabel}`}</div>
        )}
      </div>
      <div className="chart-bars__axis" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label} className="chart-bars__tick">
            {showValues && <span className="chart-bars__value">{d.value}</span>}
            <span className="chart-bars__label">{d.label}</span>
          </span>
        ))}
      </div>

      {xLabel && <span className="chart-bars__xlabel" aria-hidden="true">{xLabel}</span>}

      <table className="chart-sr-table">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{categoryLabel}</th><th scope="col">{valueLabel}</th></tr></thead>
        <tbody>
          {data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{d.value}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default BarSeries;
