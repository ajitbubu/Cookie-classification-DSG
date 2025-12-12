#!/bin/bash
# Simple Deep Scan Test
# Tests the backend deep scan functionality

echo "======================================================================"
echo "Deep Scan Test - Simple Non-Streaming"
echo "======================================================================"
echo ""
echo "Target:      https://example.com"
echo "Max Pages:   3"
echo "Concurrency: 2"
echo "Max Depth:   2"
echo ""
echo "🚀 Starting deep scan..."
echo "----------------------------------------------------------------------"

# Use non-streaming endpoint for simpler testing
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "scanType": "deep",
    "maxPages": 3,
    "concurrency": 2,
    "maxDepth": 2
  }' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "======================================================================"
echo "✅ Test complete!"
echo "======================================================================"
