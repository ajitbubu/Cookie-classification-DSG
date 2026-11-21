`BottomNav` is the phone counterpart of `Sidebar` — same items, same dark navy, fixed to the bottom edge.

```jsx
<BottomNav>
  <BottomNavItem href="/" active><DashboardIcon /><BottomNavLabel>Dashboard</BottomNavLabel></BottomNavItem>
</BottomNav>
```

Labels are 11px, which is why the active colour is `--sidebar-active` rather than `--primary` — the lighter blue keeps 4.5:1 on navy. It respects `env(safe-area-inset-bottom)`, and full-screen drill-down views hide it entirely in favour of their own back button.
