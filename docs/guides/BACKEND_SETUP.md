# Python Backend Setup Guide

## Overview

The Cookie Scanner now includes a Python backend for server-side parallel cookie scanning using FastAPI, Playwright, and asyncio.

## Prerequisites

- Python 3.9 or higher
- Virtual environment (already set up in `.venv`)

## Installation

### 1. Install Python Dependencies

```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Install Playwright Browsers

```bash
# Install Firefox browser for Playwright
playwright install firefox

# Or install Chromium
playwright install chromium
```

## Configuration

Edit `.env` file to configure the backend:

```env
# Backend Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# CORS - Frontend URLs
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Scanning Configuration
MAX_CONCURRENT_PAGES=5
MAX_PAGES_PER_SCAN=50
PAGE_TIMEOUT=30000

# Browser Configuration
BROWSER_TYPE=firefox  # or chromium
HEADLESS=true
```

## Running the Backend

### Option 1: Using the Startup Script

```bash
./start-backend.sh
```

### Option 2: Manual Start

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000
```

The backend will start on `http://localhost:8000`

## API Endpoints

### Health Check

```bash
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T14:19:05.671720",
  "version": "1.0.0"
}
```

### Scan Website (Streaming)

```bash
POST /api/scan-stream
Content-Type: application/json

{
  "url": "https://example.com",
  "scanType": "deep",
  "maxPages": 10,
  "concurrency": 5
}
```

**Response:** Server-Sent Events (SSE) stream with real-time progress updates

**Progress Event Example:**
```json
{
  "type": "progress",
  "current": 5,
  "total": 10,
  "currentBatch": 2,
  "totalBatches": 3,
  "currentUrl": "https://example.com/page",
  "activeScanUrls": ["url1", "url2", "url3"],
  "status": "scanning"
}
```

**Complete Event Example:**
```json
{
  "type": "complete",
  "result": {
    "scanType": "deep",
    "domain": "example.com",
    "scannedUrl": "https://example.com",
    "cookies": [...],
    "totalCount": 25,
    "statistics": {...},
    "pageResults": [...]
  }
}
```

### Scan Website (Non-Streaming)

```bash
POST /api/scan
Content-Type: application/json

{
  "url": "https://example.com",
  "scanType": "quick",
  "maxPages": 1,
  "concurrency": 1
}
```

**Response:** Complete scan result as JSON

## Testing the Backend

### 1. Test Health Endpoint

```bash
curl http://localhost:8000/api/health
```

### 2. Test Quick Scan

```bash
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "scanType": "quick",
    "maxPages": 1,
    "concurrency": 1
  }'
```

### 3. Test SSE Streaming

```bash
curl -N -X POST http://localhost:8000/api/scan-stream \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "scanType": "deep",
    "maxPages": 5,
    "concurrency": 3
  }'
```

## Architecture

```
Backend Structure:
cookie-scanner/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration settings
│   ├── models.py            # Pydantic models
│   ├── scanner/
│   │   ├── browser.py       # Browser management
│   │   ├── cookie_scanner.py # Core scanning logic
│   │   ├── classifier.py    # Cookie classification
│   │   └── parallel.py      # Parallel execution
│   └── api/
│       ├── routes.py        # API endpoints
│       └── streaming.py     # SSE streaming
├── requirements.txt         # Python dependencies
└── start-backend.sh         # Startup script
```

## Performance

- **Sequential Scanning**: ~500ms per page
- **Parallel Scanning (concurrency=5)**: ~5x faster
- **Recommended Concurrency**: 5-10 pages

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

### Playwright Browser Not Found

```bash
# Reinstall browsers
playwright install firefox
```

### Module Import Errors

Make sure you're running from the project root:

```bash
cd /path/to/cookie-scanner
python -m uvicorn backend.main:app --reload
```

## Next Steps

1. ✅ Backend is running
2. Update frontend to use backend API
3. Test end-to-end integration
4. Deploy to production
