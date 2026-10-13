# AGENTS.md

Instructions for AI coding agents working in this repo — OpenAI Codex, Cursor, Jules,
and any tool that reads the `AGENTS.md` convention. (Claude Code reads `CLAUDE.md`
instead, plus `.claude/rules/`, `.claude/commands/`, `.claude/agents/`, and
`.claude/skills/` — this file covers the same ground in a tool-agnostic form so
non-Claude agents aren't left without context.)

## What this is

**Cookie Scanner (DataSafeguard)** — a privacy-compliance platform that scans websites
for cookies, classifies them (rule-based + ML), and reports GDPR / CCPA-CPRA / DPDP
compliance. React dashboard on top of a Python scanning/classification backend.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5, plain CSS per component, `lucide-react` icons |
| Frontend tests | Vitest + Testing Library + fast-check (property-based) |
| Backend API | FastAPI (`backend/main.py`), Uvicorn/Gunicorn |
| Scanning | Playwright, Firefox workers, `backend/scanner/`, `backend/worker/` |
| ML classification | scikit-learn / XGBoost / SHAP, `backend/api/ml_classifier/` |
| Data | PostgreSQL (`backend/db/`, SQL migrations), MongoDB (scan store: scans, publishes, schedules, approvals — `backend/db/scan_store.py`, `/api/store`), Redis (cache + Celery queue) |
| Backend tests | pytest + httpx + hypothesis, `tests/backend/` |
| Infra | Docker Compose (`docker-compose.yml`, `docker/Dockerfile.*`), Nginx |

## Architecture

- `src/` — React frontend. `src/components/` is one component + co-located `.css`
  per feature (Scanner, Scan History, Vendors, ML Model, Review Queue, etc.).
  `src/lib/` holds framework-free scan logic (`CookieScanner.js`, `DeepScanner.js`,
  `riskCalculator.js`) — the client can run a same-page Quick Scan without the backend.
- `backend/api/` — FastAPI routes (`routes.py`, `category_routes.py`, `ml_routes.py`,
  `streaming.py`) plus `ml_classifier/` (feature extraction, model registry, drift
  detection, explainability).
- `backend/scanner/` — the crawling/classification engine (adaptive concurrency,
  browser control, parallel execution).
- `backend/worker/` — distributed scan workers, browser pool management (these are
  what `scanner-worker-1/2/3` run in `docker-compose.yml`).
- `backend/db/` — SQLAlchemy/asyncpg access + hand-written SQL migrations
  (`backend/db/migrations/NNN_*.sql`, numbered sequentially, tracked in
  `MIGRATION_STATUS.md`).
- Services communicate over Postgres, MongoDB + Redis; see `docker-compose.yml` for the full
  topology (api-gateway :1001, ml-api :8001→:8000, workers, frontend :5173, nginx).

## Commands

```bash
# Frontend
npm run dev              # Vite dev server, http://localhost:5173
npm run build             # production build
npm run lint               # eslint src --ext js,jsx
npm test                    # vitest --run
npm run test:watch

# Backend (from repo root, venv active)
./start_backend.sh                                  # uvicorn backend.main:app --port 8000
pip install -r requirements.txt -r requirements-test.txt
pytest tests/backend/ -v
bash tests/run_api_tests.sh

# Full stack
docker compose up --build                            # redis, postgres, mongo, api-gateway, ml-api,
                                                       # 3 scanner workers, frontend, nginx
```

## Conventions

- One component = one `.jsx` + co-located `.css` file in `src/components/`. No CSS-in-JS,
  no Tailwind — match the existing plain-CSS-per-component pattern.
- Client-side scanning (`src/lib/`) must stay framework-free (no React imports) — it's
  reused for the no-backend Quick Scan path.
- FastAPI route modules stay thin: request/response models + calling into
  `backend/scanner/`, `backend/api/ml_classifier/`, or `backend/db/` — no business logic
  inline in route handlers. New route groups follow the existing pattern in
  `backend/api/routes.py` (own router file, mounted with a prefix and `tags=[...]`).
- Pydantic `Settings` (`backend/config.py`) is the single source of config — new env vars
  get a typed field there, not scattered `os.getenv()` calls.
- Async I/O throughout on the request path (asyncpg, aiohttp, aiofiles) — don't
  introduce blocking calls there; sync is fine in one-off scripts under
  `backend/scripts/` or `backend/db/run_migration.py`.
- SQL schema changes are additive migrations: `backend/db/migrations/0NN_description.sql`,
  next number after whatever's already there, entry added to `MIGRATION_STATUS.md`.
- Long-running scans stream progress over Server-Sent Events (`/scan-stream`,
  `backend/api/streaming.py`) rather than blocking until done — follow that pattern for
  any new operation that can take more than a couple seconds.
- ESLint: `no-unused-vars` is a warning, not an error; `react/prop-types` and
  `react/react-in-jsx-scope` are intentionally off (see `.eslintrc.json`).
- New endpoint or scan/classification behavior needs a test (`tests/backend/` or a
  `.test.jsx`); bug fixes need a reproducing test first, then the fix.

## Security notes

This app both handles privacy-regulated data (cookies scanned from third-party sites)
and accepts user-supplied URLs that drive a real Playwright/Firefox browser — treat
both as attack surface:

- Scan-target URLs (`ScanRequest` in `backend/models.py`) reach a real browser —
  watch for SSRF exposure (a URL reaching internal `postgres`/`redis`/`ml-api`
  hostnames on the compose network) and confirm `MAX_DEPTH`/`MAX_PAGES_PER_SCAN`/
  `PAGE_TIMEOUT` limits in `backend/config.py` are actually enforced on new code paths.
- ML API auth (`backend/api/ml_classifier/auth.py`, PyJWT) — never log or return
  `ML_SECRET_KEY`; don't let it silently fall back to the compose-file dev default
  outside local dev.
- `ALLOWED_ORIGINS` in `backend/config.py` currently includes a wildcard `*` alongside
  explicit origins — don't widen this further without flagging it.
- No hardcoded credentials; no secrets beyond the documented dev-default env vars in
  `docker-compose.yml` (`DB_PASSWORD`, `ML_SECRET_KEY`).
- Scanned cookie data is privacy-regulated by definition — exports (CSV/JSON/HTML) and
  logging shouldn't leak more than requested.

## Executing actions with care

Confirm before destructive or hard-to-reverse operations: `rm -rf`, force-push,
`git reset --hard`, `docker compose down -v` (drops Postgres/Redis/ML-log volumes for
this project), dependency downgrades, or anything that touches a shared/production
environment.
