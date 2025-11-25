"""
Simple Feature Extraction Demo

Run from cookie-scanner directory:
    python3 -m backend.api.ml_classifier.demo_feature_extraction
"""

from backend.api.ml_classifier.feature_extractor import FeatureExtractor


def main():
    """Run feature extraction demo."""
    print("=" * 70)
    print("Feature Extraction Demo")
    print("=" * 70)
    print()
    
    # Create extractor
    extractor = FeatureExtractor()
    
    # Example cookies
    cookies = [
        {
            'name': '_ga',
            'domain': 'example.com',
            'path': '/',
            'expiry_days': 730,
            'http_only': False,
            'secure': True,
            'same_site': 'Lax',
            'value_sample': 'GA1.2.1234567890.1234567890',
            'initiated_by': 'https://www.google-analytics.com/analytics.js',
            'site_domain': 'example.com'
        },
        {
            'name': '_fbp',
            'domain': 'facebook.com',
            'path': '/',
            'expiry_days': 90,
            'http_only': False,
            'secure': True,
            'same_site': 'None',
            'value_sample': 'fb.1.1234567890.1234567890',
            'initiated_by': 'https://connect.facebook.net/en_US/fbevents.js',
            'site_domain': 'example.com'
        },
        {
            'name': 'session_id',
            'domain': 'example.com',
            'path': '/',
            'expiry_days': None,  # Session cookie
            'http_only': True,
            'secure': True,
            'same_site': 'Strict',
            'value_sample': 'abc123def456',
            'site_domain': 'example.com'
        }
    ]
    
    # Extract features for each cookie
    for i, cookie in enumerate(cookies, 1):
        print(f"Cookie {i}: {cookie['name']}")
        print("-" * 70)
        
        # Extract features
        features = extractor.extract_features(cookie)
        feature_names = extractor.get_feature_names()
        
        print(f"Total features extracted: {len(features)}")
        print()
        
        # Show some key features
        print("Key Features:")
        key_features = [
            'name_length',
            'domain_is_first_party',
            'expiry_days',
            'expiry_is_session',
            'http_only',
            'secure',
            'pattern_google_analytics',
            'pattern_facebook',
            'pattern_functional'
        ]
        
        for feature_name in key_features:
            if feature_name in feature_names:
                idx = feature_names.index(feature_name)
                value = features[idx]
                print(f"  {feature_name:30s}: {value:.2f}")
        
        print()
        print()
    
    print("=" * 70)
    print("Demo Complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
