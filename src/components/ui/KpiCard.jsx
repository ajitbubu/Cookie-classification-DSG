import { TrendingUp, TrendingDown } from 'lucide-react';
import Button from './Button';
import { Chip } from './Chip';
import './KpiCard.css';

// UCM stat card (.ucm-stat). An unknown value renders "—", never a stale
// number (decision 8A). trend: { text, direction: 'up' | 'down' }; badge: { text, tone }
// for the Dashboard status chips (Figma 12.06.32).
function KpiCard({ label, value, icon: Icon, trend, action, caption, valueTone, badge }) {
  const shown = value === null || value === undefined ? '—' : value;
  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;
  return (
    <div className="ui-kpi">
      <div className="ui-kpi__top">
        {Icon ? <span className="ui-kpi__icon"><Icon size={18} aria-hidden="true" /></span> : <span />}
        {badge && <Chip tone={badge.tone} size="sm">{badge.text}</Chip>}
        {trend && (
          <span className={`ui-kpi__trend ui-kpi__trend--${trend.direction === 'down' ? 'down' : 'up'}`}>
            {trend.direction && <TrendIcon size={16} aria-hidden="true" />}
            {trend.text}
          </span>
        )}
      </div>
      <div className="ui-kpi__body">
        <span className="ui-kpi__label">{label}</span>
        <div className="ui-kpi__value-row">
          <span className={`ui-kpi__value${valueTone ? ` ui-kpi__value--${valueTone}` : ''}`}>{typeof shown === 'number' ? shown.toLocaleString() : shown}</span>
          {action && <Button variant={action.variant || 'outline'} size="sm" className="ui-kpi__action" onClick={action.onClick}>{action.label}</Button>}
        </div>
        {caption && <span className="ui-kpi__caption">{caption}</span>}
      </div>
    </div>
  );
}

export default KpiCard;
