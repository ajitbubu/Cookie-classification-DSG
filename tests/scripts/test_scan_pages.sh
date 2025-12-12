#!/bin/bash
# Test to verify how many pages are being scanned

echo "🧪 Testing Deep Scan Page Count"
echo "================================"
echo ""

URL="https://www.google.com"
MAX_PAGES=10

echo "📋 Test Configuration:"
echo "   URL: $URL"
echo "   Max Pages: $MAX_PAGES"
echo "   Backend: http://localhost:8001"
echo ""

echo "🚀 Starting deep scan..."
RESULT=$(curl -s -X POST http://localhost:8001/api/scan \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$URL\",
    \"scanType\": \"deep\",
    \"maxPages\": $MAX_PAGES,
    \"concurrency\": 5,
    \"maxDepth\": 3
  }")

echo ""
echo "📊 Results:"
echo "==========="

# Extract key metrics
TOTAL_PAGES=$(echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('totalPagesScanned', 0))" 2>/dev/null)
PAGE_RESULTS_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('pageResults', [])))" 2>/dev/null)
TOTAL_COOKIES=$(echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('totalCount', 0))" 2>/dev/null)
DOMAIN=$(echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('domain', 'unknown'))" 2>/dev/null)

if [ -z "$TOTAL_PAGES" ] || [ "$TOTAL_PAGES" = "0" ]; then
    echo "❌ Scan failed or returned no results"
    echo ""
    echo "Error details:"
    echo "$RESULT" | python3 -m json.tool 2>&1 | head -20
    exit 1
fi

echo "✅ Scan completed successfully!"
echo ""
echo "   Domain: $DOMAIN"
echo "   Total Pages Scanned: $TOTAL_PAGES"
echo "   Page Results Count: $PAGE_RESULTS_COUNT"
echo "   Total Cookies Found: $TOTAL_COOKIES"
echo ""

if [ "$TOTAL_PAGES" -ge "$MAX_PAGES" ] || [ "$PAGE_RESULTS_COUNT" -ge "$MAX_PAGES" ]; then
    echo "✅ SUCCESS: Scanned $TOTAL_PAGES pages (requested $MAX_PAGES)"
elif [ "$TOTAL_PAGES" -eq 2 ]; then
    echo "❌ ISSUE: Only scanned 2 pages (expected $MAX_PAGES)"
    echo ""
    echo "This suggests the backend is working but frontend might be using old code."
    echo "Try:"
    echo "  1. Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)"
    echo "  2. Clear browser cache"
    echo "  3. Restart frontend: docker restart cookie-scanner-frontend"
else
    echo "⚠️  WARNING: Scanned $TOTAL_PAGES pages (expected $MAX_PAGES)"
fi

echo ""
echo "📄 Page URLs scanned:"
echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, page in enumerate(data.get('pageResults', [])[:10], 1):
    print(f'   {i}. {page.get(\"url\", \"unknown\")}')" 2>/dev/null

echo ""
