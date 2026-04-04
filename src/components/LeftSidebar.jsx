import { useState } from 'react';
import {
  Home, Search, History, Shield,
  Settings, ChevronLeft, ChevronRight, Cookie,
  BarChart3, BookOpen, GitCompare, FileText, ClipboardCheck, Globe, Send, Clock, Brain
} from 'lucide-react';
import './LeftSidebar.css';

const navItems = [
  { id: 'home', icon: Home, label: 'Home', section: 'kpi-strip', page: 'home' },
  { id: 'scan', icon: Search, label: 'Scanner', section: 'scan-controls-compact', page: 'home' },
  { id: 'results', icon: BarChart3, label: 'Results', section: 'results-header', page: 'home' },
  { id: 'compliance', icon: Shield, label: 'Compliance', section: 'audit-data-section', page: 'home' },
  { id: 'divider-1', type: 'divider' },
  { id: 'history', icon: History, label: 'Scan History', page: 'history' },
  { id: 'compare', icon: GitCompare, label: 'Compare Scans', page: 'compare' },
  { id: 'divider-2', type: 'divider' },
  { id: 'reports', icon: FileText, label: 'Reports', page: 'reports' },
  { id: 'review', icon: ClipboardCheck, label: 'Review Queue', page: 'review' },
  { id: 'vendors', icon: Globe, label: 'Vendors', page: 'vendors' },
  { id: 'publish', icon: Send, label: 'Auto-Publish', page: 'publish' },
  { id: 'scheduled', icon: Clock, label: 'Scheduled Scans', page: 'scheduled' },
  { id: 'websites', icon: Globe, label: 'My Websites', page: 'websites' },
  { id: 'model', icon: Brain, label: 'ML Model', page: 'model' },
  { id: 'divider-3', type: 'divider' },
  { id: 'docs', icon: BookOpen, label: 'Documentation', href: '#docs' },
];

function LeftSidebar({ onPinnedChange, onNavigate, currentPage }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);

  const expanded = pinned || hovered;

  const handleNavClick = (item) => {
    if (item.href) {
      window.location.hash = item.href;
      return;
    }

    // If the item targets a different page, navigate to it
    if (item.page && item.page !== 'home') {
      onNavigate?.(item.page);
      return;
    }

    // If the item targets a section on the home page
    if (item.page === 'home' && item.section) {
      const scrollToSection = () => {
        const el = document.getElementById(item.section) || document.querySelector(`.${item.section}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (currentPage !== 'home') {
        onNavigate?.('home');
        setTimeout(scrollToSection, 150);
      } else {
        scrollToSection();
      }
    }
  };

  const isActive = (item) => {
    if (item.page && item.page !== 'home') {
      return currentPage === item.page;
    }
    if (item.page === 'home' && currentPage === 'home') {
      return item.id === 'home';
    }
    return false;
  };

  return (
    <nav
      className={`left-sidebar ${expanded ? 'expanded' : 'collapsed'} ${pinned ? 'pinned' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Main navigation"
    >
      <div className="left-sidebar-inner">
        <div className="left-sidebar-brand">
          <Cookie size={22} className="left-sidebar-logo" />
          {expanded && <span className="left-sidebar-brand-text">DataSafeGuard</span>}
        </div>

        <ul className="left-sidebar-nav" role="menubar">
          {navItems.map((item) => {
            if (item.type === 'divider') {
              return (
                <li key={item.id} className="left-sidebar-divider" role="separator">
                  {expanded && <span className="left-sidebar-divider-line" />}
                </li>
              );
            }

            return (
              <li key={item.id} role="none">
                <button
                  className={`left-sidebar-item ${isActive(item) ? 'active' : ''}`}
                  onClick={() => handleNavClick(item)}
                  role="menuitem"
                  title={!expanded ? item.label : undefined}
                  aria-current={isActive(item) ? 'page' : undefined}
                >
                  <item.icon size={20} className="left-sidebar-icon" />
                  {expanded && <span className="left-sidebar-label">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="left-sidebar-footer">
          <button
            className="left-sidebar-item"
            title={!expanded ? 'Settings' : undefined}
          >
            <Settings size={20} className="left-sidebar-icon" />
            {expanded && <span className="left-sidebar-label">Settings</span>}
          </button>

          <button
            className="left-sidebar-toggle"
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              onPinnedChange?.(next);
            }}
            aria-label={pinned ? 'Collapse sidebar' : 'Expand sidebar'}
            title={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
          >
            {pinned ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default LeftSidebar;
