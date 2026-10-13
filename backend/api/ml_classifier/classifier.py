"""
Cookie Classification Engine

Loads trained models and performs cookie classification with confidence scoring.
"""

import joblib
import hashlib
import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from .feature_extractor import FeatureExtractor
from .feature_extractor_v3 import FeatureExtractorV3
from .feature_extractor_v5 import FeatureExtractorV5, get_feature_extractor_for_model
from .config import (
    get_model_path,
    get_confidence_level,
    CATEGORIES,
    CURRENT_MODEL_VERSION,
    IDENTITY_EVIDENCE_FEATURES,
    NO_EVIDENCE_CONFIDENCE_CAP,
)


@dataclass
class AlternativePrediction:
    """Alternative prediction with probability."""
    category: str
    probability: float


@dataclass
class ClassificationResult:
    """Result of cookie classification."""
    cookie_id: str
    predicted_category: str
    confidence_score: float
    confidence_level: str  # "High", "Medium", "Low"
    auto_classified: bool
    requires_review: bool
    probabilities: Dict[str, float]
    alternatives: List[AlternativePrediction]
    model_version: str
    classified_at: datetime
    insufficient_evidence: bool = False


class CookieClassifier:
    """Classifies cookies using trained ML model."""
    
    def __init__(self, model_version: Optional[str] = None):
        """
        Initialize classifier with trained model.
        
        Args:
            model_version: Model version to load (None for latest)
        """
        self.model_version = model_version or CURRENT_MODEL_VERSION
        self.model_path = get_model_path(self.model_version)
        
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        
        self._verify_manifest()
        # Load model components
        self._load_model()
        
        # Initialize feature extractor based on model version
        self.feature_extractor = get_feature_extractor_for_model(self.model_version)
        feature_names = self.feature_extractor.get_feature_names()
        self._evidence_indices = [
            feature_names.index(name)
            for name in IDENTITY_EVIDENCE_FEATURES
            if name in feature_names
        ]
        self._validate_artifacts()
        print(f"✅ Using feature extractor for model v{self.model_version}")
        print(f"   Feature count: {len(self.feature_extractor.get_feature_names())}")
    
    def _load_model(self):
        """Load model and associated artifacts."""
        print(f"📦 Loading model from {self.model_path}...")
        
        # Prefer XGBoost's stable native format. Pickle remains a legacy fallback.
        native_model_file = self.model_path / "model.ubj"
        model_file = self.model_path / "model.pkl"
        if native_model_file.exists():
            from xgboost import XGBClassifier

            self.model = XGBClassifier()
            self.model.load_model(native_model_file)
            self.serialization_format = "xgboost_native"
        elif model_file.exists():
            self.model = joblib.load(model_file)
            self.serialization_format = "joblib_pickle"
        else:
            raise FileNotFoundError(
                f"No supported model artifact found ({native_model_file.name} or {model_file.name})"
            )
        
        # Prefer a portable JSON class list over a pickled sklearn encoder.
        labels_file = self.model_path / "labels.json"
        encoder_file = self.model_path / "label_encoder.pkl"
        if labels_file.exists():
            labels = json.loads(labels_file.read_text())

            class StoredLabelEncoder:
                def __init__(self, classes):
                    self.classes_ = np.asarray(classes, dtype=object)

                def inverse_transform(self, encoded):
                    indices = np.asarray(encoded, dtype=int)
                    return self.classes_[indices]

            self.label_encoder = StoredLabelEncoder(labels)
        elif encoder_file.exists():
            self.label_encoder = joblib.load(encoder_file)
        else:
            raise FileNotFoundError(
                f"No label artifact found ({labels_file.name} or {encoder_file.name})"
            )
        
        # Load metadata
        metadata_file = self.model_path / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {}
        
        print(f"✅ Model loaded: v{self.model_version}")
        print(f"   Type: {self.metadata.get('model_type', 'unknown')}")
        print(f"   Accuracy: {self.metadata.get('metrics', {}).get('accuracy', 'N/A')}")

        calibration_file = self.model_path / "calibration.json"
        self.calibration = (
            json.loads(calibration_file.read_text()) if calibration_file.exists() else {}
        )
        self.temperature = float(self.calibration.get("temperature", 1.0))

    def _verify_manifest(self):
        """Verify candidate artifact checksums before deserialization."""
        manifest_file = self.model_path / "manifest.json"
        if not manifest_file.exists():
            return
        manifest = json.loads(manifest_file.read_text())
        for filename, expected in manifest.get("files", {}).items():
            path = self.model_path / filename
            if not path.exists():
                raise FileNotFoundError(f"Manifest artifact missing: {path}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != expected.get("sha256"):
                raise RuntimeError(f"Checksum mismatch for model artifact: {filename}")

    def _validate_artifacts(self):
        """Reject internally inconsistent model bundles before inference."""
        metadata_version = self.metadata.get('version')
        if metadata_version and metadata_version != self.model_version:
            raise RuntimeError(
                f"Model bundle v{self.model_version} contains metadata for "
                f"v{metadata_version}"
            )

        feature_count = len(self.feature_extractor.get_feature_names())
        model_feature_count = getattr(self.model, 'n_features_in_', None)
        if model_feature_count is not None and int(model_feature_count) != feature_count:
            raise RuntimeError(
                f"Model expects {model_feature_count} features but extractor "
                f"produces {feature_count}"
            )

        model_class_count = len(getattr(self.model, 'classes_', []))
        encoder_class_count = len(getattr(self.label_encoder, 'classes_', []))
        if model_class_count and model_class_count != encoder_class_count:
            raise RuntimeError(
                f"Model exposes {model_class_count} classes but label encoder "
                f"contains {encoder_class_count}"
            )
    
    def classify(
        self,
        cookie: Dict[str, Any],
        return_alternatives: bool = True,
        top_k: int = 3
    ) -> ClassificationResult:
        """
        Classify a single cookie.
        
        Args:
            cookie: Cookie data dictionary
            return_alternatives: Whether to return alternative predictions
            top_k: Number of alternative predictions to return
        
        Returns:
            ClassificationResult
        """
        # Extract features
        features = self.feature_extractor.extract_features(cookie)
        features_2d = features.reshape(1, -1)
        
        # Predict
        y_proba, lacks_evidence = self._apply_evidence_guard(
            features_2d,
            self._calibrated_probabilities(self.model.predict_proba(features_2d)),
        )
        y_proba = y_proba[0]
        y_pred = int(np.argmax(y_proba))
        
        # Decode prediction
        predicted_category = self.label_encoder.inverse_transform([y_pred])[0]
        
        # Get confidence score (max probability)
        confidence_score = float(y_proba.max())
        
        # Determine confidence level
        confidence_level = get_confidence_level(confidence_score)
        
        # Determine if auto-classified
        auto_classified = not lacks_evidence[0] and self.can_auto_classify(
            predicted_category, confidence_score
        )
        needs_review = not auto_classified
        
        # Get all probabilities
        probabilities = {
            category: float(prob)
            for category, prob in zip(self.label_encoder.classes_, y_proba)
        }
        
        # Get alternative predictions
        alternatives = []
        if return_alternatives:
            # Sort by probability (descending)
            sorted_indices = np.argsort(y_proba)[::-1]
            
            # Skip the top prediction, get next top_k
            for idx in sorted_indices[1:top_k+1]:
                category = self.label_encoder.classes_[idx]
                probability = float(y_proba[idx])
                
                if probability > 0.01:  # Only include if probability > 1%
                    alternatives.append(
                        AlternativePrediction(
                            category=category,
                            probability=probability
                        )
                    )
        
        return ClassificationResult(
            cookie_id=cookie.get('id', 'unknown'),
            predicted_category=predicted_category,
            confidence_score=confidence_score,
            confidence_level=confidence_level,
            auto_classified=auto_classified,
            requires_review=needs_review,
            probabilities=probabilities,
            alternatives=alternatives,
            model_version=self.model_version,
            classified_at=datetime.now(),
            insufficient_evidence=bool(lacks_evidence[0]),
        )

    def classify_batch(
        self,
        cookies: List[Dict[str, Any]],
        return_alternatives: bool = True,
        top_k: int = 3
    ) -> List[ClassificationResult]:
        """
        Classify multiple cookies efficiently.
        
        Args:
            cookies: List of cookie data dictionaries
            return_alternatives: Whether to return alternative predictions
            top_k: Number of alternative predictions to return
        
        Returns:
            List of ClassificationResult
        """
        if not cookies:
            return []
        
        # Extract features for all cookies
        features_list = []
        valid_cookies = []
        
        for cookie in cookies:
            try:
                features = self.feature_extractor.extract_features(cookie)
                features_list.append(features)
                valid_cookies.append(cookie)
            except Exception as e:
                print(f"⚠️  Skipping cookie {cookie.get('name', 'unknown')}: {e}")
                continue
        
        if not features_list:
            return []
        
        # Stack features into matrix
        features_matrix = np.vstack(features_list)
        
        # Batch predict
        y_proba, lacks_evidence = self._apply_evidence_guard(
            features_matrix,
            self._calibrated_probabilities(self.model.predict_proba(features_matrix)),
        )
        y_pred = np.argmax(y_proba, axis=1)
        
        # Create results
        results = []
        for i, cookie in enumerate(valid_cookies):
            # Decode prediction
            predicted_category = self.label_encoder.inverse_transform([y_pred[i]])[0]
            
            # Get confidence score
            confidence_score = float(y_proba[i].max())
            
            # Determine confidence level
            confidence_level = get_confidence_level(confidence_score)
            
            # Determine if auto-classified
            auto_classified = not lacks_evidence[i] and self.can_auto_classify(
                predicted_category, confidence_score
            )
            needs_review = not auto_classified
            
            # Get all probabilities
            probabilities = {
                category: float(prob)
                for category, prob in zip(self.label_encoder.classes_, y_proba[i])
            }
            
            # Get alternative predictions
            alternatives = []
            if return_alternatives:
                sorted_indices = np.argsort(y_proba[i])[::-1]
                
                for idx in sorted_indices[1:top_k+1]:
                    category = self.label_encoder.classes_[idx]
                    probability = float(y_proba[i][idx])
                    
                    if probability > 0.01:
                        alternatives.append(
                            AlternativePrediction(
                                category=category,
                                probability=probability
                            )
                        )
            
            results.append(ClassificationResult(
                cookie_id=cookie.get('id', 'unknown'),
                predicted_category=predicted_category,
                confidence_score=confidence_score,
                confidence_level=confidence_level,
                auto_classified=auto_classified,
                requires_review=needs_review,
                probabilities=probabilities,
                alternatives=alternatives,
                model_version=self.model_version,
                classified_at=datetime.now(),
                insufficient_evidence=bool(lacks_evidence[i]),
            ))
        
        return results
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded model."""
        return {
            'version': self.model_version,
            'model_type': self.metadata.get('model_type', 'unknown'),
            'trained_at': self.metadata.get('trained_at', 'unknown'),
            'num_features': len(self.feature_extractor.get_feature_names()),
            'categories': [str(category) for category in self.label_encoder.classes_],
            'metrics': self.metadata.get('metrics', {}),
            'serialization_format': self.serialization_format,
            'calibration': self.metadata.get('calibration', self.calibration),
            'acceptance': self.metadata.get('acceptance', {}),
        }
    
    def predict_proba(self, cookie: Dict[str, Any]) -> Dict[str, float]:
        """
        Get probability distribution for all categories.
        
        Args:
            cookie: Cookie data dictionary
        
        Returns:
            Dictionary mapping categories to probabilities
        """
        features = self.feature_extractor.extract_features(cookie)
        features_2d = features.reshape(1, -1)
        
        y_proba = self._calibrated_probabilities(self.model.predict_proba(features_2d))[0]
        
        return {
            category: float(prob)
            for category, prob in zip(self.label_encoder.classes_, y_proba)
        }

    def _calibrated_probabilities(self, probabilities: np.ndarray) -> np.ndarray:
        """Apply portable temperature calibration when supplied by the artifact."""
        probabilities = np.asarray(probabilities, dtype=np.float64)
        if self.temperature == 1.0:
            return probabilities
        clipped = np.clip(probabilities, 1e-12, 1.0)
        logits = np.log(clipped) / self.temperature
        logits -= logits.max(axis=1, keepdims=True)
        calibrated = np.exp(logits)
        return calibrated / calibrated.sum(axis=1, keepdims=True)

    def _apply_evidence_guard(
        self, features: np.ndarray, probabilities: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Cap confidence for cookies with no name-pattern or vendor signal.

        Such rows are shrunk toward the uniform distribution until the top
        probability equals NO_EVIDENCE_CONFIDENCE_CAP, so the ranking and the
        probability sum are preserved while the confidence stops overstating
        what the attributes alone can support.
        """
        if not self._evidence_indices:
            return probabilities, np.zeros(len(probabilities), dtype=bool)
        lacks_evidence = ~np.any(features[:, self._evidence_indices] != 0, axis=1)
        guarded = probabilities.copy()
        uniform = 1.0 / probabilities.shape[1]
        for row in np.flatnonzero(lacks_evidence):
            top = guarded[row].max()
            if top > NO_EVIDENCE_CONFIDENCE_CAP:
                weight = (NO_EVIDENCE_CONFIDENCE_CAP - uniform) / (top - uniform)
                guarded[row] = weight * guarded[row] + (1.0 - weight) * uniform
        return guarded, lacks_evidence

    def can_auto_classify(self, category: str, confidence_score: float) -> bool:
        """Honor artifact acceptance gates and calibrated per-class thresholds."""
        acceptance = self.metadata.get("acceptance", {})
        if not (
            acceptance.get("promotion_eligible")
            and acceptance.get("auto_classification_enabled")
        ):
            return False
        policies = self.calibration.get("per_class_auto_thresholds", {})
        policy = policies.get(str(category), {})
        return bool(
            policy.get("enabled")
            and confidence_score >= float(policy.get("threshold", 1.01))
        )
