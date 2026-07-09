---
description: Fix a described bug — reproduce first, then fix, then verify
argument-hint: <issue description or file:line>
---

Fix the issue described in $ARGUMENTS, following the root `CLAUDE.md`
"Goal-Driven Execution" rule:

1. **Reproduce first.** Locate the relevant code (frontend component in
   `src/components/`, scan/classification logic in `backend/scanner/` or
   `backend/api/ml_classifier/`, or an API route in `backend/api/`). Write a failing
   test that captures the bug — a `.test.jsx` next to the component, or a case in
   `tests/backend/test_api.py` — before touching implementation code.
2. **Fix surgically.** Touch only what's needed to make the reproducing test pass.
   Don't refactor adjacent code, don't "improve" unrelated functions.
3. **Verify.** Run the relevant suite:
   - Frontend: `npm test`
   - Backend: `pytest tests/backend/ -v`
   Confirm the new test passes and nothing else regressed.
4. If the bug is in scan/classification logic, sanity-check against a real scan where
   practical (`npm run dev` + the Quick Scan flow, or `docker compose up` for the full
   pipeline) rather than trusting the unit test alone.

Report: what was broken, the root cause, the fix, and the test that proves it.
