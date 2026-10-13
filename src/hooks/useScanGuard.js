import { useEffect } from 'react';
import { clearActiveScan, markScanStarted } from '../lib/scanStorage';

// While a scan runs: record its start (so a refresh can offer Rescan) and ask
// the browser to confirm before leaving. Both are undone when it ends (E5).
// Clearing only happens on a running -> stopped transition, so a leftover
// record from a previous session survives first load until App has read it.
export function useScanGuard(scanning, activeScan) {
  useEffect(() => {
    if (!scanning || !activeScan?.url) return undefined;
    markScanStarted(activeScan);
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearActiveScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when a scan starts or stops
  }, [scanning]);
}
