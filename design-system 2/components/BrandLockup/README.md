`BrandLockup` is the left half of the login and sign-up screens.

```jsx
<div style={{ background: "linear-gradient(to bottom, var(--auth-hero-from), var(--auth-hero-to))" }}>
  <BrandLockup image="assets/brand/brainLogo.png" />
</div>
```

It is the only place in the product that uses Poppins, and the only place with a gradient. Type is deliberately huge and literal: 5.14625rem for "ID-PRIVACY®", 1.375rem for "Privacy Management Portal", 36px for the tagline — all with `-0.03em` tracking. Keep the ® and the exact tagline punctuation ("Automate : Privacy & Compliance").
