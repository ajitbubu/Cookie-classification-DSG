import Button from './Button';
import './EmptyState.css';

// Empty state (decision 6A): what belongs here and the one action that fills it.
function EmptyState({ icon: Icon, title, description, action, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className="ui-empty">
      {Icon && <Icon size={32} aria-hidden="true" className="ui-empty__icon" />}
      <Heading className="ui-empty__title">{title}</Heading>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && (
        <Button variant="primary" className="ui-empty__action" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

export default EmptyState;
