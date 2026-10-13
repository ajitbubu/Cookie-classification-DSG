import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import './PanelError.css';

// Error inside the panel that failed (decision 8A): what failed + Retry.
function PanelError({ message, onRetry }) {
  return (
    <div className="ui-panel-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" className="ui-panel-error__icon" />
      <span className="ui-panel-error__text">{message}</span>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry}>Retry</Button>
      )}
    </div>
  );
}

export default PanelError;
