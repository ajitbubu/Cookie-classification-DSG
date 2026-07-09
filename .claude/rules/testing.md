# Testing

## Frontend — Vitest (`src/**/*.test.jsx`, `vitest.config.js`)

- Test files sit next to the component they cover (`MLClassificationDropdown.jsx` +
  `MLClassificationDropdown.test.jsx`, `App.jsx` + `App.test.jsx`).
- Use `@testing-library/react` + `@testing-library/user-event` — query by role/text,
  not by CSS selector or test-id unless the element has no accessible role.
- `fast-check` is available for property-based tests on `src/lib/` scan/risk logic
  (pure functions, easy to fuzz) — prefer it over hand-written edge-case lists when
  the input space is large (e.g. cookie attribute combinations).
- Run: `npm test` (single run) or `npm run test:watch` during development.

## Backend — pytest (`tests/backend/`, fixtures in `conftest.py`)

- `httpx` is pinned `<0.28` — FastAPI 0.104's `TestClient` needs the old
  `httpx.Client(app=...)` constructor. Don't bump it without also bumping FastAPI.
- `hypothesis` is a backend dependency (see `requirements.txt`) — use it for the
  classifier/feature-extractor code where inputs are combinatorial (cookie names,
  domains, attribute sets), same spirit as `fast-check` on the frontend.
- Run: `pytest tests/backend/ -v` or `bash tests/run_api_tests.sh`.
- Install test deps separately: `pip install -r requirements-test.txt` (kept out of
  the production image on purpose — don't merge it into `requirements.txt`).

## General

- New backend endpoint → add/extend a test in `tests/backend/test_api.py` using the
  fixtures in `conftest.py`, don't spin up a bespoke client per test.
- New scan-logic or classification behavior → a reproducing test first, then the fix
  (bug fix), or a test for the new behavior (feature) — per the root `CLAUDE.md`
  "Goal-Driven Execution" rule.
- Don't mock the database in backend tests that exercise migrations or schema-shaped
  behavior — this repo has hand-written SQL migrations
  (`backend/db/migrations/`); a mock can pass while the real migration is broken.
