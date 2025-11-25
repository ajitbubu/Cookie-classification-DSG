"""
Run All ML Classification Tests

Comprehensive test runner for the ML classification system.
"""

import subprocess
import sys
from datetime import datetime

def run_test(test_file, description):
    """Run a single test file."""
    print("\n" + "=" * 70)
    print(f"Running: {description}")
    print("=" * 70)
    
    try:
        result = subprocess.run(
            [sys.executable, test_file],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"✗ Test timed out after 60 seconds")
        return False
    except Exception as e:
        print(f"✗ Error running test: {e}")
        return False


def main():
    """Run all ML classification tests."""
    print("\n" + "=" * 70)
    print("ML CLASSIFICATION SYSTEM - COMPREHENSIVE TEST SUITE")
    print("=" * 70)
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 70)
    
    tests = [
        ("test_similarity.py", "Similarity Detection (In-Memory)"),
        ("test_similarity_db.py", "Similarity Detection (Database)"),
        ("test_ml_api.py", "ML Classification API"),
        ("test_ml_feedback_api.py", "ML Feedback API"),
        ("test_ml_similar_cookies_api.py", "ML Similar Cookies API"),
        ("test_ml_metrics_api.py", "ML Metrics API"),
        ("test_ml_auth.py", "ML Authentication & Rate Limiting"),
    ]
    
    results = []
    
    for test_file, description in tests:
        passed = run_test(test_file, description)
        results.append((description, passed))
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    for description, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {description}")
    
    total = len(results)
    passed_count = sum(1 for _, p in results if p)
    
    print("\n" + "=" * 70)
    print(f"Total: {passed_count}/{total} test suites passed")
    print("=" * 70)
    
    if passed_count == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nThe ML Classification System is ready for production!")
    else:
        print(f"\n⚠️  {total - passed_count} test suite(s) failed")
        print("\nNote: Some tests may fail if:")
        print("  - Backend server is not running")
        print("  - Database is not configured")
        print("  - Test data is not available")
    
    print("\n" + "=" * 70)
    print(f"Completed: {datetime.now().isoformat()}")
    print("=" * 70)
    
    return 0 if passed_count == total else 1


if __name__ == '__main__':
    sys.exit(main())
