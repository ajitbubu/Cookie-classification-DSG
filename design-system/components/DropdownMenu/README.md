`DropdownMenu` is the header account menu (User Profile / Logout) and any row-action menu.

```jsx
<DropdownMenu align="end" trigger={<AccountTrigger />}>
  <DropdownMenuItem><UserRoundIcon />User Profile</DropdownMenuItem>
  <DropdownMenuItem variant="destructive"><LogOutIcon />Logout</DropdownMenuItem>
</DropdownMenu>
```

The header's menu is wider and heavier than the default (`w-56`, 12px item padding, 16px semibold text) — that's a deliberate override on that one surface. Items hover to `--accent`; destructive items hover to a 10% red tint.
