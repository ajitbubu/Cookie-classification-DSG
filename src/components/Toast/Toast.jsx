import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Announced through the shared polite live region (plan 4.3), so no role here.
// Hover or focus pauses the auto-dismiss countdown (decision 28A).
export default function Toast({ id, type = 'info', title, message, action, exiting, onDismiss, onPause, onResume }) {
  const Icon = ICONS[type] || Info;
  const pause = () => onPause?.(id);
  const resume = (e) => {
    if (e?.type === 'blur' && e.currentTarget.contains(e.relatedTarget)) return;
    onResume?.(id);
  };

  return (
    <div
      className={`toast toast--${type}${exiting ? ' toast--exiting' : ''}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="toast__icon">
        <Icon size={18} />
      </div>

      <div className="toast__body">
        {title && <p className="toast__title">{title}</p>}
        <p className="toast__message">{message}</p>
      </div>

      <div className="toast__actions">
        {action && (
          <button
            className="toast__action-btn"
            onClick={() => {
              action.onClick?.();
              onDismiss(id);
            }}
          >
            {action.label}
          </button>
        )}
        <button
          className="toast__close"
          onClick={() => onDismiss(id)}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
