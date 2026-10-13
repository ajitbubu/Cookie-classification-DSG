import Toast from './Toast';
import './Toast.css';

export default function ToastContainer({ toasts, onDismiss, onPause, onResume, position = 'bottom-right' }) {
  if (toasts.length === 0) return null;

  return (
    <div className={`toast-container toast-container--${position}`} aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} onPause={onPause} onResume={onResume} />
      ))}
    </div>
  );
}
