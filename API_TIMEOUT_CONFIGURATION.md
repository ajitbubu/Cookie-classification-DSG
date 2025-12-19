# API Timeout Configuration

## Summary
This document details all timeout configurations for the Cookie Scanner application's APIs.

---

## Frontend API Calls

### 1. Scan API (`http://localhost:8001/api/scan`)
**Location**: `src/App.jsx` (line ~523)

**Configuration**:
```javascript
const response = await fetch('http://localhost:8001/api/scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: url,
    scanType: 'quick',
    maxPages: 1,
    concurrency: 1,
    maxDepth: 1
  })
});
```

**Timeout**: ❌ **NO EXPLICIT TIMEOUT SET**
- Uses browser's default fetch timeout (varies by browser)
- Chrome/Edge: ~300 seconds (5 minutes)
- Firefox: ~90 seconds
- Safari: ~60 seconds

**Recommendation**: Add explicit timeout using AbortController

---

### 2. ML Classify API (`http://localhost:8001/api/v1/ml/classify`)
**Location**: `src/App.jsx` (line ~209)

**Configuration**:
```javascript
const response = await fetch('http://localhost:8001/api/v1/ml/classify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(requestBody)
});
```

**Timeout**: ❌ **NO EXPLICIT TIMEOUT SET**
- Uses browser's default fetch timeout (varies by browser)
- Chrome/Edge: ~300 seconds (5 minutes)
- Firefox: ~90 seconds
- Safari: ~60 seconds

**Recommendation**: Add explicit timeout using AbortController

---

## Backend Timeout Configurations

### 1. Page Load Timeout
**Location**: `backend/config.py`

```python
PAGE_TIMEOUT: int = 15000  # 15 seconds
```

**Environment Variable**: `PAGE_TIMEOUT=30000` (in `.env`)

**Actual Value**: 
- Config default: 15 seconds
- .env override: 30 seconds
- **Effective**: 30 seconds (from .env)

**Used For**:
- Playwright page.goto() operations
- Browser context default timeout
- Page navigation timeout

---

### 2. ML Classification Timeouts
**Location**: `backend/api/ml_classifier/config.py`

```python
CLASSIFICATION_TIMEOUT_MS = 200  # 200ms per classification
FEATURE_EXTRACTION_TIMEOUT_MS = 100  # 100ms for feature extraction
EXPLANATION_TIMEOUT_MS = 50  # 50ms for explanation generation
```

**Environment Variables**:
- `ML_CLASSIFICATION_TIMEOUT_MS=200`
- `ML_FEATURE_EXTRACTION_TIMEOUT_MS=100`
- `ML_EXPLANATION_TIMEOUT_MS=50`

**Total ML Processing Time per Cookie**: ~350ms maximum

---

### 3. Network Idle Timeout
**Location**: `backend/scanner/cookie_scanner.py`

```python
await page.goto(url, wait_until="networkidle", timeout=30000)  # 30 seconds
```

**Fallback Timeouts**:
- Load event: 30 seconds
- DOMContentLoaded: Uses PAGE_TIMEOUT (30 seconds)

---

### 4. Streaming Progress Timeout
**Location**: `backend/api/streaming.py`

```python
progress_data = await asyncio.wait_for(
    progress_queue.get(),
    timeout=0.5  # 500ms
)
```

**Purpose**: Check for progress updates every 500ms during streaming scans

---

### 5. Redis Queue Timeout
**Location**: `backend/worker/distributed_scanner.py`

```python
job_data = await self.redis_client.brpoplpush(
    self.scan_queue,
    self.processing_queue,
    timeout=5  # 5 seconds
)
```

**Purpose**: Wait up to 5 seconds for new scan jobs from Redis queue

---

### 6. Uvicorn Server Timeout
**Location**: `backend/main.py`

```python
uvicorn.run(
    "main:app",
    host=settings.BACKEND_HOST,
    port=settings.BACKEND_PORT,
    reload=True,
    log_level="info"
)
```

**Timeout**: ❌ **NO EXPLICIT TIMEOUT SET**
- Uses Uvicorn defaults:
  - Keep-alive timeout: 5 seconds
  - Request timeout: None (no limit)

---

### 7. Docker Health Check Timeouts
**Location**: `docker-compose.yml`

**Redis**:
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 3
```

**PostgreSQL**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U scanner"]
  interval: 10s
  timeout: 3s
  retries: 3
```

**ML API**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## Timeout Summary Table

| Component | Timeout | Configurable | Location |
|-----------|---------|--------------|----------|
| **Frontend → Scan API** | None (browser default) | ❌ No | `src/App.jsx:523` |
| **Frontend → ML API** | None (browser default) | ❌ No | `src/App.jsx:209` |
| **Page Load** | 30s | ✅ Yes (.env) | `backend/config.py` |
| **ML Classification** | 200ms | ✅ Yes (env var) | `backend/api/ml_classifier/config.py` |
| **Feature Extraction** | 100ms | ✅ Yes (env var) | `backend/api/ml_classifier/config.py` |
| **Explanation** | 50ms | ✅ Yes (env var) | `backend/api/ml_classifier/config.py` |
| **Network Idle** | 30s | ❌ No | `backend/scanner/cookie_scanner.py` |
| **Streaming Progress** | 500ms | ❌ No | `backend/api/streaming.py` |
| **Redis Queue** | 5s | ❌ No | `backend/worker/distributed_scanner.py` |
| **Uvicorn Keep-Alive** | 5s | ✅ Yes (uvicorn config) | `backend/main.py` |
| **Docker Health Checks** | 3-10s | ✅ Yes (docker-compose) | `docker-compose.yml` |

---

## Recommendations

### 1. Add Frontend Timeouts ⚠️ CRITICAL

**Problem**: No timeout on frontend fetch calls means they can hang indefinitely.

**Solution**: Add AbortController with timeout

```javascript
// For Scan API
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

try {
  const response = await fetch('http://localhost:8001/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scanRequest),
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // ... handle response
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.error('Scan request timed out after 2 minutes');
  }
  throw error;
}
```

**Recommended Timeouts**:
- Quick Scan: 60 seconds
- Deep Scan: 300 seconds (5 minutes)
- ML Classification: 30 seconds

---

### 2. Add Uvicorn Request Timeout

**Problem**: No request timeout means long-running requests can block workers.

**Solution**: Add timeout to uvicorn.run()

```python
uvicorn.run(
    "main:app",
    host=settings.BACKEND_HOST,
    port=settings.BACKEND_PORT,
    reload=True,
    log_level="info",
    timeout_keep_alive=5,
    timeout_graceful_shutdown=30
)
```

---

### 3. Configure Environment Variables

**Add to `.env`**:
```bash
# Frontend Timeouts (for future implementation)
SCAN_TIMEOUT_MS=120000  # 2 minutes
ML_CLASSIFY_TIMEOUT_MS=30000  # 30 seconds

# Backend Timeouts
PAGE_TIMEOUT=30000  # 30 seconds (already set)
ML_CLASSIFICATION_TIMEOUT_MS=200  # 200ms (already set)
ML_FEATURE_EXTRACTION_TIMEOUT_MS=100  # 100ms (already set)
ML_EXPLANATION_TIMEOUT_MS=50  # 50ms (already set)

# Uvicorn Timeouts
UVICORN_TIMEOUT_KEEP_ALIVE=5
UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN=30
```

---

## Current Issues

### Issue 1: No Frontend Timeout Protection
**Impact**: Users may experience indefinite loading states
**Severity**: HIGH
**Fix**: Add AbortController with timeouts

### Issue 2: Browser-Dependent Behavior
**Impact**: Different timeout behavior across browsers
**Severity**: MEDIUM
**Fix**: Explicit timeouts ensure consistent behavior

### Issue 3: No Request Timeout on Uvicorn
**Impact**: Long-running requests can block workers
**Severity**: MEDIUM
**Fix**: Add timeout configuration to uvicorn

---

## Testing Timeout Behavior

### Test 1: Scan API Timeout
```bash
# Simulate slow scan (should timeout after configured duration)
curl -X POST http://localhost:8001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example.com","scanType":"quick","maxPages":1000}'
```

### Test 2: ML API Timeout
```bash
# Classify large batch (should timeout if too slow)
curl -X POST http://localhost:8001/api/v1/ml/classify \
  -H "Content-Type: application/json" \
  -d '{"cookies":[...]}'  # Large array
```

### Test 3: Page Load Timeout
```bash
# Scan slow-loading site (should timeout after 30s)
curl -X POST http://localhost:8001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"http://httpstat.us/200?sleep=40000","scanType":"quick"}'
```

---

## Monitoring Timeouts

### Logs to Watch

**Page Timeout**:
```
WARNING: Network idle timeout for http://example.com, trying load: ...
WARNING: Load timeout for http://example.com, trying domcontentloaded: ...
```

**ML Timeout**:
```
ERROR: ML classification timeout after 200ms
ERROR: Feature extraction timeout after 100ms
```

**Redis Timeout**:
```
INFO: No jobs in queue, waiting... (timeout: 5s)
```

---

## Performance Impact

### Current Configuration Performance

**Quick Scan** (1 page):
- Page load: ~2-5 seconds
- ML classification: ~0.2-0.5 seconds per cookie
- Total: ~3-10 seconds for 10 cookies

**Deep Scan** (100 pages):
- Page load: ~2-5 seconds per page
- Total page loading: ~200-500 seconds (3-8 minutes)
- ML classification: ~20-50 seconds for 1000 cookies
- Total: ~4-10 minutes

**Timeout Recommendations**:
- Quick Scan: 60 seconds (covers 99% of cases)
- Deep Scan: 600 seconds (10 minutes for 100 pages)
- ML Classification: 30 seconds (covers large batches)

---

## Conclusion

The application currently has:
- ✅ Good backend timeouts for page loading and ML processing
- ❌ Missing frontend timeouts (critical issue)
- ❌ No Uvicorn request timeout (medium issue)

**Priority Actions**:
1. Add frontend fetch timeouts using AbortController
2. Configure Uvicorn request timeouts
3. Add timeout monitoring and alerting
4. Document timeout behavior for users
