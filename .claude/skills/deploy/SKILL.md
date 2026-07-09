---
name: deploy
description: Bring up the full Cookie Scanner stack (Redis, Postgres, API gateway, ML API, scanner workers, frontend, Nginx) via Docker Compose. Use when the user wants the full stack running, not just the frontend dev server, or wants to verify a change against the real backend/ML pipeline instead of the framework-free Quick Scan path.
---

# Deploy (docker compose)

Full-stack launch for this repo. For frontend-only work, `npm run dev` is faster and
sufficient — reach for this only when backend/ML/multi-page-crawl behavior needs to
be exercised for real.

## Services (see `docker-compose.yml`)

| Service | Port | Depends on |
|---|---|---|
| `redis` | 6379 | — |
| `postgres` | 5432 | — |
| `api-gateway` | 1001 | redis, postgres |
| `ml-api` | 8001→8000 | redis, postgres |
| `scanner-worker-1/2/3` | — | redis, postgres |
| `frontend` | 5173 | api-gateway |
| `nginx` | 80/443 | api-gateway, frontend |

## Steps

1. Check `.env` / shell env for `DB_PASSWORD` and `ML_SECRET_KEY` — compose falls back
   to insecure dev defaults (`scanner_password`, `change-this-secret-key-in-production`)
   if unset. Fine for local dev, not for anything shared.
2. `docker compose up --build` (first run pulls Firefox for the Playwright workers —
   expect the `worker` build to be the slowest layer).
3. Wait for healthchecks: `docker compose ps` — `redis`, `postgres`, and `ml-api` have
   explicit healthchecks; `api-gateway`/`workers`/`frontend` start once their
   dependencies report healthy.
4. Verify:
   - `curl http://localhost:1001/api/health` — API gateway up
   - `curl http://localhost:8001/api/v1/ml/health` — ML API up
   - open `http://localhost:5173` — frontend, now proxying `/api` to the real gateway
     instead of nothing.
5. Logs for a specific service: `docker compose logs -f <service>` (e.g.
   `scanner-worker-1` when debugging a stuck crawl).

## Tearing down

`docker compose down` — add `-v` only if you intend to drop `redis-data`/
`postgres-data`/`ml-logs` volumes (destructive; confirm with the user first, per the
root CLAUDE.md executing-actions-with-care guidance).

See `deploy-config.md` for the environment variables in more detail.
