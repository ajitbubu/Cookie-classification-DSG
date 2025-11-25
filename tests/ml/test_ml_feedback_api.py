"""
Test ML Feedback API Endpoint

Tests the POST /api/v1/ml/feedback endpoint.
"""

import requests
import json
from datetime import datetime

# API endpoint
BASE_URL = "http://localhost:8000"
FEEDBACK_URL = f"{BASE_URL}/api/v1/ml/feedback"


def test_basic_feedback():
    """Test basic feedback submission without bulk update."""
    print("=" * 60)
    print("Testing Basic Feedback Submission")
    print("=" * 60)
    
    request_data = {
        "cookie_id": "test-cookie-123",
        "predicted_label": "Marketing",
        "corrected_label": "Analytics",
        "confidence_score": 0.72,
        "user_id": "test_user",
        "feedback_note": "This is clearly a Google Analytics cookie",
        "apply_to_similar": False
    }
    
    try:
        print(f"Request: {json.dumps(request_data, indent=2)}")
        
        response = requests.post(
            FEEDBACK_URL,
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Feedback submitted successfully")
            print(f"\nResponse:")
            print(f"  Feedback ID: {data.get('feedback_id')}")
            print(f"  Cookie ID: {data.get('cookie_id')}")
            print(f"  Corrected Label: {data.get('corrected_label')}")
            print(f"  Similar Cookies Found: {data.get('similar_cookies_found')}")
            print(f"  Similar Cookies Updated: {data.get('similar_cookies_updated')}")
            print(f"  Processing Time: {data.get('processing_time_ms'):.1f}ms")
            print(f"  Message: {data.get('message')}")
            return True
        else:
            print(f"✗ Feedback submission failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_feedback_with_bulk_update():
    """Test feedback submission with bulk update to similar cookies."""
    print("\n" + "=" * 60)
    print("Testing Feedback with Bulk Update")
    print("=" * 60)
    
    request_data = {
        "cookie_id": "test-cookie-456",
        "predicted_label": "Unknown",
        "corrected_label": "Strictly Necessary",
        "confidence_score": 0.45,
        "user_id": "test_user",
        "feedback_note": "Session cookie - strictly necessary",
        "apply_to_similar": True,
        "similarity_threshold": 0.75
    }
    
    try:
        print(f"Request: {json.dumps(request_data, indent=2)}")
        
        response = requests.post(
            FEEDBACK_URL,
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Feedback with bulk update successful")
            print(f"\nResponse:")
            print(f"  Feedback ID: {data.get('feedback_id')}")
            print(f"  Corrected Label: {data.get('corrected_label')}")
            print(f"  Similar Cookies Found: {data.get('similar_cookies_found')}")
            print(f"  Similar Cookies Updated: {data.get('similar_cookies_updated')}")
            print(f"  Processing Time: {data.get('processing_time_ms'):.1f}ms")
            print(f"  Message: {data.get('message')}")
            
            # Print similar cookies if available
            if data.get('similar_cookies'):
                print(f"\n  Similar Cookies Updated:")
                for cookie in data['similar_cookies'][:5]:
                    print(f"    - {cookie['cookie_name']} @ {cookie['cookie_domain']}")
                    print(f"      Similarity: {cookie['similarity_score']:.2f}")
                    print(f"      {cookie.get('previous_category', 'Unknown')} -> {cookie['new_category']}")
            
            return True
        else:
            print(f"✗ Feedback with bulk update failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_invalid_feedback():
    """Test feedback validation."""
    print("\n" + "=" * 60)
    print("Testing Feedback Validation")
    print("=" * 60)
    
    # Test 1: Same predicted and corrected label
    print("\nTest 1: Same predicted and corrected label (should fail)")
    request_data = {
        "cookie_id": "test-cookie-789",
        "predicted_label": "Analytics",
        "corrected_label": "Analytics",  # Same as predicted
        "confidence_score": 0.85
    }
    
    try:
        response = requests.post(FEEDBACK_URL, json=request_data)
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 2: Invalid category
    print("\nTest 2: Invalid category (should fail)")
    request_data = {
        "cookie_id": "test-cookie-789",
        "predicted_label": "Analytics",
        "corrected_label": "InvalidCategory",  # Invalid
        "confidence_score": 0.85
    }
    
    try:
        response = requests.post(FEEDBACK_URL, json=request_data)
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


def test_feedback_performance():
    """Test feedback submission performance."""
    print("\n" + "=" * 60)
    print("Testing Feedback Performance")
    print("=" * 60)
    
    # Test without bulk update (should be fast)
    request_data = {
        "cookie_id": "perf-test-1",
        "predicted_label": "Marketing",
        "corrected_label": "Analytics",
        "confidence_score": 0.70,
        "apply_to_similar": False
    }
    
    try:
        response = requests.post(FEEDBACK_URL, json=request_data)
        
        if response.status_code == 200:
            data = response.json()
            time_ms = data.get('processing_time_ms', 0)
            
            print(f"Single feedback (no bulk): {time_ms:.1f}ms")
            
            if time_ms < 100:
                print(f"✓ Performance target met (< 100ms)")
            else:
                print(f"⚠ Slower than target (< 100ms)")
            
            return True
        else:
            print(f"✗ Performance test failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ML Feedback API Tests")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Basic feedback
    results.append(("Basic Feedback", test_basic_feedback()))
    
    # Test 2: Feedback with bulk update
    results.append(("Bulk Update", test_feedback_with_bulk_update()))
    
    # Test 3: Validation
    results.append(("Validation", test_invalid_feedback()))
    
    # Test 4: Performance
    results.append(("Performance", test_feedback_performance()))
    
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
    print("\nNote: Some tests may fail if database is not set up.")
    print("  Bulk update requires database with cookie data.")


if __name__ == '__main__':
    main()
