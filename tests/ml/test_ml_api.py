"""
Test ML Classification API Endpoint

Tests the POST /api/v1/ml/classify endpoint.
"""

import requests
import json
from datetime import datetime

# API endpoint
BASE_URL = "http://localhost:8000"
CLASSIFY_URL = f"{BASE_URL}/api/v1/ml/classify"
HEALTH_URL = f"{BASE_URL}/api/v1/ml/health"
MODEL_INFO_URL = f"{BASE_URL}/api/v1/ml/model-info"


def test_health_check():
    """Test ML health check endpoint."""
    print("=" * 60)
    print("Testing ML Health Check")
    print("=" * 60)
    
    try:
        response = requests.get(HEALTH_URL)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check successful")
            print(f"  Status: {data.get('status')}")
            print(f"  Model Loaded: {data.get('model_loaded')}")
            print(f"  Model Version: {data.get('model_version')}")
            return True
        else:
            print(f"✗ Health check failed: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_model_info():
    """Test model info endpoint."""
    print("\n" + "=" * 60)
    print("Testing Model Info")
    print("=" * 60)
    
    try:
        response = requests.get(MODEL_INFO_URL)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Model info retrieved")
            print(f"  Model Version: {data.get('model_version')}")
            print(f"  Model Type: {data.get('model_type')}")
            print(f"  Feature Count: {data.get('feature_count')}")
            print(f"  Categories: {', '.join(data.get('categories', []))}")
            return True
        else:
            print(f"✗ Model info failed: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_classify_single_cookie():
    """Test classifying a single cookie."""
    print("\n" + "=" * 60)
    print("Testing Single Cookie Classification")
    print("=" * 60)
    
    # Test cookie (Google Analytics)
    request_data = {
        "cookies": [
            {
                "id": "test-cookie-1",
                "name": "_ga",
                "domain": "example.com",
                "path": "/",
                "expiry_days": 730,
                "http_only": False,
                "secure": True,
                "same_site": "Lax"
            }
        ],
        "options": {
            "return_explanation": True,
            "find_similar": False,  # Disable for testing without DB
            "confidence_threshold": 0.75,
            "auto_classify": True
        }
    }
    
    try:
        print(f"Request: {json.dumps(request_data, indent=2)}")
        
        response = requests.post(
            CLASSIFY_URL,
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Classification successful")
            
            # Print summary
            summary = data.get('summary', {})
            print(f"\nSummary:")
            print(f"  Total Cookies: {summary.get('total_cookies')}")
            print(f"  Auto-Classified: {summary.get('auto_classified')}")
            print(f"  Requires Review: {summary.get('requires_review')}")
            print(f"  Avg Confidence: {summary.get('avg_confidence'):.2f}")
            print(f"  Processing Time: {summary.get('total_processing_time_ms'):.1f}ms")
            
            # Print first classification
            if data.get('classifications'):
                classification = data['classifications'][0]
                print(f"\nClassification:")
                print(f"  Cookie: {request_data['cookies'][0]['name']}")
                print(f"  Category: {classification.get('predicted_category')}")
                print(f"  Confidence: {classification.get('confidence_score'):.2f}")
                print(f"  Level: {classification.get('confidence_level')}")
                print(f"  Auto-Classified: {classification.get('auto_classified')}")
                print(f"  Requires Review: {classification.get('requires_review')}")
                print(f"  Processing Time: {classification.get('processing_time_ms'):.1f}ms")
                
                # Print alternatives
                if classification.get('alternative_predictions'):
                    print(f"\n  Alternatives:")
                    for alt in classification['alternative_predictions'][:3]:
                        print(f"    - {alt['category']}: {alt['probability']:.2f}")
                
                # Print explanation
                if classification.get('explanation'):
                    expl = classification['explanation']
                    print(f"\n  Explanation:")
                    print(f"    {expl.get('reasoning_summary')}")
                    if expl.get('top_features'):
                        print(f"\n    Top Features:")
                        for feat in expl['top_features'][:3]:
                            print(f"      - {feat['feature']}: {feat['contribution']:.3f}")
            
            return True
        else:
            print(f"✗ Classification failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_classify_batch():
    """Test classifying multiple cookies."""
    print("\n" + "=" * 60)
    print("Testing Batch Cookie Classification")
    print("=" * 60)
    
    # Test cookies
    request_data = {
        "cookies": [
            {
                "name": "_ga",
                "domain": "example.com",
                "expiry_days": 730,
                "secure": True
            },
            {
                "name": "_fbp",
                "domain": "facebook.com",
                "expiry_days": 90,
                "secure": True
            },
            {
                "name": "session_id",
                "domain": "example.com",
                "expiry_days": None,  # Session cookie
                "http_only": True,
                "secure": True
            }
        ],
        "options": {
            "return_explanation": False,  # Faster without explanations
            "find_similar": False,
            "auto_classify": True
        }
    }
    
    try:
        response = requests.post(
            CLASSIFY_URL,
            json=request_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Batch classification successful")
            
            # Print summary
            summary = data.get('summary', {})
            print(f"\nSummary:")
            print(f"  Total Cookies: {summary.get('total_cookies')}")
            print(f"  Auto-Classified: {summary.get('auto_classified')}")
            print(f"  Requires Review: {summary.get('requires_review')}")
            print(f"  Avg Confidence: {summary.get('avg_confidence'):.2f}")
            print(f"  Total Time: {summary.get('total_processing_time_ms'):.1f}ms")
            print(f"  Avg Time/Cookie: {summary.get('total_processing_time_ms') / summary.get('total_cookies'):.1f}ms")
            
            # Print each classification
            print(f"\nClassifications:")
            for i, classification in enumerate(data.get('classifications', [])):
                cookie = request_data['cookies'][i]
                print(f"  {i+1}. {cookie['name']}:")
                print(f"     Category: {classification.get('predicted_category')}")
                print(f"     Confidence: {classification.get('confidence_score'):.2f} ({classification.get('confidence_level')})")
                print(f"     Auto: {classification.get('auto_classified')}, Review: {classification.get('requires_review')}")
            
            return True
        else:
            print(f"✗ Batch classification failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ML Classification API Tests")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health check
    results.append(("Health Check", test_health_check()))
    
    # Test 2: Model info
    results.append(("Model Info", test_model_info()))
    
    # Test 3: Single cookie classification
    results.append(("Single Cookie", test_classify_single_cookie()))
    
    # Test 4: Batch classification
    results.append(("Batch Classification", test_classify_batch()))
    
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


if __name__ == '__main__':
    main()
