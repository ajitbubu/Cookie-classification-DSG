`Drawer` shows the audit log and the preference history — anything the user reads without leaving the table.

```jsx
<Drawer open={!!auditId} onOpenChange={close} side="right">
  <DrawerHeader><DrawerTitle>Audit Log</DrawerTitle><DrawerDescription>Consent history</DrawerDescription></DrawerHeader>
  <DrawerBody><AuditLogTable rows={rows} /></DrawerBody>
</Drawer>
```

The panel is inset 8px from the viewport edge so all four corners stay rounded — it is not flush. Motion is 450ms on `--ease-standard`; the phone variant gets a grab handle.
