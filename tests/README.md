# Tests

This directory contains all test files for the Cookie Scanner application.

## Structure

- **ml/** - Machine Learning related tests
  - ML classification tests
  - Drift detection tests
  - Similarity detection tests
  - ML API endpoint tests

- **backend/** - Backend API tests
  - Cookie scanning tests
  - Category management tests

## Running Tests

### ML Tests
```bash
# Run all ML tests
python -m pytest tests/ml/

# Run specific test file
python -m pytest tests/ml/test_ml_api.py

# Run with coverage
python -m pytest tests/ml/ --cov=backend.api.ml_classifier
```

### Backend Tests
```bash
# Run backend tests
python -m pytest tests/backend/

# Run specific test
python -m pytest tests/backend/test-backend.py
```

### Run All Tests
```bash
# From project root
python scripts/run_all_ml_tests.py
```

## Test Files

### ML Tests
- `test_ml_api.py` - ML classification API tests
- `test_ml_auth.py` - ML authentication tests
- `test_ml_feedback_api.py` - Feedback system tests
- `test_ml_metrics_api.py` - Metrics collection tests
- `test_ml_similar_cookies_api.py` - Similar cookies detection tests
- `test_drift_api.py` - Drift detection API tests
- `test_drift_detection.py` - Drift detection logic tests
- `test_similarity.py` - Cookie similarity tests
- `test_similarity_db.py` - Similarity database tests

### Backend Tests
- `test-backend.py` - Backend API tests
- `test-category-update.py` - Category update tests
