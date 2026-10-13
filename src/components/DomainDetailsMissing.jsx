import { Globe, RefreshCw, History } from 'lucide-react';
import EmptyState from './ui/EmptyState';
import Button from './ui/Button';
import { ScanTypeChip } from './ui/Chip';
import './DomainDetailsPage.css';

// Domain Details when the routed scan can't be shown (E3, eng R3):
//   unknown: no stored scans for the domain  -> New Scan
//   pruned:  only the summary survives       -> identity row + Scan Now
//   none:    /results with no scan open      -> Scan Results
function DomainDetailsMissing({ status, domain, entry, onNewScan, onScanNow, onOpenResults }) {
  if (status === 'pruned' && entry) {
    const type = entry.scanType === 'deep' ? 'deep' : 'quick';
    return (
      <div className="dd-page">
        <section className="dd-identity" aria-labelledby="dd-missing-domain">
          <div className="dd-identity__main">
            <h2 id="dd-missing-domain" className="dd-identity__domain">{entry.domain}</h2>
            <div className="dd-identity__meta">
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              <ScanTypeChip type={type} variant="pill" />
              <span>{`${(entry.totalCookies ?? 0).toLocaleString()} cookies`}</span>
            </div>
          </div>
          <div className="dd-identity__actions">
            <Button variant="primary" icon={RefreshCw} onClick={() => onScanNow(entry.url || `https://${entry.domain}`, type)}>Scan Now</Button>
          </div>
        </section>
        <section className="dd-card">
          <EmptyState
            icon={History}
            title="Details not stored"
            description="Full details for this scan are no longer stored in this browser."
          />
        </section>
      </div>
    );
  }

  if (status === 'unknown') {
    return (
      <section className="dd-card">
        <EmptyState
          icon={Globe}
          title={`No scans for ${domain}`}
          description="Scan this website to see its cookies, categories and risk here."
          action={{ label: 'New Scan', onClick: onNewScan }}
        />
      </section>
    );
  }

  return (
    <section className="dd-card">
      <EmptyState
        icon={History}
        title="No scan open"
        description="Open a scan from Scan Results to see its domain details."
        action={{ label: 'Open Scan Results', onClick: onOpenResults }}
      />
    </section>
  );
}

export default DomainDetailsMissing;
