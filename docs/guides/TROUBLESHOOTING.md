# Troubleshooting Guide - Cookie Scanner

## "Deep scan failed: Failed to fetch" Error

### Root Cause

This error occurs when the **frontend cannot connect to the backend API**. Common causes:

1. **Backend server not running** ← Most common!
2. Backend crashed during scan
3. Wrong backend URL configuration
4. CORS/network issues

---

## Quick Fix

### Step 1: Start the Backend Server

```bash
# Make sure you're in the cookie-scanner directory
cd /path/to/cookie-scanner

# Start the backend
./start-backend.sh
```

Or manually:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
```

### Step 2: Verify Backend is Running

Open http://localhost:8000/api/health in your browser.

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T...",
  "version": "1.0.0"
}
```

### Step 3: Start the Frontend

```bash
# In the same cookie-scanner directory
npm run dev
```

---

## Test Backend Before Running Full App

Run the included test script to verify everything works:

```bash
# Activate virtual environment
source .venv/bin/activate

# Run test script
python test-backend.py
```

This will test:
- ✓ Module imports
- ✓ ThreadPoolExecutor functionality
- ✓ Async classification
- ✓ Browser initialization
- ✓ Real page scanning
- ✓ Resource cleanup

---

## Recent Fixes Applied

### 1. Fixed `asyncio.get_event_loop()` Issue

**Problem:** In Python 3.10+, `get_event_loop()` can cause crashes.

**Fix:** Updated [classifier.py:124-134](backend/scanner/classifier.py#L124-L134) to use:
```python
try:
    loop = asyncio.get_running_loop()
except RuntimeError:
    loop = asyncio.get_event_loop()
```

### 2. Added Better Error Handling

**Problem:** Vague error messages made debugging difficult.

**Fix:** Enhanced error handling in [parallel.py:147-161](backend/scanner/parallel.py#L147-L161) to:
- Log detailed error messages
- Provide specific failure reasons
- Return early on critical errors

### 3. Added Backend Test Script

**Problem:** No easy way to verify backend functionality.

**Fix:** Created [test-backend.py](test-backend.py) for quick testing.

---

## Common Issues

### Issue: "Module not found" errors

**Solution:** Make sure you're in the virtual environment:
```bash
source .venv/bin/activate
```

### Issue: "Browser failed to start"

**Solution:** Install Playwright browsers:
```bash
python -m playwright install firefox
# or for chromium
python -m playwright install chromium
```

### Issue: "Port 8000 already in use"

**Solution:** Kill existing process or use different port:
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or change port in start-backend.sh
python -m uvicorn backend.main:app --reload --port 8001
# Then update frontend backendUrl in src/lib/DeepScanner.js
```

### Issue: Backend starts but crashes during scan

**Check logs:** Look for error messages in terminal.

**Common causes:**
- Invalid URL (must include http:// or https://)
- Network connectivity issues
- Page timeout (increase PAGE_TIMEOUT in backend/config.py)
- Memory issues (reduce MAX_CONCURRENT_PAGES)

---

## Configuration

### Backend Configuration

Edit [backend/config.py](backend/config.py):

```python
# Scanning configuration
MAX_CONCURRENT_PAGES: int = 50    # Max parallel pages
PAGE_TIMEOUT: int = 30000         # 30 seconds per page
BROWSER_TYPE: str = "firefox"     # or "chromium"
HEADLESS: bool = True             # Run browser in background
```

### Frontend Configuration

Edit [src/lib/DeepScanner.js](src/lib/DeepScanner.js):

```javascript
this.options = {
  backendUrl: 'http://localhost:8000',  // Backend API URL
  maxPages: 100,
  maxDepth: 3,
  concurrency: 20
};
```

---

## Debug Mode

### Enable Verbose Logging

```bash
# Set log level to DEBUG
export LOG_LEVEL=DEBUG

# Start backend
./start-backend.sh
```

### Check Backend Logs

The terminal running the backend will show:
- Request logs
- Scan progress
- Error messages
- Performance metrics

---

## Still Having Issues?

1. **Run the test script:** `python test-backend.py`
2. **Check browser installation:** `python -m playwright install --help`
3. **Verify dependencies:** `pip install -r requirements.txt`
4. **Check Python version:** `python --version` (should be 3.8+)
5. **Review backend logs** for specific error messages

---

## Success Checklist

Before running a deep scan, verify:

- ✅ Virtual environment activated
- ✅ Backend server running (http://localhost:8000/api/health returns healthy)
- ✅ Frontend dev server running (npm run dev)
- ✅ Browser (Firefox/Chromium) installed via Playwright
- ✅ Valid URL with http:// or https:// prefix

---

## Performance Tips

### For Large Scans (>1000 pages)

```python
# In backend/config.py, adjust:
MAX_CONCURRENT_PAGES: int = 20    # Lower concurrency for stability
PAGE_TIMEOUT: int = 60000         # Increase timeout for slow sites
BATCH_SIZE: int = 50              # Smaller batches for memory efficiency
```

### For Slow Networks

```python
PAGE_TIMEOUT: int = 60000         # 60 seconds
MAX_CONCURRENT_PAGES: int = 5     # Fewer concurrent requests
```

### For Fast Networks

```python
PAGE_TIMEOUT: int = 15000         # 15 seconds
MAX_CONCURRENT_PAGES: int = 50    # More concurrent requests
```

---

## Contact & Support

- Check [README.md](README.md) for setup instructions
- Review [PARALLEL_EXECUTION_TECH.md](docs/PARALLEL_EXECUTION_TECH.md) for architecture details
- See [FEATURES.md](FEATURES.md) for feature documentation
