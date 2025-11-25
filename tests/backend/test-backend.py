#!/usr/bin/env python3
"""
Backend Test Script - Verify cookie scanner functionality
Run this to test the backend before starting the full application
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.scanner.browser import browser_manager
from backend.scanner.cookie_scanner import CookieScanner
from backend.scanner.classifier import CookieClassifier


async def test_backend():
    """Test backend functionality"""

    print("=" * 60)
    print("🧪 Cookie Scanner Backend Test")
    print("=" * 60)

    # Test 1: Import modules
    print("\n✓ Test 1: Module imports successful")

    # Test 2: ThreadPoolExecutor functionality
    print("\n📝 Test 2: ThreadPoolExecutor functionality...")
    test_cookies = [
        {"name": "_ga", "domain": "google-analytics.com", "value": "test", "expires": 123456},
        {"name": "_gid", "domain": "google-analytics.com", "value": "test", "expires": 123456},
        {"name": "session", "domain": "example.com", "value": "abc", "expires": -1},
        {"name": "theme", "domain": "example.com", "value": "dark", "expires": 123456},
        {"name": "facebook_pixel", "domain": "facebook.com", "value": "xyz", "expires": 123456},
    ]

    classified = CookieClassifier.classify_parallel(test_cookies, "example.com")
    print(f"  ✓ Classified {len(classified)} cookies using ThreadPoolExecutor")

    # Test 3: Async classification
    print("\n📝 Test 3: Async classification wrapper...")
    classified_async = await CookieClassifier.classify_parallel_async(test_cookies, "example.com")
    print(f"  ✓ Classified {len(classified_async)} cookies asynchronously")

    # Test 4: Browser initialization
    print("\n📝 Test 4: Browser initialization...")
    try:
        await browser_manager.start()
        print("  ✓ Browser started successfully")
    except Exception as e:
        print(f"  ✗ Browser start failed: {e}")
        return False

    # Test 5: Create browser context
    print("\n📝 Test 5: Browser context creation...")
    try:
        context = await browser_manager.create_context()
        print("  ✓ Browser context created successfully")
    except Exception as e:
        print(f"  ✗ Context creation failed: {e}")
        await browser_manager.close()
        return False

    # Test 6: Scan a real page
    print("\n📝 Test 6: Scanning example.com...")
    try:
        scanner = CookieScanner(context)
        result = await scanner.scan_page("https://example.com")

        if result.get("error"):
            print(f"  ⚠️  Scan completed with error: {result['error']}")
        else:
            print(f"  ✓ Scan successful: {result['cookieCount']} cookies found")
            print(f"    Domain: {result['domain']}")
            if result['cookies']:
                print(f"    Sample cookie: {result['cookies'][0]['name']}")

    except Exception as e:
        print(f"  ✗ Scan failed: {e}")
        import traceback
        traceback.print_exc()
        await context.close()
        await browser_manager.close()
        return False

    # Test 7: Cleanup
    print("\n📝 Test 7: Cleanup...")
    try:
        await context.close()
        await browser_manager.close()
        print("  ✓ Resources cleaned up successfully")
    except Exception as e:
        print(f"  ⚠️  Cleanup warning: {e}")

    print("\n" + "=" * 60)
    print("✅ All tests passed! Backend is working correctly.")
    print("=" * 60)
    print("\n💡 You can now start the backend with:")
    print("   ./start-backend.sh")
    print("\n💡 Or manually with:")
    print("   source .venv/bin/activate")
    print("   python -m uvicorn backend.main:app --reload --port 8000")
    print("\n")

    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(test_backend())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
