import { createContext, useCallback, useContext, useState } from 'react';
import './LiveRegion.css';

const AnnounceContext = createContext(() => {});

// One polite live region for the whole app (plan 4.3): selection counts,
// scan completion and toasts all announce through it.
export function LiveRegionProvider({ children }) {
  const [message, setMessage] = useState('');

  // A repeated message differs by a trailing no-break space so it is re-read.
  const announce = useCallback((text) => {
    setMessage((prev) => (prev === text ? `${text}\u00A0` : text));
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="ui-live-region" role="status" aria-live="polite" aria-atomic="true">{message}</div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce() {
  return useContext(AnnounceContext);
}
