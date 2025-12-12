#!/usr/bin/env python3
"""
Test Deep Scan with Streaming (simplified)
"""

import requests
import json
import time

def test_streaming_scan():
    print("=" * 70)
    print("Deep Scan Streaming Test - Simple")
    print("=" * 70)
    print()

    # Simple configuration
    test_url = "https://example.com"
    max_pages = 3
    concurrency = 2
    max_depth = 1

    print(f"Target URL:    {test_url}")
    print(f"Max Pages:     {max_pages}")
    print(f"Concurrency:   {concurrency}")
    print(f"Max Depth:     {max_depth}")
    print()

    scan_request = {
        "url": test_url,
        "scanType": "deep",
        "maxPages": max_pages,
        "concurrency": concurrency,
        "maxDepth": max_depth
    }

    print("🚀 Starting streaming deep scan...")
    print("-" * 70)

    start_time = time.time()

    try:
        response = requests.post(
            "http://localhost:8000/api/scan-stream",
            json=scan_request,
            stream=True,
            timeout=60
        )

        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return

        print("✅ Connected to stream!")
        print()
        print("📊 Progress Updates:")
        print("-" * 70)

        for line in response.iter_lines():
            if not line:
                continue

            line = line.decode('utf-8')

            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])

                    event_type = data.get('type', 'unknown')

                    if event_type == 'progress':
                        current = data.get('current', 0)
                        total = data.get('total', max_pages)
                        status = data.get('status', 'scanning')
                        message = data.get('message', '')

                        elapsed = time.time() - start_time
                        print(f"[{elapsed:6.1f}s] Progress: {current}/{total} | {status} | {message}")

                    elif event_type == 'complete':
                        print()
                        print("=" * 70)
                        print("✅ Scan Complete!")
                        print("=" * 70)

                        result = data.get('result', {})
                        total_cookies = result.get('totalCount', 0)
                        pages_scanned = len(result.get('pageResults', []))

                        print(f"\n📈 Results:")
                        print(f"  Pages Scanned:  {pages_scanned}")
                        print(f"  Total Cookies:  {total_cookies}")
                        print(f"  Scan Duration:  {time.time() - start_time:.1f}s")

                        # Show pages
                        if result.get('pageResults'):
                            print(f"\n  Pages:")
                            for page in result['pageResults']:
                                url = page.get('url', 'N/A')
                                cookies = page.get('cookieCount', 0)
                                print(f"    - {url} ({cookies} cookies)")

                        print()

                    elif event_type == 'error':
                        print(f"\n❌ Error: {data.get('message', 'Unknown error')}")

                except json.JSONDecodeError as e:
                    print(f"⚠️  JSON decode error: {e}")
                    print(f"   Line: {line}")

        elapsed = time.time() - start_time
        print(f"\n⏱️  Total time: {elapsed:.1f}s")
        print("=" * 70)

    except requests.exceptions.Timeout:
        print("❌ Request timeout")
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - is the backend running on port 8000?")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    test_streaming_scan()
