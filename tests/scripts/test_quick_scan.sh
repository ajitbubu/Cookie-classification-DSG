#!/bin/bash
# Simple Quick Scan Test

echo "======================================================================"
echo "Quick Scan Test"
echo "======================================================================"
echo ""
echo "Target: https://exlservicedev.prod.acquia-sites.com"
echo ""
echo "🚀 Starting quick scan..."
echo "----------------------------------------------------------------------"

curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://exlservicedev.prod.acquia-sites.com",
    "scanType": "quick",
    "maxPages": 20,
    "concurrency": 3,
    "maxDepth": 5
  }' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "======================================================================"
echo "✅ Test complete!"
echo "======================================================================"
