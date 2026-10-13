import { useId } from 'react';
import { X, HelpCircle, CheckCircle, ChevronLeft } from 'lucide-react';
import { useDialog } from './useDialog';
import './Modal.css';

// UCM form modal (.ucm-modal, 798px) and confirm dialog (.ucm-confirm, 400px).
// variant="confirm" centres an icon tile above the title; tone="success" makes
// the tile green (e.g. "Ready to Publish?"). onBack adds the Figma back arrow.
function Modal({ open, title, onClose, onBack, children, footer, size = 'md', variant = 'form', tone = 'accent', icon }) {
  const panelRef = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;
  const confirm = variant === 'confirm';
  const Icon = icon || (tone === 'success' ? CheckCircle : HelpCircle);

  return (
    <div className="ui-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={panelRef}
        className={`ui-modal ${confirm ? 'ui-modal--confirm' : `ui-modal--${size}`}`}
        role={confirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="ui-modal__header">
          {confirm && (
            <span className={`ui-modal__icon ui-modal__icon--${tone}`} aria-hidden="true"><Icon size={28} /></span>
          )}
          {onBack && (
            <button type="button" className="ui-modal__back" aria-label="Back" onClick={onBack}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          )}
          <h2 id={titleId} className="ui-modal__title">{title}</h2>
          <button type="button" className="ui-modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className={`ui-modal__footer${confirm ? ' ui-modal__footer--equal' : ''}`}>{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
