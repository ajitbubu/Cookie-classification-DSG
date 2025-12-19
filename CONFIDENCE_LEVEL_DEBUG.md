# Confidence Level Debugging Guide

## Issue
All confidence badges showing "Low" instead of varied levels (High/Medium/Low).

## Confidence Level Thresholds

### Backend (ML API)
Defined in `backend/api/ml_classifier/config.py`:
- **High**: >= 0.85 (85%)
- **Medium**: >= 0.65 (65%)
- **Low**: < 0.65 (< 65%)

### Frontend (Mock Data)
Defined in `src/App.jsx` when ML API fails:
- **High**: >= 0.85 (85%)
- **Medium**: >= 0.65 (65%)
- **Low**: < 0.65 (< 65%)

## How to Debug

### Step 1: Check Browser Console
Open browser DevTools (F12) and look for these logs:

```
🤖 Calling ML API for X cookies...
✅ ML API Response: {...}
Sample classification: {...}
All classifications: [{category, confidence, level}, ...]
```

### Step 2: Verify ML API Response
The console should show something like:
```javascript
All classifications: [
  { category: 'Analytics', confidence: 0.92, level: 'High' },
  { category: 'Marketing', confidence: 0.88, level: 'High' },
  { category: 'Functional', confidence: 0.65, level: 'Medium' },
  ...
]
```

### Step 3: Check if ML API is Working
If you see:
```
❌ ML API returned error: 500 Internal Server Error
```
or
```
❌ ML API failed: Error: ...
```

Then the frontend is using mock data.

### Step 4: Test ML API Directly
```bash
curl -X POST http://localhost:8001/api/v1/ml/classify \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [{
      "id": "test",
      "name": "_ga",
      "domain": ".example.com",
      "path": "/",
      "http_only": false,
      "secure": true,
      "same_site": "Lax"
    }],
    "options": {
      "return_explanation": false,
      "find_similar": false
    }
  }'
```

Expected response:
```json
{
  "classifications": [{
    "cookie_id": "test",
    "predicted_category": "Analytics",
    "confidence_score": 0.92,
    "confidence_level": "High",
    ...
  }],
  ...
}
```

## Common Issues

### Issue 1: ML API Not Running
**Symptom:** All badges show "Low", console shows "ML API failed"

**Solution:**
```bash
# Check if ML API container is running
docker ps | grep ml-api

# Check ML API logs
docker logs cookie-scanner-ml-api --tail 50

# Restart ML API
docker restart cookie-scanner-ml-api
```

### Issue 2: Model Not Loaded
**Symptom:** ML API returns 500 error, logs show model loading error

**Solution:**
```bash
# Check if model files exist
ls -la models/v2.0.0/

# Should see:
# - model.pkl
# - label_encoder.pkl
# - feature_names.pkl
# - metadata.json
```

### Issue 3: Low Confidence Predictions
**Symptom:** ML API works but returns low confidence for all cookies

**Possible Causes:**
1. **Model not trained well**: Model v2.0.0 might have low accuracy
2. **Unknown cookies**: Cookies don't match training data patterns
3. **Feature mismatch**: Cookie features don't align with model expectations

**Solution:**
- Check model metadata: `cat models/v2.0.0/metadata.json`
- Look for accuracy score (should be > 0.90)
- Check if cookies are unusual/custom (not common like _ga, _fbp, etc.)

### Issue 4: Mock Data Always Used
**Symptom:** Console shows "Generating mock data for X cookies"

**Causes:**
1. ML API not accessible (wrong URL)
2. ML API returns error
3. Network issue

**Solution:**
```bash
# Test ML API health
curl http://localhost:8001/api/v1/ml/health

# Should return:
# {"status":"healthy","model_loaded":true,"model_version":"2.0.0"}
```

## Mock Data Patterns

When ML API fails, frontend uses pattern matching:

### High Confidence (0.85-0.95)
- `_ga`, `_gid`, `_gat`, `analytics` → Analytics (0.92)
- `_fb`, `ads`, `marketing`, `_gcl` → Marketing (0.88)
- `session`, `csrf`, `auth`, `token` → Strictly Necessary (0.95)

### Medium Confidence (0.65-0.84)
- `pref`, `lang`, `theme`, `settings` → Functional (0.78)

### Low Confidence (0.45-0.64)
- Unknown cookies that don't match patterns

## Testing Scenarios

### Test 1: Scan Google Analytics Site
```
Expected: _ga, _gid cookies with High confidence (0.92)
```

### Test 2: Scan Facebook Integrated Site
```
Expected: _fbp, _fbc cookies with High confidence (0.88)
```

### Test 3: Scan Custom Cookie Site
```
Expected: Varied confidence levels based on ML model
```

## Quick Fix

If all badges show "Low" and you want to test with mock data:

1. **Temporarily disable ML API call:**
```javascript
// In src/App.jsx, comment out the ML API call
// const response = await fetch('http://localhost:8001/api/v1/ml/classify', ...);
// Force mock data
return cookies.map(cookie => { /* mock data logic */ });
```

2. **Scan a site with common cookies:**
- Try: https://google.com (has _ga cookies)
- Try: https://facebook.com (has _fb cookies)

3. **Check if badges now show High/Medium:**
- _ga → High (green)
- _gid → High (green)
- session cookies → High (green)
- pref cookies → Medium (orange)

## Expected Behavior

After scanning a typical website, you should see:
- 🟢 **High** badges (green) for Analytics, Marketing, Strictly Necessary
- 🟠 **Medium** badges (orange) for Functional cookies
- ⚫ **Low** badges (gray) for unknown/custom cookies

## Files to Check

1. `src/App.jsx` - ML API call and mock data logic
2. `backend/api/ml_classifier/config.py` - Confidence thresholds
3. `backend/api/ml_classifier/classifier.py` - ML classification logic
4. `models/v2.0.0/metadata.json` - Model information

## Next Steps

1. Open browser console
2. Scan a website
3. Check the console logs for ML API response
4. Share the console output to diagnose the issue
