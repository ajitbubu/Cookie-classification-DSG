`SidebarList` is the left-hand master list of the consent (and preference) screen.

```jsx
<SidebarList
  title="Consents"
  items={lists}
  getItemId={(l) => l.consent_list_id}
  getSearchText={(l) => l.consent_list_name}
  searchPlaceholder="Search groups..."
  selectedId={selected}
  onSelect={setSelected}
  renderItem={(l, ctx) => (<span>{l.consent_list_name}<span>{l.count} Consent(s)</span></span>)}
/>
```

Rows are at least 4.75rem tall with `--radius-xl`; the selected row is a solid brand-blue fill on desktop but stays a white card on phones (where the whole list is the page). Its own scrollbar is hidden.
