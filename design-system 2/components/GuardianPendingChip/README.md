`GuardianPendingChip` sits next to the expiry badge when a minor's consent change is waiting on a parent or guardian.

```jsx
<Badge variant="success">ACTIVE</Badge>
{isGuardianApprovalPending ? <GuardianPendingChip /> : null}
```

It is a `destructive` badge with its fill and horizontal padding stripped — red text and an info glyph, no pill. The rejected counterpart reads "Rejected by Parent/Guardian".
