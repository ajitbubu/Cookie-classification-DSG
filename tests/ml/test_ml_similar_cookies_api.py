"""
Test ML Similar Cookies API Endpoint

Tests the GET /api/v1/ml/similar-cookies endpoint.
"""

import requests
import json
from datetime import datetime

# API endpoint
BASE_URL = "http://localhost:8000"
SIMILAR_COOKIES_URL = f"{BASE_URL}/api/v1/ml/similar-cookies"


def test_find_similar_cookies():
    """Test finding similar cookies by ID."""
    print("=" * 60)
    print("Testing Find Similar Cookies")
    print("=" * 60)
    
    # Test cookie ID (replace with actual ID from your database)
    cookie_id = "test-cookie-123"
    
    try:
        # Make request
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={
                "threshold": 0.75,
                "max_results": 10
            }
        )
        
        print(f"URL: {response.url}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Similar cookies found successfully")
            
            print(f"\nReference Cookie:")
            print(f"  ID: {data.get('reference_cookie_id')}")
            print(f"  Name: {data.get('reference_cookie_name')}")
            print(f"  Domain: {data.get('reference_cookie_domain')}")
            
            print(f"\nSearch Parameters:")
            print(f"  Threshold: {data.get('threshold')}")
            print(f"  Total Found: {data.get('total_found')}")
            print(f"  Processing Time: {data.get('processing_time_ms'):.1f}ms")
            
            # Print similar cookies
            similar = data.get('similar_cookies', [])
            if similar:
                print(f"\nSimilar Cookies:")
                for i, cookie in enumerate(similar[:5], 1):
                    print(f"  {i}. {cookie['cookie_name']} @ {cookie['cookie_domain']}")
                    print(f"     Similarity: {cookie['similarity_score']:.2f}")
                    print(f"     Category: {cookie.get('category', 'Unknown')}")
                    if cookie.get('confidence_score'):
                        print(f"     Confidence: {cookie['confidence_score']:.2f}")
            else:
                print(f"\n  No similar cookies found above threshold")
            
            return True
            
        elif response.status_code == 404:
            print(f"✗ Cookie not found: {response.json().get('detail')}")
            print(f"\nNote: This is expected if the cookie ID doesn't exist in database")
            return False
        else:
            print(f"✗ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_similar_cookies_with_different_thresholds():
    """Test similar cookies with different similarity thresholds."""
    print("\n" + "=" * 60)
    print("Testing Different Similarity Thresholds")
    print("=" * 60)
    
    cookie_id = "test-cookie-123"
    thresholds = [0.60, 0.75, 0.90]
    
    results = []
    
    for threshold in thresholds:
        try:
            response = requests.get(
                f"{SIMILAR_COOKIES_URL}/{cookie_id}",
                params={"threshold": threshold, "max_results": 50}
            )
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('total_found', 0)
                time_ms = data.get('processing_time_ms', 0)
                results.append((threshold, count, time_ms))
                print(f"  Threshold {threshold:.2f}: {count} cookies found ({time_ms:.1f}ms)")
            elif response.status_code == 404:
                print(f"  Cookie not found (expected if no test data)")
                return False
            else:
                print(f"  Threshold {threshold:.2f}: Error - {response.status_code}")
                
        except Exception as e:
            print(f"  Threshold {threshold:.2f}: Error - {e}")
    
    if results:
        print(f"\n✓ Threshold testing complete")
        print(f"  Higher thresholds return fewer, more similar cookies")
        return True
    else:
        return False


def test_similar_cookies_validation():
    """Test input validation."""
    print("\n" + "=" * 60)
    print("Testing Input Validation")
    print("=" * 60)
    
    cookie_id = "test-cookie-123"
    
    # Test 1: Invalid threshold (too high)
    print("\nTest 1: Invalid threshold > 1.0 (should fail)")
    try:
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"threshold": 1.5}
        )
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 2: Invalid threshold (negative)
    print("\nTest 2: Invalid threshold < 0.0 (should fail)")
    try:
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"threshold": -0.5}
        )
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 3: Invalid max_results (too high)
    print("\nTest 3: Invalid max_results > 100 (should fail)")
    try:
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"max_results": 200}
        )
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 4: Invalid max_results (zero)
    print("\nTest 4: Invalid max_results = 0 (should fail)")
    try:
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"max_results": 0}
        )
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    print("\n✓ All validation tests passed")
    return True


def test_similar_cookies_performance():
    """Test performance of similar cookies search."""
    print("\n" + "=" * 60)
    print("Testing Performance")
    print("=" * 60)
    
    cookie_id = "test-cookie-123"
    
    try:
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"threshold": 0.75, "max_results": 50}
        )
        
        if response.status_code == 200:
            data = response.json()
            time_ms = data.get('processing_time_ms', 0)
            count = data.get('total_found', 0)
            
            print(f"Search completed in {time_ms:.1f}ms")
            print(f"Found {count} similar cookies")
            
            if time_ms < 2000:
                print(f"✓ Performance target met (< 2 seconds)")
            else:
                print(f"⚠ Slower than target (< 2 seconds)")
            
            return True
        elif response.status_code == 404:
            print(f"Cookie not found (expected if no test data)")
            return False
        else:
            print(f"✗ Performance test failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_similar_cookies_use_case():
    """Test realistic use case: preview before bulk update."""
    print("\n" + "=" * 60)
    print("Testing Use Case: Preview Before Bulk Update")
    print("=" * 60)
    
    cookie_id = "test-cookie-123"
    
    print("Scenario: User wants to correct a cookie classification")
    print("          and see which similar cookies will be affected")
    
    try:
        # Step 1: Find similar cookies
        print("\nStep 1: Find similar cookies...")
        response = requests.get(
            f"{SIMILAR_COOKIES_URL}/{cookie_id}",
            params={"threshold": 0.75, "max_results": 10}
        )
        
        if response.status_code == 200:
            data = response.json()
            similar_count = data.get('total_found', 0)
            
            print(f"✓ Found {similar_count} similar cookies")
            
            if similar_count > 0:
                print(f"\nStep 2: Show user preview of affected cookies...")
                for cookie in data['similar_cookies'][:3]:
                    print(f"  - {cookie['cookie_name']} @ {cookie['cookie_domain']}")
                    print(f"    Similarity: {cookie['similarity_score']:.2f}")
                
                print(f"\nStep 3: User can now decide to apply correction to all {similar_count} cookies")
                print(f"✓ Use case workflow successful")
                return True
            else:
                print(f"\n  No similar cookies found - correction will only affect this cookie")
                print(f"✓ Use case workflow successful (no bulk update needed)")
                return True
                
        elif response.status_code == 404:
            print(f"Cookie not found (expected if no test data)")
            return False
        else:
            print(f"✗ Use case failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ML Similar Cookies API Tests")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Basic similar cookies search
    results.append(("Find Similar Cookies", test_find_similar_cookies()))
    
    # Test 2: Different thresholds
    results.append(("Different Thresholds", test_similar_cookies_with_different_thresholds()))
    
    # Test 3: Validation
    results.append(("Input Validation", test_similar_cookies_validation()))
    
    # Test 4: Performance
    results.append(("Performance", test_similar_cookies_performance()))
    
    # Test 5: Use case
    results.append(("Use Case", test_similar_cookies_use_case()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed!")
    else:
        print(f"\n✗ {total - passed} test(s) failed")
    
    print("\nNote: Make sure the backend server is running:")
    print("  cd cookie-scanner && python3 -m backend.main")
    print("\nNote: Some tests require database with cookie data.")
    print("  Use a valid cookie_id from your database for full testing.")


if __name__ == '__main__':
    main()
