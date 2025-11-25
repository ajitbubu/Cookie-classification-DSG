"""
Classification Demo

Demonstrates the CookieClassifier in action.

Usage:
    python3 -m backend.api.ml_classifier.demo_classifier
"""

from backend.api.ml_classifier.classifier import CookieClassifier


def main():
    """Run classification demo."""
    print("=" * 70)
    print("Cookie Classification Demo")
    print("=" * 70)
    print()
    
    # Initialize classifier
    try:
        classifier = CookieClassifier()
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("\nPlease train a model first:")
        print("  python3 -m backend.api.ml_classifier.training.train_model")
        return
    
    # Show model info
    model_info = classifier.get_model_info()
    print("Model Information:")
    print(f"  Version: {model_info['version']}")
    print(f"  Type: {model_info['model_type']}")
    print(f"  Accuracy: {model_info['metrics'].get('accuracy', 'N/A')}")
    print()
    
    # Test cookies
    test_cookies = [
        {
            'id': 'test_1',
            'name': '_ga',
            'domain': 'google-analytics.com',
            'path': '/',
            'expiry_days': 730,
            'http_only': False,
            'secure': True,
            'same_site': 'Lax'
        },
        {
            'id': 'test_2',
            'name': '_fbp',
            'domain': 'facebook.com',
            'path': '/',
            'expiry_days': 90,
            'http_only': False,
            'secure': True,
            'same_site': 'None'
        },
        {
            'id': 'test_3',
            'name': 'session_id',
            'domain': 'example.com',
            'path': '/',
            'expiry_days': None,
            'http_only': True,
            'secure': True,
            'same_site': 'Strict'
        },
        {
            'id': 'test_4',
            'name': 'language',
            'domain': 'example.com',
            'path': '/',
            'expiry_days': 365,
            'http_only': False,
            'secure': False,
            'same_site': 'Lax'
        }
    ]
    
    # Classify each cookie
    print("Classification Results:")
    print("=" * 70)
    
    for cookie in test_cookies:
        print(f"\n🍪 Cookie: {cookie['name']}")
        print(f"   Domain: {cookie['domain']}")
        print("-" * 70)
        
        # Classify
        result = classifier.classify(cookie)
        
        # Display results
        print(f"   Category: {result.predicted_category}")
        print(f"   Confidence: {result.confidence_score:.2%} ({result.confidence_level})")
        print(f"   Auto-classified: {'Yes' if result.auto_classified else 'No'}")
        print(f"   Requires review: {'Yes' if result.requires_review else 'No'}")
        
        # Show probabilities
        print(f"\n   Probabilities:")
        for category, prob in sorted(result.probabilities.items(), key=lambda x: x[1], reverse=True):
            bar_length = int(prob * 30)
            bar = '█' * bar_length + '░' * (30 - bar_length)
            print(f"     {category:25s} {bar} {prob:.2%}")
        
        # Show alternatives
        if result.alternatives:
            print(f"\n   Alternative predictions:")
            for alt in result.alternatives:
                print(f"     - {alt.category}: {alt.probability:.2%}")
    
    print("\n" + "=" * 70)
    print("Demo Complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
