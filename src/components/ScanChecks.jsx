// Deep / Schedule Scan "Checks" cards (Figma 12.08.02). Only cookie and
// tracker scanning exists today; the other three are shown, disabled, so the
// pop-up matches the design without pretending to run them.
const CHECKS = [
  { id: 'cookies', title: 'Cookies & Tracker', detail: '3rd party, analytics, marketing', available: true },
  { id: 'pii', title: 'PII Data flows', detail: '3rd party, analytics, marketing' },
  { id: 'consent', title: 'Consent Banner Audit', detail: 'CMP detection & compliance gap' },
  { id: 'sdk', title: 'SDK & Script Inventory', detail: 'All third party script loaded' },
];

function ScanChecks() {
  return (
    <fieldset className="scan-form__fieldset scan-checks" aria-label="Checks">
      <legend className="scan-form__label">Checks<span className="scan-form__req" aria-hidden="true">*</span></legend>
      <div className="scan-checks__grid">
        {CHECKS.map((c) => (
          <label key={c.id} className={`scan-check ${c.available ? 'scan-check--on' : 'scan-check--off'}`}>
            <input type="checkbox" checked={Boolean(c.available)} disabled readOnly />
            <span className="scan-check__text">
              <span className="scan-check__title">{c.title}</span>
              <span className="scan-check__detail">{c.available ? 'Always on' : c.detail}</span>
              {!c.available && <span className="scan-check__soon">Not available yet</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default ScanChecks;
