import { useEffect, useId, useRef, useState } from 'react';
import { MoreVertical, Check } from 'lucide-react';
import './MenuButton.css';

// Menu-button pattern (plan 4.3, 22A): Enter/Space/ArrowDown opens, arrows move,
// Esc closes and returns focus. Used for row "⋮" menus and the scan-type menu.
function MenuButton({ label, items, children, align = 'end', className }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef(null);
  const wrapRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openAt = (index) => { setActive(index); setOpen(true); };
  const close = () => { setOpen(false); buttonRef.current?.focus(); };

  const onButtonKeyDown = (e) => {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); openAt(0); }
    if (e.key === 'ArrowUp') { e.preventDefault(); openAt(items.length - 1); }
  };

  const onMenuKeyDown = (e) => {
    const last = items.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i === last ? 0 : i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i === 0 ? last : i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(); }
  };

  const select = (item) => { close(); item.onSelect?.(); };

  return (
    <div className="ui-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={[children ? 'ui-menu__button ui-menu__button--text' : 'ui-menu__button', className].filter(Boolean).join(' ')}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : openAt(0))}
        onKeyDown={onButtonKeyDown}
      >
        {children || <MoreVertical size={18} aria-hidden="true" />}
      </button>
      {open && (
        <ul id={menuId} className={`ui-menu__list ui-menu__list--${align}`} role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <li key={item.label} role="none">
              <button
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked === undefined ? undefined : item.checked}
                tabIndex={i === active ? 0 : -1}
                className={`ui-menu__item ${item.tone === 'critical' ? 'ui-menu__item--critical' : ''}`}
                onClick={() => select(item)}
              >
                {item.icon && <item.icon size={16} aria-hidden="true" />}
                {item.label}
                {item.checked && <Check size={16} className="ui-menu__check" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MenuButton;
