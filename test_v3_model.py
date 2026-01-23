#!/usr/bin/env python3
"""
Test script for v3.0.0 model

Verifies that the new 94% accuracy model works correctly.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from api.ml_classifier.classifier import CookieClassifier


def test_v3_model():
    """Test v3.0.0 model with sample cookies."""
    
    print("=" * 70)
    print("Testing Model v3.0.0 (94% Accuracy)")
    print("=" * 70)
    
    # Initialize classifier with v3.0.0
    try:
        classifier = CookieClassifier(model_version="3.0.0")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False
    
    # Get model info
    model_info = classifier.get_model_info()
    print(f"\n📊 Model Info:")
    print(f"   Version: {model_info['version']}")
    print(f"   Type: {model_info['model_type']}")
    print(f"   Features: {model_info['num_features']}")
    print(f"   Accuracy: {model_info['metrics'].get('accuracy', 'N/A'):.2%}")
    print(f"   F1-Score: {model_info['metrics'].get('f1_score', 'N/A'):.2%}")
    print(f"   Categories: {', '.join(model_info['categories'])}")
    
    # Test cookies
    test_cookies = [
        {
            'id': '1',
            'name': '_ga',
            'domain': '.example.com',
            'cookie_domain': '.example.com',
            'site_domain': 'example.com',
            'expiry_days': 730,
            'secure': True,
            'http_only': False
        },
        {
            'id': '2',
            'name': 'session_id',
            'domain': 'example.com',
            'cookie_domain': 'example.com',
            'site_domain': 'example.com',
            'expiry_days': 0,
            'secure': True,
            'http_only': True
        },
        {
            'id': '3',
            'name': '_fbp',
            'domain': '.facebook.com',
            'cookie_domain': '.facebook.com',
            'site_domain': 'example.com',
            'expiry_days': 90,
            'secure': True,
            'http_only': False
        },
        {
            'id': '4',
            'name': 'ad_tracker',
            'domain': '.doubleclick.net',
            'cookie_domain': '.doubleclick.net',
            'site_domain': 'example.com',
            'expiry_days': 365,
            'secure': True,
            'http_only': False
        }
    ]
    
    print(f"\n🧪 Testing {len(test_cookies)} cookies:")
    print("=" * 70)
    
    success_count = 0
    for cookie in test_cookies:
        try:
            result = classifier.classify(cookie, return_alternatives=True, top_k=2)
            
            print(f"\n🍪 Cookie: {cookie['name']} ({cookie['domain']})")
            print(f"   Predicted: {result.predicted_category}")
            print(f"   Confidence: {result.confidence_score:.1%} ({result.confidence_level})")
            print(f"   Auto-classified: {'Yes' if result.auto_classified else 'No'}")
            
            if result.alternatives:
                print(f"   Alternatives:")
                for alt in result.alternatives:
                    print(f"      - {alt.category}: {alt.probability:.1%}")
            
            success_count += 1
            
        except Exception as e:
            print(f"\n❌ Failed to classify {cookie['name']}: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 70)
    print(f"✅ Successfully classified {success_count}/{len(test_cookies)} cookies")
    print("=" * 70)
    
    return success_count == len(test_cookies)


if __name__ == "__main__":
    success = test_v3_model()
    sys.exit(0 if success else 1)
