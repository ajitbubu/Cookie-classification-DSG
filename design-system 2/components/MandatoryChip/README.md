`MandatoryChip` goes in the Actions cell of a consent row that the user cannot change.

```jsx
{isMandatoryLocked(row) ? <MandatoryChip /> : <Switch checked={on} onCheckedChange={stage} />}
```

It's a dashed-border, fully-rounded outline badge with a lock glyph and uppercase text. Never render a disabled `Switch` instead — the chip is the product's answer to "why can't I turn this off".
