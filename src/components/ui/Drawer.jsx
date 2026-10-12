import { useId } from 'react';
import { X } from 'lucide-react';
import { useDialog } from './useDialog';
import './Drawer.css';

// Right-hand drawer (Figma "Bulk Update Cookie Type"); same dialog rules as Modal.
function Drawer({ open, title, onClose, children, footer }) {
  const panelRef = useDialog(open, onClose);
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="ui-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside
        ref={panelRef}
        className="ui-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="ui-drawer__header">
          <h2 id={titleId} className="ui-drawer__title">{title}</h2>
          <button type="button" className="ui-drawer__close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="ui-drawer__body">{children}</div>
        {footer && <div className="ui-drawer__footer">{footer}</div>}
      </aside>
    </div>
  );
}

export default Drawer;
