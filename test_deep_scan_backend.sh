#!/bin/bash
# Test Deep Scan Backend

echo "======================================================================"
echo "Deep Scan Backend Test"
echo "======================================================================"
echo ""
echo "Target: https://example.com (3 pages, depth 1)"
echo ""
echo "🚀 Starting deep scan stream..."
echo "----------------------------------------------------------------------"

curl -N -X POST http://localhost:8001/api/scan-stream \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "scanType": "deep",
    "maxPages": 3,
    "concurrency": 2,
    "maxDepth": 1
  }' 2>&1 &

CURL_PID=$!

# Wait for 60 seconds
sleep 60

# Kill curl if still running
kill $CURL_PID 2>/dev/null
wait $CURL_PID 2>/dev/null

echo ""
echo "======================================================================"
echo "✅ Test complete!"
echo "======================================================================"
