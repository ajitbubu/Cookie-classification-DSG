`PreferenceCard` is what the user sees when they expand a consent row: one card per linked preference channel.

```jsx
<PreferenceCard
  variant="consent"
  title="Product updates"
  subtitle="Email"
  active
  footer="Expiry Date: 20/11/2030"
  onToggle={(on) => updatePreference(on)}
  onHistoryClick={openHistory}
/>
```

The border is the literal `#E2E8F0` and hovers to `#127EE2` — no ring, no shadow. State is spelled out in words ("Active" / "Inactive") next to a circle glyph, in green when on.
