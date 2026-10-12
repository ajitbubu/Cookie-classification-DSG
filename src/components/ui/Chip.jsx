import { Zap, ScanLine, Calendar } from 'lucide-react';
import './Chip.css';

// UCM design system tags (soft, 24px) and scan-type pills (solid, 32px).
// Tones are the design system's tag names; colours live in Chip.css.
export function Chip({ tone = 'neutral', size = 'md', solid = false, children }) {
  return <span className={`ui-chip ui-chip--${tone}${size === 'sm' ? ' ui-chip--sm' : ''}${solid ? ' ui-chip--solid' : ''}`}>{children}</span>;
}

const STATUS = {
  completed: { tone: 'necessary', label: 'Completed' },
  running: { tone: 'analytics', label: 'Running' },
  scheduled: { tone: 'marketing', label: 'Scheduled' },
  paused: { tone: 'neutral', label: 'Paused' },
  partial: { tone: 'unclassified', label: 'Partial' }, // Figma: red
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  failed: { tone: 'unclassified', label: 'Failed' },
};

export function StatusChip({ status, failed }) {
  const { tone, label } = STATUS[status] || STATUS.completed;
  const text = status === 'partial' && failed ? `${label} (${failed} Failed)` : label;
  return <Chip tone={tone} size="sm">{text}</Chip>;
}

// Tables say Quick / Deep / Scheduled; pills say Quick scan / Deep scan / Schedule scan.
const SCAN_TYPES = {
  quick: { tone: 'analytics', tag: 'Quick', pill: 'Quick scan', icon: Zap },
  deep: { tone: 'advertising', tag: 'Deep', pill: 'Deep scan', icon: ScanLine },
  schedule: { tone: 'marketing', tag: 'Scheduled', pill: 'Schedule scan', icon: Calendar },
};

export function ScanTypeChip({ type, variant = 'tag' }) {
  const t = SCAN_TYPES[type] || SCAN_TYPES.quick;
  const key = SCAN_TYPES[type] ? type : 'quick';
  if (variant === 'pill') {
    return (
      <span className={`ui-pill ui-pill--${key}`}>
        <t.icon size={16} aria-hidden="true" />
        <span>{t.pill}</span>
      </span>
    );
  }
  return <Chip tone={t.tone} size="sm">{t.tag}</Chip>;
}

const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);
const CATEGORY_TONES = {
  'Strictly Necessary': 'necessary',
  Necessary: 'necessary',
  Analytics: 'analytics',
  Marketing: 'marketing',
  Advertising: 'advertising',
  Unclassified: 'unclassified',
};

// Figma's chip labels: "Strictly Necessary" reads "Necessary".
const LABELS = { 'Strictly Necessary': 'Necessary' };

// Cookie category tag: soft by default, solid in the Domain Details tables
// (Figma 12.12.39). Functional and Social Media have no UCM tag colour, so
// they use the neutral chip (DESIGN.md "Colour").
export function CategoryTag({ category, solid = false }) {
  const label = !category || UNPUBLISHED.has(category) ? 'Unclassified' : category;
  return <Chip tone={CATEGORY_TONES[label] || 'neutral'} solid={solid}>{LABELS[label] || label}</Chip>;
}

export default Chip;
