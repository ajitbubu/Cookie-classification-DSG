#!/usr/bin/env python3
"""
Test script to verify backend SSE stream is sending correct data
"""
import requests
import json

def test_backend_sse():
    url = "http://localhost:8003/api/scan-stream"
    data = {
        "url": "https://example.com",
        "scanType": "deep",
        "maxPages": 5,
        "concurrency": 2,
        "maxDepth": 3
    }
    
    print(f"Testing backend SSE with {data['maxPages']} pages...")
    print("=" * 50)
    
    try:
        response = requests.post(url, json=data, stream=True)
        response.raise_for_status()
        
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith('data: '):
                try:
                    sse_data = json.loads(line[6:])
                    if sse_data.get('type') == 'progress':
                        current = sse_data.get('current')
                        total = sse_data.get('total')
                        print(f"Progress: Page {current} of {total}")
                    elif sse_data.get('type') == 'complete':
                        result = sse_data.get('result', {})
                        pages_scanned = result.get('totalPagesScanned')
                        print(f"Complete: {pages_scanned} pages scanned")
                        break
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    print(f"Raw line: {line}")
                    
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
    except KeyboardInterrupt:
        print("\nTest interrupted")

if __name__ == "__main__":
    test_backend_sse()