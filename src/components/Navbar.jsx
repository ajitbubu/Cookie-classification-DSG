import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, LogOut, ChevronDown, Shield, Bell, Menu } from 'lucide-react';
import './Navbar.css';

const USER = {
  name: 'Ajit Sahu',
  email: 'ajit@datasafeguard.io',
  role: 'Admin',
  initials: 'AS',
};

function Navbar({ notifications = [], unreadCount = 0, onNotificationClick, onMarkAllRead, onClearAll, navOpen = false, onMenuToggle }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar-container">

        {/* Mobile nav trigger (hidden on desktop via CSS) */}
        <button
          className="navbar-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={navOpen}
          onClick={onMenuToggle}
        >
          <Menu size={22} />
        </button>

        {/* Brand */}
        <div className="navbar-brand">
          <img
            src="https://cdn.prod.website-files.com/646e363f9c29e4860c52c82e/665f4b9f47a7740de833d1c2_Final%20Data%20Safeguard%20Logo.svg"
            alt="Data Safeguard"
            className="navbar-logo-img"
          />
        </div>

        {/* Right side */}
        <div className="navbar-right">

          {/* Notification bell */}
          <div className="navbar-notif" ref={notifRef}>
            <button
              className={`navbar-icon-btn ${unreadCount > 0 ? 'navbar-icon-btn--active' : ''}`}
              aria-label="Notifications"
              onClick={() => setNotifOpen(v => !v)}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="navbar-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="navbar-notif-flyout">
                <div className="navbar-notif-flyout__header">
                  <span className="navbar-notif-flyout__title">Notifications</span>
                  <div className="navbar-notif-flyout__actions">
                    {unreadCount > 0 && (
                      <button className="navbar-notif-action-btn" onClick={onMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button className="navbar-notif-action-btn" onClick={onClearAll}>
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="navbar-notif-flyout__empty">
                    <Bell size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
                    <p>No notifications yet</p>
                    <span>Scan results will appear here</span>
                  </div>
                ) : (
                  <ul className="navbar-notif-list">
                    {notifications.map(notif => (
                      <li
                        key={notif.id}
                        className={`navbar-notif-item ${!notif.read ? 'navbar-notif-item--unread' : ''}`}
                        onClick={() => { onNotificationClick(notif); setNotifOpen(false); }}
                      >
                        <div className="navbar-notif-item__icon">
                          <Shield size={15} />
                        </div>
                        <div className="navbar-notif-item__body">
                          <span className="navbar-notif-item__domain">{notif.domain}</span>
                          <span className="navbar-notif-item__meta">
                            {notif.pagesScanned} page{notif.pagesScanned !== 1 ? 's' : ''} · {notif.totalCookies} cookies
                            {!notif.isFirstScan && notif.newCookies > 0 && (
                              <span className="navbar-notif-pill navbar-notif-pill--new">+{notif.newCookies} new</span>
                            )}
                            {!notif.isFirstScan && notif.removedCookies > 0 && (
                              <span className="navbar-notif-pill navbar-notif-pill--removed">-{notif.removedCookies} removed</span>
                            )}
                            {!notif.isFirstScan && notif.newCookies === 0 && notif.removedCookies === 0 && (
                              <span className="navbar-notif-pill navbar-notif-pill--same">no changes</span>
                            )}
                          </span>
                          <span className="navbar-notif-item__time">
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {new Date(notif.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {!notif.read && <span className="navbar-notif-item__dot" />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="navbar-profile" ref={menuRef}>
            <button
              className={`navbar-avatar-btn ${menuOpen ? 'navbar-avatar-btn--open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span className="navbar-avatar">{USER.initials}</span>
              <div className="navbar-avatar-info">
                <span className="navbar-avatar-name">{USER.name}</span>
                <span className="navbar-avatar-role">{USER.role}</span>
              </div>
              <ChevronDown size={14} className={`navbar-chevron ${menuOpen ? 'navbar-chevron--up' : ''}`} />
            </button>

            {menuOpen && (
              <div className="navbar-dropdown">
                <div className="navbar-dropdown__header">
                  <span className="navbar-dropdown__avatar">{USER.initials}</span>
                  <div>
                    <p className="navbar-dropdown__name">{USER.name}</p>
                    <p className="navbar-dropdown__email">{USER.email}</p>
                  </div>
                </div>
                <div className="navbar-dropdown__divider" />
                <button className="navbar-dropdown__item">
                  <User size={14} /> Profile
                </button>
                <button className="navbar-dropdown__item">
                  <Settings size={14} /> Settings
                </button>
                <button className="navbar-dropdown__item">
                  <Shield size={14} /> Privacy Preferences
                </button>
                <div className="navbar-dropdown__divider" />
                <button className="navbar-dropdown__item navbar-dropdown__item--danger">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}

export default Navbar;
