`InputOTP` is the "Verify OTP" step of both login and sign-up.

```jsx
<InputOTP value={otp} onChange={setOtp} length={6} />
```

Slots are 60×60 with 32px digits and a 14px gap at ≥500px, shrinking to 42px/20px and then 32px/16px on small phones. Digits only; paste spreads across slots; backspace walks backwards.
