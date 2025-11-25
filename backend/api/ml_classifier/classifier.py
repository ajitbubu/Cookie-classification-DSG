"""
Cookie Classification Engine

Loads trained models and performs cookie classification with confidence scoring.
"""

import joblib
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from .feature_extractor import FeatureExtractor
from .config import (
    get_model_path,
    get_confidence_level,
    should_auto_classify,
    requires_review,
    CATEGORIES
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


class CookieClassifier:
    """Classifies cookies using trained ML model."""
    
    def __init__(self, model_version: Optional[str] = None):
        """
        Initialize classifier with trained model.
        
        Args:
            model_version: Model version to load (None for latest)
        """
        self.model_version = model_version
        self.model_path = get_model_path(model_version)
        
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        
        # Load model components
        self._load_model()
        
        # Initialize feature extractor
        self.feature_extractor = FeatureExtractor()
    
    def _load_model(self):
        """Load model and associated artifacts."""
        print(f"📦 Loading model from {self.model_path}...")
        
        # Load model
        model_file = self.model_path / "model.pkl"
        if not model_file.exists():
            raise FileNotFoundError(f"Model file not found: {model_file}")
        
        self.model = joblib.load(model_file)
        
        # Load label encoder
        encoder_file = self.model_path / "label_encoder.pkl"
        if not encoder_file.exists():
            raise FileNotFoundError(f"Label encoder not found: {encoder_file}")
        
        self.label_encoder = joblib.load(encoder_file)
        
        # Load metadata
        metadata_file = self.model_path / "metadata.json"
        if metadata_file.exists():
            import json
            with open(metadata_file, 'r') as f:
                self.metadata = json.load(f)
                self.model_version = self.metadata.get('version', 'unknown')
        else:
            self.metadata = {}
            self.model_version = 'unknown'
        
        print(f"✅ Model loaded: v{self.model_version}")
        print(f"   Type: {self.metadata.get('model_type', 'unknown')}")
        print(f"   Accuracy: {self.metadata.get('metrics', {}).get('accuracy', 'N/A')}")
    
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
        y_pred = self.model.predict(features_2d)[0]
        y_proba = self.model.predict_proba(features_2d)[0]
        
        # Decode prediction
        predicted_category = self.label_encoder.inverse_transform([y_pred])[0]
        
        # Get confidence score (max probability)
        confidence_score = float(y_proba.max())
        
        # Determine confidence level
        confidence_level = get_confidence_level(confidence_score)
        
        # Determine if auto-classified
        auto_classified = should_auto_classify(confidence_score)
        needs_review = requires_review(confidence_score)
        
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
            classified_at=datetime.now()
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
        y_pred = self.model.predict(features_matrix)
        y_proba = self.model.predict_proba(features_matrix)
        
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
            auto_classified = should_auto_classify(confidence_score)
            needs_review = requires_review(confidence_score)
            
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
                classified_at=datetime.now()
            ))
        
        return results
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded model."""
        return {
            'version': self.model_version,
            'model_type': self.metadata.get('model_type', 'unknown'),
            'trained_at': self.metadata.get('trained_at', 'unknown'),
            'num_features': self.metadata.get('num_features', 0),
            'categories': self.metadata.get('categories', []),
            'metrics': self.metadata.get('metrics', {})
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
        
        y_proba = self.model.predict_proba(features_2d)[0]
        
        return {
            category: float(prob)
            for category, prob in zip(self.label_encoder.classes_, y_proba)
        }
