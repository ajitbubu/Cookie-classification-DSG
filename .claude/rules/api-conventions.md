# API conventions (`backend/api/`)

- Routers are assembled in `backend/api/routes.py`: a base `APIRouter`, with
  `category_routes.py` mounted at `/categories` and `ml_routes.py` mounted at
  `/v1/ml`. A new route group follows the same pattern — its own `router.py`,
  included with a prefix and a `tags=[...]` entry, not appended directly to the
  base router.
- Request/response bodies are typed Pydantic models in `backend/models.py`
  (`ScanRequest`, `HealthResponse`, ...) — don't accept raw `dict`/`Request` bodies
  where a model will do.
- Long-running scans stream progress over Server-Sent Events
  (`/scan-stream`, `backend/api/streaming.py`) rather than blocking until done —
  follow that pattern for any new operation that can take more than a couple seconds
  (crawls, batch classification), instead of adding a synchronous endpoint that times out.
- Real scans call into Playwright; verify the browser can actually launch (see the
  `test_browser = await _browser_type.launch(...)` probe in `scan_website_stream`)
  before committing to the real path, and keep a mock/fallback path for when it can't
  (dev machines without browsers installed, CI).
- Errors: raise `HTTPException` with a real status code, don't swallow exceptions into
  a 200 response with an error string in the body.
- Logging: module-level `logger = logging.getLogger(__name__)`, `logger.info(...)` for
  scan lifecycle events (start/config/complete) — keep that visible, it's the main way
  to debug a stuck scan in production.
- ML endpoints (`ml_routes.py`) return confidence scores alongside predictions —
  never a bare category label. The frontend's `ConfidenceBadge`/
  `MLClassificationDropdown` components depend on that shape.
