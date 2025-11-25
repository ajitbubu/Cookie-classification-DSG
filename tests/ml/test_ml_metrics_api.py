"""
Test ML Metrics API Endpoint

Tests the GET /api/v1/ml/metrics endpoint.
"""

import requests
import json
from datetime import datetime, timedelta

# API endpoint
BASE_URL = "http://localhost:8000"
METRICS_URL = f"{BASE_URL}/api/v1/ml/metrics"


def test_basic_metrics():
    """Test basic metrics retrieval."""
    print("=" * 60)
    print("Testing Basic Metrics Retrieval")
    print("=" * 60)
    
    try:
        response = requests.get(METRICS_URL)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Metrics retrieved successfully")
            
            print(f"\nPeriod:")
            print(f"  Start: {data['period']['start']}")
            print(f"  End: {data['period']['end']}")
            
            print(f"\nOverview:")
            print(f"  Model Version: {data['model_version']}")
            print(f"  Total Predictions: {data['total_predictions']}")
            print(f"  Auto-Classified: {data['auto_classified']}")
            print(f"  Requires Review: {data['requires_review']}")
            print(f"  Auto-Classification Rate: {data['auto_classified']/data['total_predictions']*100:.1f}%")
            
            print(f"\nConfidence Distribution:")
            conf = data['confidence_distribution']
            print(f"  High: {conf['high_count']}")
            print(f"  Medium: {conf['medium_count']}")
            print(f"  Low: {conf['low_count']}")
            print(f"  Average: {conf['avg_confidence']:.2f}")
            
            print(f"\nCategory Distribution:")
            cat = data['category_distribution']
            print(f"  Strictly Necessary: {cat['strictly_necessary']}")
            print(f"  Analytics: {cat['analytics']}")
            print(f"  Marketing: {cat['marketing']}")
            print(f"  Functional: {cat['functional']}")
            print(f"  Unknown: {cat['unknown']}")
            
            print(f"\nPerformance:")
            perf = data['performance']
            print(f"  Avg Latency: {perf['avg_latency_ms']:.1f}ms")
            print(f"  P95 Latency: {perf['p95_latency_ms']:.1f}ms")
            
            print(f"\nUser Feedback:")
            print(f"  Corrections: {data['correction_count']}")
            print(f"  Correction Rate: {data['correction_rate']*100:.1f}%")
            
            return True
        else:
            print(f"✗ Metrics retrieval failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_metrics_with_date_range():
    """Test metrics with custom date range."""
    print("\n" + "=" * 60)
    print("Testing Metrics with Custom Date Range")
    print("=" * 60)
    
    # Last 7 days
    end_date = datetime.now().date()
    start_date = (datetime.now() - timedelta(days=7)).date()
    
    try:
        response = requests.get(
            METRICS_URL,
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )
        
        print(f"Date Range: {start_date} to {end_date}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Metrics retrieved for custom period")
            print(f"  Period: {data['period']['start']} to {data['period']['end']}")
            print(f"  Total Predictions: {data['total_predictions']}")
            return True
        else:
            print(f"✗ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_metrics_with_confusion_matrix():
    """Test metrics with confusion matrix."""
    print("\n" + "=" * 60)
    print("Testing Metrics with Confusion Matrix")
    print("=" * 60)
    
    try:
        response = requests.get(
            METRICS_URL,
            params={"include_confusion_matrix": True}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Metrics with confusion matrix retrieved")
            
            if data.get('confusion_matrix'):
                print(f"\nConfusion Matrix:")
                print(f"{'Predicted':<20} | {'SN':<5} | {'AN':<5} | {'MK':<5} | {'FN':<5} | {'UN':<5}")
                print("-" * 60)
                
                for row in data['confusion_matrix']:
                    pred = row['predicted_category'][:18]
                    print(f"{pred:<20} | {row['strictly_necessary']:<5} | {row['analytics']:<5} | {row['marketing']:<5} | {row['functional']:<5} | {row['unknown']:<5}")
                
                # Calculate accuracy
                total_correct = sum([
                    data['confusion_matrix'][0]['strictly_necessary'],
                    data['confusion_matrix'][1]['analytics'],
                    data['confusion_matrix'][2]['marketing'],
                    data['confusion_matrix'][3]['functional'],
                    data['confusion_matrix'][4]['unknown']
                ])
                total_predictions = data['total_predictions']
                accuracy = total_correct / total_predictions if total_predictions > 0 else 0
                
                print(f"\nAccuracy: {accuracy*100:.1f}%")
            else:
                print(f"✗ Confusion matrix not included")
                return False
            
            return True
        else:
            print(f"✗ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_metrics_validation():
    """Test input validation."""
    print("\n" + "=" * 60)
    print("Testing Input Validation")
    print("=" * 60)
    
    # Test 1: Invalid date format
    print("\nTest 1: Invalid date format (should fail)")
    try:
        response = requests.get(
            METRICS_URL,
            params={"start_date": "invalid-date"}
        )
        if response.status_code == 400:
            print(f"✓ Correctly rejected: {response.json().get('detail')}")
        else:
            print(f"✗ Should have been rejected but got: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 2: Start date after end date
    print("\nTest 2: Start date after end date (should fail)")
    try:
        response = requests.get(
            METRICS_URL,
            params={
                "start_date": "2025-12-01",
                "end_date": "2025-11-01"
            }
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


def test_metrics_model_version():
    """Test metrics filtered by model version."""
    print("\n" + "=" * 60)
    print("Testing Metrics by Model Version")
    print("=" * 60)
    
    try:
        response = requests.get(
            METRICS_URL,
            params={"model_version": "1.0.0"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Metrics retrieved for model version")
            print(f"  Model Version: {data['model_version']}")
            print(f"  Total Predictions: {data['total_predictions']}")
            return True
        else:
            print(f"✗ Request failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("ML Metrics API Tests")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Basic metrics
    results.append(("Basic Metrics", test_basic_metrics()))
    
    # Test 2: Custom date range
    results.append(("Custom Date Range", test_metrics_with_date_range()))
    
    # Test 3: Confusion matrix
    results.append(("Confusion Matrix", test_metrics_with_confusion_matrix()))
    
    # Test 4: Validation
    results.append(("Input Validation", test_metrics_validation()))
    
    # Test 5: Model version filter
    results.append(("Model Version Filter", test_metrics_model_version()))
    
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
    print("\nNote: Currently returns mock data.")
    print("  Integrate with ml_metrics table for real data.")


if __name__ == '__main__':
    main()
