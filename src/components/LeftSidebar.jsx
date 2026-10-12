import { useState } from 'react';
import {
  LayoutDashboard, HeartHandshake, Cookie, FileCheck, FileSearch, Lock, CloudRain, Laptop,
  ClipboardList, Layers, Settings, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react';
import pkg from '../../package.json';
import { COOKIE_PAGES, navPageFor } from '../lib/routes';
import './LeftSidebar.css';

// Full product menu from Figma (1:189760). Only Cookie Classification and
// Settings > ML Model exist in this app; the other modules are shown as in
// Figma but disabled, so nothing links to an empty page.
const MODULES_BEFORE = [
  { id: 'dashboard', label: 'Dashboard', name: 'Platform dashboard', icon: LayoutDashboard, chevron: true },
  { id: 'ucm', label: 'UCM', icon: HeartHandshake, chevron: true },
];
const MODULES_AFTER = [
  { id: 'pia', label: 'PIA', icon: FileCheck, chevron: true },
  { id: 'cdd', label: 'CDD', icon: FileSearch, chevron: true },
  { id: 'dsar', label: 'DSAR', icon: Lock, chevron: true },
  { id: 'cdr', label: 'CDR', icon: CloudRain, chevron: true },
  { id: 'dpm', label: 'DPM', icon: Laptop, chevron: true },
  { id: 'audit', label: 'Compliance Audit', icon: ClipboardList, chevron: true },
  { id: 'org', label: 'Organization', icon: Layers },
];

function DisabledModule({ module }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="left-sidebar-row left-sidebar-row--disabled"
      aria-disabled="true"
      aria-label={module.name || module.label}
      title="Not available in this app"
    >
      <module.icon size={18} className="left-sidebar-icon" aria-hidden="true" />
      <span className="left-sidebar-label">{module.label}</span>
      {module.chevron && <ChevronDown size={18} className="left-sidebar-chevron" aria-hidden="true" />}
    </button>
  );
}

function LeftSidebar({ onNavigate, currentPage, mobileOpen = false, onMobileClose }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navPage = navPageFor(currentPage);
  const showSettings = settingsOpen || currentPage === 'model';

  const go = (page) => {
    onNavigate?.(page);
    onMobileClose?.();
  };

  const subItem = (page, label) => {
    const active = navPage === page;
    return (
      <button
        key={page}
        type="button"
        role="menuitem"
        className={`left-sidebar-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => go(page)}
      >
        <span className="left-sidebar-label">{label}</span>
      </button>
    );
  };

  return (
    <>
      <div
        className={`left-sidebar-backdrop ${mobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <nav
        className={`left-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="left-sidebar-inner">
          <div className="left-sidebar-brand">
            <span className="left-sidebar-logo" role="img" aria-label="datasafeguard — Privacy Management">
              <span className="left-sidebar-logo__word" aria-hidden="true">
                <span className="left-sidebar-logo__accent">data</span>safeguard
              </span>
              <span className="left-sidebar-logo__tag" aria-hidden="true">Privacy Management</span>
            </span>
            <ShieldCheck size={24} strokeWidth={1.5} className="left-sidebar-logo-mark" aria-hidden="true" />
          </div>

          <div className="left-sidebar-nav" role="menu" aria-label="Modules" aria-orientation="vertical">
            {MODULES_BEFORE.map((m) => <DisabledModule key={m.id} module={m} />)}

            <div className="left-sidebar-module" role="group" aria-labelledby="module-cookies">
              <div id="module-cookies" className="left-sidebar-row left-sidebar-row--header">
                <Cookie size={20} className="left-sidebar-icon" aria-hidden="true" />
                <span className="left-sidebar-label">Cookie Classification</span>
                <ChevronUp size={18} className="left-sidebar-chevron" aria-hidden="true" />
              </div>
              {COOKIE_PAGES.map(({ page, label }) => subItem(page, label))}
            </div>

            {MODULES_AFTER.map((m) => <DisabledModule key={m.id} module={m} />)}

            <div className="left-sidebar-module" role="group" aria-label="Settings">
              <button
                type="button"
                role="menuitem"
                className="left-sidebar-row"
                aria-expanded={showSettings}
                onClick={() => setSettingsOpen((v) => !v)}
              >
                <Settings size={18} className="left-sidebar-icon" aria-hidden="true" />
                <span className="left-sidebar-label">Settings</span>
                {showSettings
                  ? <ChevronUp size={18} className="left-sidebar-chevron" aria-hidden="true" />
                  : <ChevronDown size={18} className="left-sidebar-chevron" aria-hidden="true" />}
              </button>
              {showSettings && subItem('model', 'ML Model')}
            </div>
          </div>

          <div className="left-sidebar-footer">
            <span className="left-sidebar-label">Version {pkg.version}</span>
            <span className="left-sidebar-label">Powered By CCE®</span>
          </div>
        </div>
      </nav>
    </>
  );
}

export default LeftSidebar;
