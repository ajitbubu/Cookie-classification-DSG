#!/bin/bash
# Simple Deep Scan Test with example.com

echo "======================================================================"
echo "Deep Scan Test - Simple Site (example.com)"
echo "======================================================================"
echo ""
echo "Target:      https://exlservicedev.prod.acquia-sites.com"
echo "Max Pages:   50"
echo "Concurrency: 2"
echo "Max Depth:  "
echo ""
echo "🚀 Starting deep scan..."
echo "----------------------------------------------------------------------"

curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://exlservicedev.prod.acquia-sites.com",
    "scanType": "deep",
    "maxPages": 50,
    "concurrency": 2,
    "maxDepth": 2
  }' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "======================================================================"
echo "✅ Test complete!"
echo "======================================================================"
