import './Button.css';

// UCM design system buttons (.ucm-btn): page actions 40px / 8px radius,
// modal footers 120x44 / 4px radius, sm 36px.
function Button({ variant = 'neutral', size = 'md', icon: Icon, className = '', type = 'button', children, ...rest }) {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    size !== 'md' && `ui-btn--${size}`,
    Icon && 'ui-btn--icon-lead',
    className,
  ].filter(Boolean).join(' ');
  return (
    // eslint-disable-next-line react/button-has-type -- type defaults to "button" and may be "submit"
    <button type={type} className={classes} {...rest}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}

export default Button;
