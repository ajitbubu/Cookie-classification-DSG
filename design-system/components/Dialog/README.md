`Dialog` carries every confirmation in the portal — "Review and Update Your Consent", "Extend Consent Expiry", the consent-to-data-processing gate.

```jsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent onClose={() => setOpen(false)}>
    <DialogHeader>
      <DialogTitle>Review and Update Your Consent</DialogTitle>
      <DialogDescription>We're updating your consent choices. Please confirm to continue.</DialogDescription>
    </DialogHeader>
    <Textarea placeholder="Add Notes (optional)" />
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

The close button is a `ghost` `icon-sm` Button on a `--secondary` fill, pinned 16px from the top-right. Footers put the primary action last (rightmost) and reverse to a column on phones.
