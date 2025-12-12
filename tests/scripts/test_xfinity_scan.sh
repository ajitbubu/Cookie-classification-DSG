#!/bin/bash
# Test deep scan of xfinity.com with 100 pages

echo "🚀 Starting Deep Scan Test"
echo "=========================="
echo ""
echo "Target: https://xfinity.com"
echo "Max Pages: 100"
echo "Concurrency: 20"
echo "Max Depth: 3"
echo ""
echo "⏱️  This will take 2-5 minutes..."
echo ""

START_TIME=$(date +%s)

# Start the scan
curl -s -X POST http://localhost:8001/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://xfinity.com",
    "scanType": "deep",
    "maxPages": 100,
    "concurrency": 20,
    "maxDepth": 3
  }' > /tmp/xfinity_scan_result.json

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "✅ Scan Complete!"
echo "================="
echo ""
echo "⏱️  Duration: ${DURATION} seconds"
echo ""

# Parse results
TOTAL_PAGES=$(cat /tmp/xfinity_scan_result.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('totalPagesScanned', 0))" 2>/dev/null)
TOTAL_COOKIES=$(cat /tmp/xfinity_scan_result.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('totalCount', 0))" 2>/dev/null)
DOMAIN=$(cat /tmp/xfinity_scan_result.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('domain', 'unknown'))" 2>/dev/null)
MAX_DEPTH=$(cat /tmp/xfinity_scan_result.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('maxDepthReached', 0))" 2>/dev/null)

if [ -z "$TOTAL_PAGES" ] || [ "$TOTAL_PAGES" = "0" ]; then
    echo "❌ Scan failed"
    echo ""
    cat /tmp/xfinity_scan_result.json | python3 -m json.tool 2>&1 | head -30
    exit 1
fi

echo "📊 Results:"
echo "   Domain: $DOMAIN"
echo "   Pages Scanned: $TOTAL_PAGES / 100"
echo "   Unique Cookies: $TOTAL_COOKIES"
echo "   Max Depth Reached: $MAX_DEPTH"
echo "   Scan Speed: $(echo "scale=2; $TOTAL_PAGES / $DURATION" | bc) pages/sec"
echo ""

# Cookie breakdown
echo "🍪 Cookie Categories:"
cat /tmp/xfinity_scan_result.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
categories = data.get('statistics', {}).get('byCategory', {})
if categories:
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f'   {cat}: {count}')
else:
    print('   No categories found')
" 2>/dev/null

echo ""
echo "📄 Sample Pages (first 10):"
cat /tmp/xfinity_scan_result.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, page in enumerate(data.get('pageResults', [])[:10], 1):
    cookies = page.get('cookieCount', 0)
    url = page.get('url', 'unknown')
    # Truncate long URLs
    if len(url) > 80:
        url = url[:77] + '...'
    print(f'   {i:2d}. [{cookies:2d} cookies] {url}')
" 2>/dev/null

echo ""
echo "💾 Full results saved to: /tmp/xfinity_scan_result.json"
echo ""

if [ "$TOTAL_PAGES" -ge 90 ]; then
    echo "✅ SUCCESS: Scanned $TOTAL_PAGES pages (target: 100)"
elif [ "$TOTAL_PAGES" -ge 50 ]; then
    echo "⚠️  PARTIAL: Scanned $TOTAL_PAGES pages (target: 100)"
    echo "   This is normal - some sites have fewer discoverable pages"
else
    echo "⚠️  LOW: Only scanned $TOTAL_PAGES pages (target: 100)"
    echo "   Check if site has robots.txt restrictions or limited links"
fi

echo ""
