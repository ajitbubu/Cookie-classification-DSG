"""
ML Classifier Configuration

Centralized configuration for ML classification system.
"""

import os
from pathlib import Path
from typing import Optional

# Paths
BASE_DIR = Path(__file__).parent.parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
CURRENT_MODEL_VERSION = os.getenv("ML_MODEL_VERSION", "6.0.0")
MODEL_PATH = MODELS_DIR / f"v{CURRENT_MODEL_VERSION}"

# Classification Thresholds
CONFIDENCE_HIGH_THRESHOLD = float(os.getenv("ML_CONFIDENCE_HIGH", "0.85"))
CONFIDENCE_MEDIUM_THRESHOLD = float(os.getenv("ML_CONFIDENCE_MEDIUM", "0.65"))

# Performance Limits
MAX_BATCH_SIZE = int(os.getenv("ML_MAX_BATCH_SIZE", "500"))
CLASSIFICATION_TIMEOUT_MS = int(os.getenv("ML_CLASSIFICATION_TIMEOUT_MS", "200"))
FEATURE_EXTRACTION_TIMEOUT_MS = int(os.getenv("ML_FEATURE_EXTRACTION_TIMEOUT_MS", "100"))
EXPLANATION_TIMEOUT_MS = int(os.getenv("ML_EXPLANATION_TIMEOUT_MS", "50"))

# Similarity Detection
SIMILARITY_THRESHOLD = float(os.getenv("ML_SIMILARITY_THRESHOLD", "0.75"))
SIMILARITY_NAME_WEIGHT = 0.40
SIMILARITY_VENDOR_WEIGHT = 0.30
SIMILARITY_DOMAIN_WEIGHT = 0.15
SIMILARITY_PURPOSE_WEIGHT = 0.15

# Retraining Triggers
RETRAINING_MIN_SAMPLES = int(os.getenv("ML_RETRAINING_MIN_SAMPLES", "500"))
RETRAINING_CORRECTION_RATE_THRESHOLD = float(os.getenv("ML_RETRAINING_CORRECTION_RATE", "0.10"))
RETRAINING_ACCURACY_THRESHOLD = float(os.getenv("ML_RETRAINING_ACCURACY", "0.92"))

# Model Performance
MIN_ACCURACY_ALERT = float(os.getenv("ML_MIN_ACCURACY_ALERT", "0.90"))
MAX_CORRECTION_RATE_ALERT = float(os.getenv("ML_MAX_CORRECTION_RATE_ALERT", "0.25"))
MAX_UNKNOWN_RATE = float(os.getenv("ML_MAX_UNKNOWN_RATE", "0.10"))

# Feature Extraction
MIN_FEATURES_COUNT = 25
VENDOR_CONFIDENCE_BOOST = 0.05

# Categories
CATEGORIES = [
    "Strictly Necessary",
    "Analytics",
    "Marketing",
    "Functional",
    "Unknown"
]

# Cache Settings
CACHE_ENABLED = os.getenv("ML_CACHE_ENABLED", "true").lower() == "true"
CACHE_TTL_SECONDS = int(os.getenv("ML_CACHE_TTL", "3600"))  # 1 hour

# Logging
LOG_LEVEL = os.getenv("ML_LOG_LEVEL", "INFO")
LOG_ALL_CLASSIFICATIONS = os.getenv("ML_LOG_ALL_CLASSIFICATIONS", "true").lower() == "true"


def get_model_path(version: Optional[str] = None) -> Path:
    """Get path to model directory for specific version."""
    if version is None:
        version = CURRENT_MODEL_VERSION
    return MODELS_DIR / f"v{version}"


def get_confidence_level(score: float) -> str:
    """Determine confidence level from score."""
    if score >= CONFIDENCE_HIGH_THRESHOLD:
        return "High"
    elif score >= CONFIDENCE_MEDIUM_THRESHOLD:
        return "Medium"
    else:
        return "Low"


def should_auto_classify(score: float) -> bool:
    """Determine if prediction should be auto-applied."""
    return score >= CONFIDENCE_HIGH_THRESHOLD


def requires_review(score: float) -> bool:
    """Determine if prediction requires manual review."""
    return score < CONFIDENCE_HIGH_THRESHOLD
