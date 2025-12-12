"""
Test the newly trained v2.0.0 model

Run this to verify the model works correctly before deploying.
"""

import sys
import os
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.api.ml_classifier.feature_extractor import FeatureExtractor
import pickle

print("=" * 70)
print("Testing ML Model v2.0.0")
print("=" * 70)

# 1. Check model files exist
model_dir = Path("models/v2.0.0")
print(f"\n📂 Checking model directory: {model_dir}")

# Required files
required_files = ["model.pkl", "metadata.json"]
optional_files = ["feature_names.json"]

for file in required_files:
    file_path = model_dir / file
    if file_path.exists():
        size = file_path.stat().st_size
        print(f"   ✅ {file:20s} ({size:,} bytes)")
    else:
        print(f"   ❌ {file:20s} MISSING!")
        sys.exit(1)

for file in optional_files:
    file_path = model_dir / file
    if file_path.exists():
        size = file_path.stat().st_size
        print(f"   ✅ {file:20s} ({size:,} bytes)")
    else:
        print(f"   ⚠️  {file:20s} (optional - not critical)")

# 2. Load the model
print(f"\n🔄 Loading model...")
try:
    with open(model_dir / "model.pkl", "rb") as f:
        model = pickle.load(f)
    print(f"   ✅ Model loaded successfully")
    print(f"   📊 Model type: {type(model).__name__}")
except Exception as e:
    print(f"   ❌ Failed to load model: {e}")
    sys.exit(1)

# 3. Load metadata
print(f"\n📋 Loading metadata...")
import json
try:
    with open(model_dir / "metadata.json", "r") as f:
        metadata = json.load(f)
    print(f"   ✅ Metadata loaded")
    print(f"   📅 Trained: {metadata.get('trained_at', 'N/A')}")
    print(f"   🎯 Model type: {metadata.get('model_type', 'N/A')}")

    # Show validation accuracy if available
    if 'validation_metrics' in metadata:
        val_acc = metadata['validation_metrics'].get('accuracy', 'N/A')
        print(f"   ✅ Validation accuracy: {val_acc:.2%}")
    elif 'cv_metrics' in metadata:
        cv_acc = metadata['cv_metrics'].get('accuracy_mean', 'N/A')
        print(f"   ✅ Cross-validation accuracy: {cv_acc:.2%}")

except Exception as e:
    print(f"   ⚠️  Could not load metadata: {e}")

# 4. Initialize feature extractor
print(f"\n🔧 Initializing feature extractor...")
try:
    extractor = FeatureExtractor()
    print(f"   ✅ Feature extractor ready")
except Exception as e:
    print(f"   ❌ Failed to initialize: {e}")
    sys.exit(1)

# 5. Test with sample cookies
print(f"\n🍪 Testing with sample cookies...")

test_cookies = [
    {
        'name': '_ga',
        'domain': '.google-analytics.com',
        'value': 'GA1.2.123456789.1234567890',
        'httpOnly': False,
        'secure': True,
        'sameSite': 'Lax',
        'path': '/',
        'expiryDays': 730
    },
    {
        'name': '_fbp',
        'domain': '.facebook.com',
        'value': 'fb.1.1234567890.123456789',
        'httpOnly': False,
        'secure': True,
        'sameSite': 'Lax',
        'path': '/',
        'expiryDays': 90
    },
    {
        'name': 'sessionid',
        'domain': 'example.com',
        'value': 'abc123def456',
        'httpOnly': True,
        'secure': True,
        'sameSite': 'Strict',
        'path': '/',
        'expiryDays': 0
    }
]

# Category mapping
CATEGORY_MAP = {
    0: 'Analytics',
    1: 'Functional',
    2: 'Marketing',
    3: 'Strictly Necessary'
}

print("\n" + "=" * 70)
print("Classification Results")
print("=" * 70)

passed = 0
total = len(test_cookies)

for i, cookie in enumerate(test_cookies, 1):
    try:
        # Extract features
        features = extractor.extract_features(cookie)

        # Predict
        prediction = model.predict([features])[0]
        probabilities = model.predict_proba([features])[0]
        confidence = max(probabilities)

        # Convert to category name
        predicted_category = CATEGORY_MAP.get(int(prediction), f'Unknown_{prediction}')

        print(f"\n{i}. Cookie: {cookie['name']}")
        print(f"   Domain: {cookie['domain']}")
        print(f"   Predicted: {predicted_category}")
        print(f"   Confidence: {confidence:.2%}")

        if confidence > 0.85:
            print(f"   ✅ High confidence")
            passed += 1
        elif confidence > 0.65:
            print(f"   ⚠️  Medium confidence")
            passed += 1
        else:
            print(f"   ❌ Low confidence")

    except Exception as e:
        print(f"\n{i}. Cookie: {cookie['name']}")
        print(f"   ❌ Error: {e}")

print("\n" + "=" * 70)
print("Test Summary")
print("=" * 70)
print(f"\n✅ Passed: {passed}/{total} cookies classified successfully")

if passed == total:
    print(f"\n🎉 All tests passed! Model is ready to use.")
    sys.exit(0)
else:
    print(f"\n⚠️  Some tests failed. Review the results above.")
    sys.exit(1)
