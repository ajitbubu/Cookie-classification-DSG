#!/usr/bin/env python3
"""
Test live classification with the running backend server
"""

import requests
import json

# Test cookie data
test_cookie = {
    "name": "_ga",
    "domain": ".example.com",
    "cookie_domain": ".example.com",
    "site_domain": "example.com",
    "expiry_days": 730,
    "secure": True,
    "http_only": False
}

print("=" * 70)
print("Testing Live Backend with v3.0.0 Model (94% Accuracy)")
print("=" * 70)

# Test ML classification endpoint
try:
    print(f"\n🧪 Testing cookie: {test_cookie['name']}")
    print(f"   Domain: {test_cookie['domain']}")
    print(f"   Expiry: {test_cookie['expiry_days']} days")
    
    response = requests.post(
        "http://localhost:8000/api/ml/classify",
        json=test_cookie,
        timeout=5
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n✅ Classification Result:")
        print(f"   Category: {result.get('predicted_category', 'N/A')}")
        print(f"   Confidence: {result.get('confidence_score', 0):.1%}")
        print(f"   Confidence Level: {result.get('confidence_level', 'N/A')}")
        print(f"   Model Version: {result.get('model_version', 'N/A')}")
        print(f"   Auto-classified: {result.get('auto_classified', False)}")
        
        if result.get('alternatives'):
            print(f"\n   Alternative Predictions:")
            for alt in result['alternatives']:
                print(f"      - {alt['category']}: {alt['probability']:.1%}")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(f"   {response.text}")
        
except requests.exceptions.ConnectionError:
    print("\n❌ Backend server is not running on http://localhost:8000")
    print("   Please start the backend first:")
    print("   bash scripts/start-backend.sh")
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "=" * 70)
