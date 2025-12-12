# Large Scan Limitations - Browser Stability Issues

**Date**: December 4, 2025  
**Issue**: Browser crashes during large scans (100 pages)  
**Status**: ⚠️ **KNOWN LIMITATION**

---

## Problem

When scanning large sites (100+ pages) with high concurrency, the Playwright browser in Docker crashes with:

```
Target page, context or browser has been closed
```

**Root Cause**: WebGL/GPU driver issues in Docker container running on ARM64 architecture

---

## Error Details

```
[pid=3375][err] WebGL warning: WebglAllowWindowsNativeGl:false restricts context creation
[pid=3375][err] Failed to create WebGL context
[pid=3375][err] Exhausted GL driver options
[pid=3375][err] Exiting due to channel error
[pid=3375] <process did exit: exitCode=null, signal=SIGKILL>
```

---

## Current Limitations

### What Works ✅
- **Small scans**: 10-20 pages work reliably
- **Medium scans**: 20-50 pages work with lower concurrency
- **Simple sites**: Sites without heavy JavaScript/WebGL

### What Fails ❌
- **Large scans**: 100+ pages with high concurrency
- **Complex sites**: Sites with heavy JavaScript, WebGL, or animations
- **High concurrency**: 20+ concurrent pages can overwhelm browser

---

## Recommended Settings

### For Reliable Scans

| Site Complexity | Max Pages | Concurrency | Max Depth |
|----------------|-----------|-------------|-----------|
| Simple (example.com) | 50 | 10 | 3 |
| Medium (google.com) | 30 | 5 | 2 |
| Complex (xfinity.com) | 20 | 3 | 2 |

### Conservative Settings (Most Reliable)
```json
{
  "maxPages": 20,
  "concurrency": 5,
  "maxDepth": 2
}
```

### Aggressive Settings (May Crash)
```json
{
  "maxPages": 100,
  "concurrency": 20,
  "maxDepth": 3
}
```

---

## Workarounds

### Option 1: Multiple Smaller Scans
Instead of one 100-page scan, run multiple 20-page scans:

```bash
# Scan 1: First 20 pages
curl -X POST http://localhost:8001/api/scan \
  -d '{"url": "https://xfinity.com", "maxPages": 20, "concurrency": 5}'

# Scan 2: Next 20 pages (different starting point)
curl -X POST http://localhost:8001/api/scan \
  -d '{"url": "https://xfinity.com/products", "maxPages": 20, "concurrency": 5}'

# Combine results manually
```

### Option 2: Lower Concurrency
Reduce concurrent pages to avoid overwhelming the browser:

```json
{
  "maxPages": 100,
  "concurrency": 3,  // Lower concurrency
  "maxDepth": 2
}
```

This will take longer but is more stable.

### Option 3: Restart Between Scans
If doing multiple scans, restart the ML API container between scans:

```bash
docker restart cookie-scanner-ml-api
sleep 10
# Run next scan
```

---

## Long-Term Solutions

### Solution 1: Disable WebGL in Browser
Update browser launch options to disable WebGL:

```python
# In backend/scanner/browser.py
browser = await playwright.firefox.launch(
    headless=True,
    args=[
        '--disable-webgl',
        '--disable-gpu',
        '--disable-software-rasterizer'
    ]
)
```

### Solution 2: Use Chromium Instead of Firefox
Chromium may have better stability in Docker:

```python
# In backend/config.py
BROWSER_TYPE = "chromium"  # Instead of "firefox"
```

Then install Chromium:
```bash
docker exec cookie-scanner-ml-api playwright install chromium
docker exec cookie-scanner-ml-api playwright install-deps chromium
```

### Solution 3: Increase Docker Resources
Allocate more memory and CPU to Docker:

**Docker Desktop Settings**:
- Memory: 8GB (minimum)
- CPUs: 4 cores (minimum)
- Swap: 2GB

### Solution 4: Use Native Installation (Not Docker)
Run the backend natively instead of in Docker for better browser stability:

```bash
# Install dependencies
pip install -r backend/requirements.txt
playwright install firefox
playwright install-deps firefox

# Run backend
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

---

## Testing Results

### ✅ Successful Tests

| URL | Pages | Concurrency | Result |
|-----|-------|-------------|--------|
| example.com | 10 | 5 | ✅ Success (10 pages) |
| google.com | 10 | 5 | ✅ Success (10 pages, 20 cookies) |
| google.com | 20 | 5 | ✅ Success |

### ❌ Failed Tests

| URL | Pages | Concurrency | Result |
|-----|-------|-------------|--------|
| xfinity.com | 100 | 20 | ❌ Browser crash after 58s |
| xfinity.com | 50 | 10 | ❌ Browser crash |

---

## Recommendations

### For Production Use

1. **Set realistic limits**: Max 20-30 pages per scan
2. **Use lower concurrency**: 3-5 concurrent pages
3. **Implement retry logic**: Retry failed scans automatically
4. **Add monitoring**: Track browser crashes and adjust limits
5. **Consider native deployment**: Run outside Docker for better stability

### For Development/Testing

1. **Test with small scans first**: Start with 10 pages
2. **Gradually increase**: Test 20, then 30, then 50
3. **Monitor Docker resources**: Check CPU/memory usage
4. **Restart between tests**: Restart container to clear state

---

## Current Status

### What's Working ✅
- ✅ Backend API functional
- ✅ ML Classification working (v2.0.0, 94% accuracy)
- ✅ Small to medium scans (10-30 pages)
- ✅ Parallel scanning with adaptive concurrency

### Known Issues ⚠️
- ⚠️ Browser crashes on large scans (100+ pages)
- ⚠️ WebGL/GPU driver issues in Docker ARM64
- ⚠️ High concurrency (20+) causes instability

---

## Conclusion

The cookie scanner works well for **small to medium scans (10-30 pages)**. For larger scans:

1. Use multiple smaller scans
2. Lower concurrency to 3-5
3. Consider native deployment instead of Docker
4. Implement retry logic for failed scans

For most use cases, scanning 20-30 pages is sufficient to get a representative sample of a website's cookies.

---

**Last Updated**: December 4, 2025  
**Status**: ⚠️ Known Limitation - Workarounds Available
