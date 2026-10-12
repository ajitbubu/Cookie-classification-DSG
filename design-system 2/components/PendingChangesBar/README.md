`PendingChangesBar` is the heart of the consent interaction model: switches stage, this bar saves.

```jsx
{pending.size > 0 ? (
  <PendingChangesBar listName={list.consent_list_name} onReset={reset} onApply={() => setConfirmOpen(true)} />
) : null}
```

"Apply Changes" opens the notes-confirm `Dialog`; "Reset" drops the staged set with no revert logic (the switches were never committed). After a save the Apply button reads "Resave in (Ns)" for 30 seconds.
