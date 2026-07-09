# Code style

## Frontend (`src/`)

- Function components + hooks only. No class components.
- One component per file: `ComponentName.jsx` + `ComponentName.css` co-located in
  `src/components/` (see `Navbar.jsx`/`Navbar.css`, `VendorDashboard.jsx`/`.css`).
  Nested feature areas get a subfolder (`src/components/Toast/`, `src/components/layout/`).
- Plain CSS, scoped by convention (component-prefixed class names) — no CSS-in-JS,
  no Tailwind, no CSS modules. Match whatever the sibling `.css` file already does.
- Icons: `lucide-react` only, don't add a second icon library.
- `src/lib/*.js` (scan/risk logic) must stay plain JS with zero React imports — it runs
  both inside components and standalone (framework-free Quick Scan path).
- Run `npm run lint` before considering frontend work done. `no-unused-vars` is a warn,
  not a blocker, but don't leave obviously dead code behind.

## Backend (`backend/`)

- FastAPI route modules stay thin: request/response models + calling into
  `backend/scanner/`, `backend/api/ml_classifier/`, or `backend/db/` — no business logic
  inline in `routes.py`/`ml_routes.py`/`category_routes.py`.
- Config lives in `backend/config.py`'s Pydantic `Settings` class. New env-driven values
  get a typed field there with a sane default, not an ad hoc `os.getenv()`.
- Async I/O throughout (asyncpg, aiohttp, aiofiles) — don't introduce blocking calls
  (`requests`, sync `psycopg2`) on the request path; those are fine in one-off scripts
  under `backend/scripts/` or `backend/db/run_migration.py`.
- ML code (`backend/api/ml_classifier/`) keeps model I/O (registry, drift detection,
  metrics) separate from feature extraction (`feature_extractor*.py`) and inference
  (`classifier.py`) — follow the existing module split rather than merging concerns.

## General

- Match existing patterns in the file/directory you're touching over introducing a new
  one, even if you'd personally prefer otherwise.
- No speculative abstraction — this repo has several versioned feature-extractor files
  (`feature_extractor.py`, `_v3`, `_v5`); don't add another "generic" layer on top without
  being asked.
