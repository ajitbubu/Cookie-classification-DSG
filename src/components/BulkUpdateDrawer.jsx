import { useEffect, useState } from 'react';
import { Cookie, Edit } from 'lucide-react';
import Button from './ui/Button';
import Drawer from './ui/Drawer';
import { BULK_CATEGORIES, cookieKey } from '../lib/domainDetails';
import './BulkUpdateDrawer.css';

// "Bulk Update Cookie Type" drawer (Figma 12.13.08): the selected cookies,
// each with a category picker that starts on the category chosen in the
// selection bar. Confirm sends only the cookies that changed.
function BulkUpdateDrawer({ open, cookies = [], initialCategory, onConfirm, onClose }) {
  const [choices, setChoices] = useState({});

  useEffect(() => {
    if (open) {
      setChoices(Object.fromEntries(cookies.map((c) => [
        cookieKey(c),
        initialCategory || (BULK_CATEGORIES.includes(c.category) ? c.category : 'Unclassified'),
      ])));
    }
  }, [open, cookies, initialCategory]);

  const changes = Object.fromEntries(
    cookies.filter((c) => choices[cookieKey(c)] && choices[cookieKey(c)] !== c.category).map((c) => [cookieKey(c), choices[cookieKey(c)]])
  );
  const count = Object.keys(changes).length;

  return (
    <Drawer
      open={open}
      title="Bulk Update Cookie Type"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" size="modal" className="bud-cancel" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="modal" disabled={count === 0} onClick={() => onConfirm(changes)}>Confirm</Button>
        </>
      )}
    >
      <div className="bud-intro">
        <span className="bud-intro__icon" aria-hidden="true"><Edit size={22} /></span>
        <p className="bud-intro__text">You’re about to update the cookie type for selected cookies. This action will apply all selected entries.</p>
      </div>

      <p className="bud-count">{`${cookies.length} Selected!`}</p>
      <ul className="bud-list">
        {cookies.map((c) => (
          <li key={cookieKey(c)} className="bud-row">
            <span className="bud-avatar" aria-hidden="true"><Cookie size={18} /></span>
            <div className="bud-cookie">
              <span className="bud-name">{c.name}</span>
              <span className="bud-domain">{c.domain}</span>
            </div>
            <select
              className="bud-select"
              aria-label={`Category for ${c.name}`}
              value={choices[cookieKey(c)] || 'Unclassified'}
              onChange={(e) => setChoices((prev) => ({ ...prev, [cookieKey(c)]: e.target.value }))}
            >
              {BULK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

export default BulkUpdateDrawer;
