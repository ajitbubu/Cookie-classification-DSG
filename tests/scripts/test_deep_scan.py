#!/usr/bin/env python3
"""
Test Deep Scan Functionality
Run a deep scan test with multiple pages
"""

import requests
import json
import time
from datetime import datetime

def test_deep_scan():
    """Test deep scan with streaming progress."""

    print("=" * 70)
    print("Deep Scan Test - Multiple Pages")
    print("=" * 70)
    print()

    # Test configuration
    test_url = "https://www.bbc.com"
    max_pages = 5
    concurrency = 3
    max_depth = 2

    print(f"Target URL:    {test_url}")
    print(f"Max Pages:     {max_pages}")
    print(f"Concurrency:   {concurrency}")
    print(f"Max Depth:     {max_depth}")
    print()

    # Prepare request
    scan_request = {
        "url": test_url,
        "scanType": "deep",
        "maxPages": max_pages,
        "concurrency": concurrency,
        "maxDepth": max_depth
    }

    print("🚀 Starting deep scan...")
    print("-" * 70)

    start_time = time.time()

    try:
        # Use streaming endpoint
        response = requests.post(
            "http://localhost:8000/api/scan-stream",
            json=scan_request,
            stream=True,
            timeout=120
        )

        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return

        # Process SSE stream
        print("\n📊 Progress Updates:")
        print("-" * 70)

        for line in response.iter_lines():
            if not line:
                continue

            line = line.decode('utf-8')

            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])

                    if data.get('type') == 'progress':
                        current = data.get('current', 0)
                        total = data.get('total', max_pages)
                        url = data.get('currentUrl', 'N/A')
                        cookies = data.get('cookieCount', 0)

                        elapsed = time.time() - start_time
                        print(f"[{elapsed:6.1f}s] Page {current}/{total} | Cookies: {cookies:4d} | {url[:50]}...")

                    elif data.get('type') == 'complete':
                        print("\n" + "=" * 70)
                        print("✅ Scan Complete!")
                        print("=" * 70)

                        result = data.get('result', {})
                        total_cookies = result.get('totalCount', 0)
                        pages_scanned = len(result.get('pageResults', []))

                        print(f"\n📈 Results Summary:")
                        print(f"  Pages Scanned:  {pages_scanned}")
                        print(f"  Total Cookies:  {total_cookies}")
                        print(f"  Scan Duration:  {elapsed:.1f} seconds")

                        # Cookie breakdown by category
                        stats = result.get('statistics', {})
                        if stats.get('byCategory'):
                            print(f"\n  Cookies by Category:")
                            for category, count in stats['byCategory'].items():
                                print(f"    - {category:20s}: {count}")

                        # Top pages by cookie count
                        page_results = result.get('pageResults', [])
                        if page_results:
                            print(f"\n  Top Pages by Cookie Count:")
                            sorted_pages = sorted(page_results,
                                                 key=lambda x: x.get('cookieCount', 0),
                                                 reverse=True)[:5]
                            for i, page in enumerate(sorted_pages, 1):
                                url = page.get('url', 'N/A')[:60]
                                count = page.get('cookieCount', 0)
                                print(f"    {i}. {url:60s} ({count} cookies)")

                        print()

                    elif data.get('type') == 'error':
                        print(f"\n❌ Error: {data.get('message', 'Unknown error')}")

                except json.JSONDecodeError:
                    pass

        elapsed = time.time() - start_time
        print(f"\n⏱️  Total time: {elapsed:.1f} seconds")
        print("=" * 70)

    except requests.exceptions.Timeout:
        print("❌ Request timeout - scan took too long")
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - is the backend running on port 8000?")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    test_deep_scan()
