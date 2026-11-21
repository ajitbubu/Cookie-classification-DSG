`Header` is the app bar that sits above every routed page.

```jsx
<Header title={<p style={{ fontSize: 24, fontWeight: 500 }}>Welcome Back, Aditi Rao!</p>}>
  <Button variant="ghost" size="icon" aria-label="Notifications"><BellIcon /></Button>
  <AccountMenu />
</Header>
```

The dashboard shows "Welcome Back, {name}!"; every other page pushes its own title and subtitle into this slot. The bell carries a 8px emerald dot when unread. On desktop the header is a rounded card with a border and `--shadow-sm`; on phones it goes flat and full-width.
