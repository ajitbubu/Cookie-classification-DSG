import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast({ id, type = 'info', title, message, action, exiting, onDismiss }) {
  const Icon = ICONS[type] || Info;

  return (
    <div
      className={`toast toast--${type}${exiting ? ' toast--exiting' : ''}`}
      role="alert"
      aria-live="polite"
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
