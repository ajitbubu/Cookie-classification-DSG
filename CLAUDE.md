# CLAUDE.md

Project guide for Claude Code. Loaded at the start of every session in this repo.

Non-Claude agents (OpenAI Codex, Cursor, etc.) don't read this file — they read
`AGENTS.md` at the repo root instead, which covers the same project overview,
architecture, commands, and conventions in a tool-agnostic form. Keep the two in sync
when either changes.

UI work follows design-system/README.md. Take colours, spacing and radii from
design-system/tokens.json; never hard-code hex values. Check
design-system/components/<Name>/README.md before building or changing a component.

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
| Data | PostgreSQL (`backend/db/`, SQL migrations), Redis (cache + Celery queue) |
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
- Services communicate over Postgres + Redis; see `docker-compose.yml` for the full
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
docker compose up --build                            # redis, postgres, api-gateway, ml-api,
                                                       # 3 scanner workers, frontend, nginx
```

No project skill launches the app end-to-end yet — see `/run` for ad-hoc launch, or
`.claude/skills/deploy/` for the compose-based path.

## Conventions

- UI follows the design system in `design-system/`. For this app (UCM) read
  `design-system/ucm/README.md` first, then `design-system/README.md` for shared rules.
  `design-system/components/Ucm*/preview.html` show the target look for each pattern.
- Use CSS variables from `design-system/tokens.css` (`var(--ucm-brand-accent)`,
  `var(--ucm-blue-4)`, `var(--ucm-radius-control)` …) in each component's `.css`; never
  hard-code hex values. `design-system/tokens.json` lists every token with its usage note.
- UCM screens use `--ucm-brand-accent`, not `--primary`. Text is `--ucm-navy`.
- `design-system/components/<Name>/README.md` describe the PMP React kit: reference
  only, not components to import here.
- Don't import `design-system/components/bundle.css`; it restyles globals. Its
  `--ucm-font*` variables are the only part this app needs.

See also: `.claude/rules/` (style/testing/API detail), `.claude/commands/` (repeatable
workflows), `.claude/agents/` (specialized reviewers).



