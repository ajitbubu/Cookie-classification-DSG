import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from './ToastContainer';
import { useAnnounce } from '../ui/LiveRegion';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children, position = 'bottom-right', maxToasts = 5 }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});
  // Remaining time per toast, so hover/focus can pause the countdown (28A).
  const deadlinesRef = useRef({});
  const announce = useAnnounce();

  const removeToast = useCallback((id) => {
    // Mark as exiting for animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    // Remove after exit animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
      delete deadlinesRef.current[id];
    }, 300);
  }, []);

  const addToast = useCallback(
    ({ type = 'info', title, message, duration = 5000, action }) => {
      const id = ++toastId;

      setToasts((prev) => {
        const updated = [...prev, { id, type, title, message, action, exiting: false }];
        // Trim to maxToasts — oldest first
        if (updated.length > maxToasts) {
          const excess = updated.slice(0, updated.length - maxToasts);
          excess.forEach((t) => removeToast(t.id));
        }
        return updated;
      });

      if (duration > 0) {
        deadlinesRef.current[id] = { remaining: duration, startedAt: Date.now() };
        timersRef.current[id] = setTimeout(() => removeToast(id), duration);
      }

      announce([title, message].filter(Boolean).join('. '));
      return id;
    },
    [maxToasts, removeToast, announce]
  );

  const pauseToast = useCallback((id) => {
    const deadline = deadlinesRef.current[id];
    if (!deadline || !timersRef.current[id]) return;
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    deadline.remaining -= Date.now() - deadline.startedAt;
  }, []);

  const resumeToast = useCallback((id) => {
    const deadline = deadlinesRef.current[id];
    if (!deadline || timersRef.current[id]) return;
    deadline.startedAt = Date.now();
    timersRef.current[id] = setTimeout(() => removeToast(id), Math.max(deadline.remaining, 0));
  }, [removeToast]);

  const toast = useCallback(
    (messageOrOpts) => {
      if (typeof messageOrOpts === 'string') {
        return addToast({ message: messageOrOpts });
      }
      return addToast(messageOrOpts);
    },
    [addToast]
  );

  // Convenience methods
  toast.success = (message, opts) => addToast({ type: 'success', message, ...opts });
  toast.error = (message, opts) => addToast({ type: 'error', message, ...opts });
  toast.warning = (message, opts) => addToast({ type: 'warning', message, ...opts });
  toast.info = (message, opts) => addToast({ type: 'info', message, ...opts });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} onPause={pauseToast} onResume={resumeToast} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}
