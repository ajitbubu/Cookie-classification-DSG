# ML Cookie Classification Module

## Overview

This module provides intelligent cookie classification using machine learning models (XGBoost/Random Forest) with explainable AI capabilities.

## Components

- `feature_extractor.py` - Extracts 25+ features from cookie metadata
- `classifier.py` - Loads models and performs classification
- `explainer.py` - Generates SHAP-based explanations
- `similarity.py` - Detects similar cookies for bulk operations
- `models.py` - Data models for requests/responses
- `routes.py` - FastAPI endpoints

## Features

- **Auto-classification**: High-confidence predictions (≥0.85) are automatically applied
- **Explainability**: SHAP values show why each decision was made
- **Confidence Scoring**: Calibrated scores reflect true prediction accuracy
- **Continuous Learning**: User corrections feed back into training pipeline
- **Similarity Detection**: Find and bulk-classify similar cookies

## Usage

```python
from ml_classifier import FeatureExtractor, CookieClassifier

# Extract features
extractor = FeatureExtractor()
features = extractor.extract_features(cookie_data)

# Classify
classifier = CookieClassifier(model_path="models/v1.0.0")
result = classifier.classify(features)

print(f"Category: {result.predicted_category}")
print(f"Confidence: {result.confidence_score:.2f}")
print(f"Explanation: {result.explanation.reasoning_summary}")
```

## API Endpoints

- `POST /api/v1/ml/classify` - Classify cookies
- `POST /api/v1/ml/feedback` - Submit user corrections
- `GET /api/v1/ml/similar-cookies` - Find similar cookies
- `GET /api/v1/ml/metrics` - Get model performance metrics

## Model Training

See `training/` directory for training scripts and notebooks.

## Testing

Run property-based tests:
```bash
pytest backend/api/ml_classifier/tests/ -v
```

Run with coverage:
```bash
pytest backend/api/ml_classifier/tests/ --cov=ml_classifier --cov-report=html
```
