# Cookie Scanner API Endpoints Documentation

## Service Overview

The Cookie Scanner system consists of multiple microservices:

| Service | Port | Container | Description |
|---------|------|-----------|-------------|
| **Frontend** | 5173 | cookie-scanner-frontend | React/Vite web interface |
| **API Gateway** | 8000 | cookie-scanner-api | Main API for scanning |
| **ML API** | 8001 | cookie-scanner-ml-api | ML classification service |
| **PostgreSQL** | 5432 | cookie-scanner-db | Database |
| **Redis** | 6379 | cookie-scanner-redis | Cache & queue |
| **Nginx** | 80/443 | cookie-scanner-nginx | Load balancer |

---

## Base URLs

### Local Development
```
Frontend:    http://localhost:5173
API Gateway: http://localhost:8000
ML API:      http://localhost:8001
```

### Production (via Nginx)
```
Frontend:    https://yourdomain.com
API:         https://yourdomain.com/api
ML API:      https://yourdomain.com/api/v1/ml
```

---

## 1. API Gateway Endpoints (Port 8000)

Base URL: `http://localhost:8000/api`

### 1.1 Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-12T22:30:00.000Z",
  "version": "1.0.0"
}
```

---

### 1.2 Scan Website (Streaming)
```http
POST /api/scan-stream
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "scanType": "deep",
  "maxPages": 100,
  "concurrency": 20,
  "maxDepth": 500
}
```

**Response:** Server-Sent Events (SSE) stream
```
event: progress
data: {"current": 10, "total": 100, "status": "scanning"}

event: complete
data: {"cookies": [...], "statistics": {...}}
```

**Parameters:**
- `url` (required): Website URL to scan
- `scanType` (optional): "quick" or "deep" (default: "quick")
- `maxPages` (optional): Maximum pages to scan (default: 100)
- `concurrency` (optional): Concurrent pages (default: 20)
- `maxDepth` (optional): Maximum crawl depth (default: 500)

---

### 1.3 Scan Website (Standard)
```http
POST /api/scan
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "scanType": "quick",
  "maxPages": 1,
  "concurrency": 1,
  "maxDepth": 1
}
```

**Response:**
```json
{
  "domain": "example.com",
  "scannedUrl": "https://example.com",
  "totalCount": 15,
  "cookies": [
    {
      "name": "_ga",
      "domain": ".example.com",
      "value": "GA1.2.123456789.1234567890",
      "path": "/",
      "expires": "2026-12-12T00:00:00.000Z",
      "size": 45,
      "httpOnly": false,
      "secure": true,
      "sameSite": "Lax",
      "category": "Analytics",
      "purpose": "Google Analytics tracking",
      "requiresConsent": true,
      "isThirdParty": true,
      "type": "persistent"
    }
  ],
  "statistics": {
    "byCategory": {
      "Analytics": 5,
      "Marketing": 3,
      "Functional": 4,
      "Strictly Necessary": 3
    },
    "byType": {
      "persistent": 10,
      "session": 5
    },
    "requiresConsent": 8,
    "thirdParty": 6,
    "totalSize": 2048
  },
  "scanType": "quick",
  "scannedAt": "2025-12-12T22:30:00.000Z"
}
```

---

### 1.4 Update Cookie Category
```http
POST /api/update-category
Content-Type: application/json
```

**Request Body:**
```json
{
  "scanId": "scan_123456",
  "cookieName": "_ga",
  "cookieDomain": ".example.com",
  "newCategory": "Analytics",
  "reason": "User correction"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "updatedCookie": {
    "name": "_ga",
    "domain": ".example.com",
    "category": "Analytics",
    "updatedAt": "2025-12-12T22:30:00.000Z"
  }
}
```

---

### 1.5 Get Category History
```http
GET /api/category-history/{scan_id}
```

**Response:**
```json
{
  "scanId": "scan_123456",
  "history": [
    {
      "cookieName": "_ga",
      "oldCategory": "Uncategorized",
      "newCategory": "Analytics",
      "changedAt": "2025-12-12T22:30:00.000Z",
      "changedBy": "user",
      "reason": "User correction"
    }
  ]
}
```

---

### 1.6 Get Available Categories
```http
GET /api/available-categories
```

**Response:**
```json
{
  "categories": [
    {
      "name": "Strictly Necessary",
      "description": "Essential for website functionality",
      "requiresConsent": false
    },
    {
      "name": "Functional",
      "description": "Enhance user experience",
      "requiresConsent": true
    },
    {
      "name": "Analytics",
      "description": "Track website usage and performance",
      "requiresConsent": true
    },
    {
      "name": "Marketing",
      "description": "Track users across websites for advertising",
      "requiresConsent": true
    }
  ]
}
```

---

### 1.7 Bulk Update Categories
```http
POST /api/bulk-update-categories
Content-Type: application/json
```

**Request Body:**
```json
{
  "updates": [
    {
      "scanId": "scan_123456",
      "cookieName": "_ga",
      "cookieDomain": ".example.com",
      "newCategory": "Analytics"
    },
    {
      "scanId": "scan_123456",
      "cookieName": "_fbp",
      "cookieDomain": ".facebook.com",
      "newCategory": "Marketing"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "updated": 2,
  "failed": 0,
  "results": [
    {
      "cookieName": "_ga",
      "status": "updated"
    },
    {
      "cookieName": "_fbp",
      "status": "updated"
    }
  ]
}
```

---

## 2. ML Classification API Endpoints (Port 8001)

Base URL: `http://localhost:8001/api/v1/ml`

### 2.1 Classify Cookies
```http
POST /api/v1/ml/classify
Content-Type: application/json
```

**Request Body:**
```json
{
  "cookies": [
    {
      "id": "_ga-example.com",
      "name": "_ga",
      "domain": ".example.com",
      "path": "/",
      "expiry_days": 730,
      "http_only": false,
      "secure": true,
      "same_site": "Lax",
      "value_sample": "GA1.2.123456789.1234567890"
    }
  ],
  "options": {
    "return_explanation": true,
    "find_similar": true,
    "confidence_threshold": 0.65
  }
}
```

**Response:**
```json
{
  "classifications": [
    {
      "cookie_id": "_ga-example.com",
      "predicted_category": "Analytics",
      "confidence_score": 0.92,
      "confidence_level": "High",
      "auto_classified": true,
      "requires_review": false,
      "alternative_predictions": [
        {
          "category": "Marketing",
          "probability": 0.05
        },
        {
          "category": "Functional",
          "probability": 0.03
        }
      ],
      "explanation": {
        "key_features": [
          "Cookie name pattern matches Google Analytics",
          "Domain is third-party",
          "Long expiry period (730 days)",
          "Value contains GA tracking ID"
        ],
        "confidence_factors": {
          "name_match": 0.95,
          "domain_match": 0.88,
          "expiry_match": 0.92,
          "value_pattern": 0.90
        }
      },
      "vendor_info": {
        "name": "Google Analytics",
        "category": "Analytics",
        "privacy_policy": "https://policies.google.com/privacy"
      },
      "similar_cookies": [
        {
          "name": "_gid",
          "similarity_score": 0.95,
          "category": "Analytics"
        }
      ],
      "model_version": "2.0.0",
      "classified_at": "2025-12-12T22:30:00.000Z",
      "processing_time_ms": 24.5
    }
  ],
  "summary": {
    "total_cookies": 1,
    "high_confidence": 1,
    "medium_confidence": 0,
    "low_confidence": 0,
    "requires_review": 0,
    "processing_time_ms": 24.5
  },
  "model_info": {
    "version": "2.0.0",
    "trained_at": "2025-12-01T00:00:00.000Z",
    "accuracy": 0.94,
    "categories": [
      "Strictly Necessary",
      "Functional",
      "Analytics",
      "Marketing"
    ]
  }
}
```

**Options:**
- `return_explanation` (boolean): Include detailed explanation (default: false)
- `find_similar` (boolean): Find similar cookies (default: false)
- `confidence_threshold` (float): Minimum confidence (default: 0.65)

---

### 2.2 ML Health Check
```http
GET /api/v1/ml/health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "2.0.0",
  "cache_status": "connected",
  "database_status": "connected",
  "uptime_seconds": 3600,
  "timestamp": "2025-12-12T22:30:00.000Z"
}
```

---

### 2.3 Get Model Info
```http
GET /api/v1/ml/model-info
```

**Response:**
```json
{
  "version": "2.0.0",
  "trained_at": "2025-12-01T00:00:00.000Z",
  "training_samples": 50000,
  "accuracy": 0.94,
  "precision": 0.92,
  "recall": 0.91,
  "f1_score": 0.915,
  "categories": [
    "Strictly Necessary",
    "Functional",
    "Analytics",
    "Marketing"
  ],
  "features": [
    "cookie_name",
    "domain",
    "path",
    "expiry_days",
    "http_only",
    "secure",
    "same_site",
    "value_pattern"
  ],
  "algorithm": "XGBoost",
  "hyperparameters": {
    "max_depth": 10,
    "learning_rate": 0.1,
    "n_estimators": 200
  }
}
```

---

### 2.4 Submit Feedback
```http
POST /api/v1/ml/feedback
Content-Type: application/json
```

**Request Body:**
```json
{
  "cookie_id": "_ga-example.com",
  "predicted_category": "Analytics",
  "actual_category": "Analytics",
  "confidence_score": 0.92,
  "is_correct": true,
  "user_comment": "Correct classification",
  "cookie_details": {
    "name": "_ga",
    "domain": ".example.com",
    "expiry_days": 730
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback recorded successfully",
  "feedback_id": "fb_123456",
  "will_retrain": false,
  "next_training_date": "2025-12-20T00:00:00.000Z"
}
```

---

### 2.5 Get Similar Cookies
```http
GET /api/v1/ml/similar-cookies/{cookie_id}?limit=10
```

**Response:**
```json
{
  "cookie_id": "_ga-example.com",
  "similar_cookies": [
    {
      "cookie_id": "_gid-example.com",
      "name": "_gid",
      "domain": ".example.com",
      "category": "Analytics",
      "similarity_score": 0.95,
      "confidence": 0.90
    },
    {
      "cookie_id": "_gat-example.com",
      "name": "_gat",
      "domain": ".example.com",
      "category": "Analytics",
      "similarity_score": 0.88,
      "confidence": 0.85
    }
  ],
  "total_found": 2
}
```

---

### 2.6 Get Metrics
```http
GET /api/v1/ml/metrics?start_date=2025-12-01&end_date=2025-12-12
```

**Response:**
```json
{
  "period": {
    "start": "2025-12-01T00:00:00.000Z",
    "end": "2025-12-12T23:59:59.999Z"
  },
  "total_classifications": 10000,
  "by_confidence": {
    "high": 7000,
    "medium": 2000,
    "low": 1000
  },
  "by_category": {
    "Analytics": 4000,
    "Marketing": 3000,
    "Functional": 2000,
    "Strictly Necessary": 1000
  },
  "accuracy_metrics": {
    "overall_accuracy": 0.94,
    "precision": 0.92,
    "recall": 0.91,
    "f1_score": 0.915
  },
  "performance": {
    "avg_processing_time_ms": 25.5,
    "p95_processing_time_ms": 45.2,
    "p99_processing_time_ms": 78.9
  },
  "feedback": {
    "total_feedback": 500,
    "correct_predictions": 470,
    "incorrect_predictions": 30,
    "user_satisfaction": 0.94
  }
}
```

---

### 2.7 Check Model Drift
```http
POST /api/v1/ml/drift/check
Content-Type: application/json
```

**Request Body:**
```json
{
  "recent_predictions": [
    {
      "cookie_id": "_ga-example.com",
      "predicted_category": "Analytics",
      "confidence": 0.92
    }
  ],
  "threshold": 0.1
}
```

**Response:**
```json
{
  "drift_detected": false,
  "drift_score": 0.05,
  "threshold": 0.1,
  "recommendation": "No action needed",
  "details": {
    "feature_drift": {
      "cookie_name": 0.02,
      "domain": 0.03,
      "expiry_days": 0.04
    },
    "prediction_drift": {
      "Analytics": 0.01,
      "Marketing": 0.02
    }
  },
  "checked_at": "2025-12-12T22:30:00.000Z"
}
```

---

### 2.8 Get Drift Status
```http
GET /api/v1/ml/drift/status?days=7
```

**Response:**
```json
{
  "period_days": 7,
  "drift_detected": false,
  "drift_score": 0.05,
  "trend": "stable",
  "history": [
    {
      "date": "2025-12-12",
      "drift_score": 0.05,
      "status": "normal"
    },
    {
      "date": "2025-12-11",
      "drift_score": 0.04,
      "status": "normal"
    }
  ],
  "last_check": "2025-12-12T22:30:00.000Z"
}
```

---

## 3. Frontend API Calls

The frontend (React app) makes the following API calls:

### 3.1 Quick Scan (Current Page)
```javascript
// Uses browser's document.cookie
const scanner = new CookieScanner();
const results = scanner.scan();
```

### 3.2 Quick Scan (Remote URL)
```javascript
const response = await fetch('http://localhost:8001/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    scanType: 'quick',
    maxPages: 1,
    concurrency: 1,
    maxDepth: 1
  })
});
const results = await response.json();
```

### 3.3 Deep Scan
```javascript
const response = await fetch('http://localhost:8001/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    scanType: 'deep',
    maxPages: 100,
    concurrency: 20,
    maxDepth: 500
  })
});
// Handle SSE stream for progress updates
```

### 3.4 ML Classification
```javascript
const response = await fetch('http://localhost:8001/api/v1/ml/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cookies: cookies.map(cookie => ({
      id: `${cookie.name}-${cookie.domain}`,
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path || '/',
      expiry_days: cookie.expiry_days,
      http_only: cookie.httpOnly || false,
      secure: cookie.secure || false,
      same_site: cookie.sameSite,
      value_sample: cookie.value ? cookie.value.substring(0, 50) : ''
    })),
    options: {
      return_explanation: false,
      find_similar: false
    }
  })
});
const data = await response.json();
```

---

## 4. Rate Limiting

### API Gateway (Port 8000)
- **Rate Limit**: 100 requests per minute per IP
- **Burst**: 20 requests
- **Headers**: 
  - `X-RateLimit-Limit`: Total limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

### ML API (Port 8001)
- **Rate Limit**: 100 requests per 60 seconds
- **Burst**: 10 requests
- **Response on limit exceeded**:
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 30,
  "limit": 100,
  "window": 60
}
```

---

## 5. Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid URL format",
  "details": {
    "field": "url",
    "issue": "Must be a valid HTTP/HTTPS URL"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "API key required"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate Limit Exceeded",
  "message": "Too many requests",
  "retry_after": 30
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "request_id": "req_123456"
}
```

---

## 6. Authentication (Optional)

For production deployments, add API key authentication:

### Header
```http
Authorization: Bearer YOUR_API_KEY
```

### Example
```bash
curl -X POST http://localhost:8000/api/scan \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## 7. WebSocket Support (Future)

For real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8000/api/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Scan progress:', data);
};

ws.send(JSON.stringify({
  action: 'scan',
  url: 'https://example.com'
}));
```

---

## 8. Postman Collection

Import this collection to test all endpoints:

```json
{
  "info": {
    "name": "Cookie Scanner API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:8000/api/health"
      }
    },
    {
      "name": "Scan Website",
      "request": {
        "method": "POST",
        "url": "http://localhost:8000/api/scan",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"url\": \"https://example.com\", \"scanType\": \"quick\"}"
        }
      }
    },
    {
      "name": "ML Classify",
      "request": {
        "method": "POST",
        "url": "http://localhost:8001/api/v1/ml/classify",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"cookies\": [{\"id\": \"_ga-example.com\", \"name\": \"_ga\", \"domain\": \".example.com\"}]}"
        }
      }
    }
  ]
}
```

---

## 9. Testing with cURL

### Scan a website
```bash
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://google.com",
    "scanType": "quick",
    "maxPages": 1
  }'
```

### Classify cookies
```bash
curl -X POST http://localhost:8001/api/v1/ml/classify \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [
      {
        "id": "_ga-google.com",
        "name": "_ga",
        "domain": ".google.com",
        "path": "/",
        "expiry_days": 730,
        "http_only": false,
        "secure": true,
        "same_site": "Lax"
      }
    ]
  }'
```

---

## 10. Docker Service URLs

When running in Docker:

```bash
# From host machine
Frontend:    http://localhost:5173
API Gateway: http://localhost:8000
ML API:      http://localhost:8001

# From within Docker network
Frontend:    http://frontend:3000
API Gateway: http://api-gateway:8000
ML API:      http://ml-api:8000
Redis:       redis://redis:6379
PostgreSQL:  postgresql://scanner:password@postgres:5432/cookie_scanner
```

---

## Support

For issues or questions:
- GitHub Issues: [Your Repo URL]
- Documentation: [Your Docs URL]
- Email: support@yourdomain.com
