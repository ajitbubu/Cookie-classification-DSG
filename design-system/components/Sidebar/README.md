`Sidebar` is the desktop app rail. It is exactly 6.75rem (108px) wide, `--radius-xl`, and stays `#0D1120` navy in both light and dark mode — the one surface that never follows the theme.

```jsx
<Sidebar
  logo={<LogoMark />}
  items={[{ key: "dashboard", label: "Dashboard", href: "/", icon: <DashboardIcon />, active: true }]}
  footer={<><p>Privacy Management Portal</p><p>V 3.0</p></>}
/>
```

Items stack icon over label, centred; the active item gets an 8%-opacity brand fill and `--sidebar-active` (a lighter blue than `--primary`, for contrast on navy). Below 768px it is replaced by `BottomNav`. Nav labels are the raw product names: Dashboard, Consent, DPAR, PIA.
