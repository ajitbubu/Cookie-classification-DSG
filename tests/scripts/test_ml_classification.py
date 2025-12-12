#!/usr/bin/env python3
"""Test ML classification directly"""

import sys
sys.path.insert(0, '.')

from backend.api.ml_classifier.classifier import CookieClassifier

# Test cookie
cookie = {
    'id': 'test-1',
    'name': '_ga',
    'domain': 'example.com',
    'path': '/',
    'expiry_days': 730,
    'http_only': False,
    'secure': True,
    'same_site': 'Lax'
}

print("Testing ML Classification...")
print(f"Cookie: {cookie['name']} on {cookie['domain']}")
print()

try:
    classifier = CookieClassifier()
    print(f"✅ Classifier loaded: v{classifier.model_version}")
    print()
    
    result = classifier.classify(cookie)
    print(f"✅ Classification successful!")
    print(f"   Category: {result.predicted_category}")
    print(f"   Confidence: {result.confidence_score:.2%}")
    print(f"   Level: {result.confidence_level}")
    print(f"   Auto-classified: {result.auto_classified}")
    print()
    
    if result.alternatives:
        print("   Alternatives:")
        for alt in result.alternatives:
            print(f"     - {alt.category}: {alt.probability:.2%}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
