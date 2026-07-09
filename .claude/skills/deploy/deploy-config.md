# Deploy config reference

Environment variables read by `docker-compose.yml`. All have dev-safe defaults so
`docker compose up` works with zero setup, but the defaults are not safe to ship.

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `DB_PASSWORD` | postgres, api-gateway, ml-api | `scanner_password` | Also composed into `DATABASE_URL` for api-gateway/workers |
| `ML_SECRET_KEY` | ml-api | `change-this-secret-key-in-production` | Signs/validates ML API auth (`backend/api/ml_classifier/auth.py`) |

Fixed (not overridable via env today — edit `docker-compose.yml` directly if needed):

- `BROWSER_TYPE=firefox` (api-gateway, workers)
- `WORKER_COUNT=4`, `MAX_CONCURRENT_PAGES=200` (api-gateway) vs `100` per worker
- `ML_MODEL_VERSION=6.0.0`, `ML_CONFIDENCE_HIGH=0.85`, `ML_CONFIDENCE_MEDIUM=0.65`
- `ML_RATE_LIMIT_REQUESTS=100` per `ML_RATE_LIMIT_WINDOW=60`s

## Setting real values

```bash
export DB_PASSWORD="$(openssl rand -base64 24)"
export ML_SECRET_KEY="$(openssl rand -base64 32)"
docker compose up --build
```

Or put them in a `.env` file at the repo root — Docker Compose loads it automatically.
`.env` is already in `.gitignore`, so this is safe from accidental commits.
