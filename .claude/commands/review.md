---
description: Review the current diff against this repo's conventions before landing
---

Review the pending changes (`git diff` / `git status`) against this project's rules:

1. Read `.claude/rules/code-style.md`, `.claude/rules/testing.md`, and
   `.claude/rules/api-conventions.md`.
2. For each changed file, check:
   - Frontend: component + co-located CSS pattern kept, `src/lib/` stays
     framework-free, no new icon/CSS libraries introduced.
   - Backend: routes stay thin (logic in `scanner/`, `ml_classifier/`, or `db/`),
     new config goes through `backend/config.py`'s `Settings`, async I/O only on the
     request path.
   - SQL: new schema changes are additive migrations in `backend/db/migrations/`,
     numbered after the current max, with a `MIGRATION_STATUS.md` entry.
   - Tests: a new endpoint or scan/classification behavior has a corresponding test
     in `tests/backend/` or a `.test.jsx` file; bug fixes have a reproducing test.
3. Flag anything that duplicates an existing pattern instead of reusing it (e.g. a new
   feature-extractor file when `feature_extractor_v5.py` already covers the case).
4. Run `npm run lint` and `pytest tests/backend/ -v` (or `bash tests/run_api_tests.sh`)
   for any touched area; report failures, don't silently skip them.

Report findings as a short list: file, issue, suggested fix. Don't rewrite unrelated
code while reviewing.
