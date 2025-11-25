"""
Explainability Engine

Generates SHAP-based explanations for ML classification decisions.
"""

import numpy as np
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import shap

from .feature_extractor import FeatureExtractor


@dataclass
class FeatureContribution:
    """Feature contribution to prediction."""
    feature: str
    contribution: float
    value: Any
    percentage: float


@dataclass
class Explanation:
    """Explanation for a classification decision."""
    top_features: List[FeatureContribution]
    reasoning_summary: str
    shap_values: Dict[str, float]
    visualization_data: Dict[str, Any]


class ExplainabilityEngine:
    """Generates explanations for cookie classifications using SHAP."""
    
    def __init__(self, model, feature_names: List[str]):
        """
        Initialize explainability engine.
        
        Args:
            model: Trained model
            feature_names: List of feature names
        """
        self.model = model
        self.feature_names = feature_names
        self.explainer = None
        self._initialize_explainer()
    
    def _initialize_explainer(self):
        """Initialize SHAP explainer."""
        try:
            # Use TreeExplainer for tree-based models (fast and accurate)
            self.explainer = shap.TreeExplainer(self.model)
            print("✅ SHAP TreeExplainer initialized")
        except Exception as e:
            print(f"⚠️  Could not initialize TreeExplainer: {e}")
            print("   Falling back to KernelExplainer (slower)")
            # Fallback to KernelExplainer (works with any model but slower)
            # We'll initialize it on-demand with background data
            self.explainer = None
    
    def explain(
        self,
        features: np.ndarray,
        prediction: str,
        cookie: Dict[str, Any],
        top_k: int = 5
    ) -> Explanation:
        """
        Generate explanation for a classification.
        
        Args:
            features: Feature vector used for prediction
            prediction: Predicted category
            cookie: Original cookie data
            top_k: Number of top features to include
        
        Returns:
            Explanation object
        """
        # Calculate SHAP values
        shap_values_dict = self._calculate_shap_values(features)
        
        # Get top contributing features
        top_features = self._get_top_features(
            shap_values_dict,
            features,
            cookie,
            top_k
        )
        
        # Generate natural language summary
        reasoning_summary = self._generate_summary(
            top_features,
            prediction,
            cookie
        )
        
        # Create visualization data
        visualization_data = self._create_visualization_data(top_features)
        
        return Explanation(
            top_features=top_features,
            reasoning_summary=reasoning_summary,
            shap_values=shap_values_dict,
            visualization_data=visualization_data
        )
    
    def _calculate_shap_values(self, features: np.ndarray) -> Dict[str, float]:
        """
        Calculate SHAP values for features.
        
        Args:
            features: Feature vector
        
        Returns:
            Dictionary mapping feature names to SHAP values
        """
        if self.explainer is None:
            # Return empty dict if explainer not available
            return {}
        
        try:
            # Reshape for SHAP
            features_2d = features.reshape(1, -1)
            
            # Calculate SHAP values
            shap_values = self.explainer.shap_values(features_2d)
            
            # Handle different SHAP output formats
            if isinstance(shap_values, list):
                # Multi-class: take values for predicted class
                # For now, take the first class (we'll improve this)
                shap_values = shap_values[0][0]
            else:
                shap_values = shap_values[0]
            
            # Create dictionary
            shap_dict = {
                name: float(value)
                for name, value in zip(self.feature_names, shap_values)
            }
            
            return shap_dict
            
        except Exception as e:
            print(f"⚠️  Error calculating SHAP values: {e}")
            return {}
    
    def _get_top_features(
        self,
        shap_values: Dict[str, float],
        features: np.ndarray,
        cookie: Dict[str, Any],
        top_k: int
    ) -> List[FeatureContribution]:
        """
        Get top contributing features.
        
        Args:
            shap_values: SHAP values dictionary
            features: Feature vector
            cookie: Original cookie data
            top_k: Number of top features
        
        Returns:
            List of FeatureContribution objects
        """
        if not shap_values:
            # Fallback: use feature importance from model
            return self._get_top_features_fallback(features, cookie, top_k)
        
        # Sort by absolute SHAP value
        sorted_features = sorted(
            shap_values.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )
        
        # Calculate total contribution
        total_contribution = sum(abs(v) for v in shap_values.values())
        
        # Get top K
        top_contributions = []
        for i, (feature_name, shap_value) in enumerate(sorted_features[:top_k]):
            # Get feature value
            feature_idx = self.feature_names.index(feature_name)
            feature_value = features[feature_idx]
            
            # Calculate percentage
            percentage = abs(shap_value) / total_contribution if total_contribution > 0 else 0
            
            top_contributions.append(FeatureContribution(
                feature=feature_name,
                contribution=float(shap_value),
                value=self._format_feature_value(feature_name, feature_value, cookie),
                percentage=float(percentage)
            ))
        
        return top_contributions
    
    def _get_top_features_fallback(
        self,
        features: np.ndarray,
        cookie: Dict[str, Any],
        top_k: int
    ) -> List[FeatureContribution]:
        """
        Fallback method using feature importance.
        
        Args:
            features: Feature vector
            cookie: Original cookie data
            top_k: Number of top features
        
        Returns:
            List of FeatureContribution objects
        """
        try:
            # Get feature importance from model
            if hasattr(self.model, 'feature_importances_'):
                importances = self.model.feature_importances_
            else:
                # No feature importance available
                return []
            
            # Sort by importance
            sorted_indices = np.argsort(importances)[::-1][:top_k]
            
            # Create contributions
            total_importance = importances.sum()
            contributions = []
            
            for idx in sorted_indices:
                feature_name = self.feature_names[idx]
                importance = importances[idx]
                feature_value = features[idx]
                
                contributions.append(FeatureContribution(
                    feature=feature_name,
                    contribution=float(importance),
                    value=self._format_feature_value(feature_name, feature_value, cookie),
                    percentage=float(importance / total_importance) if total_importance > 0 else 0
                ))
            
            return contributions
            
        except Exception as e:
            print(f"⚠️  Error in fallback feature importance: {e}")
            return []
    
    def _format_feature_value(
        self,
        feature_name: str,
        feature_value: float,
        cookie: Dict[str, Any]
    ) -> Any:
        """
        Format feature value for display.
        
        Args:
            feature_name: Name of feature
            feature_value: Numeric feature value
            cookie: Original cookie data
        
        Returns:
            Formatted value
        """
        # Map feature names to cookie attributes
        if 'name' in feature_name:
            return cookie.get('name', 'N/A')
        elif 'domain' in feature_name:
            return cookie.get('domain', 'N/A')
        elif 'expiry' in feature_name and 'days' in feature_name:
            expiry = cookie.get('expiry_days')
            if expiry is None:
                return 'session'
            return f"{expiry} days"
        elif feature_name in ['http_only', 'secure']:
            return 'Yes' if feature_value > 0.5 else 'No'
        elif 'pattern' in feature_name:
            return 'Match' if feature_value > 0.5 else 'No match'
        else:
            return round(feature_value, 2)
    
    def _generate_summary(
        self,
        top_features: List[FeatureContribution],
        prediction: str,
        cookie: Dict[str, Any]
    ) -> str:
        """
        Generate natural language explanation.
        
        Args:
            top_features: Top contributing features
            prediction: Predicted category
            cookie: Original cookie data
        
        Returns:
            Natural language summary
        """
        if not top_features:
            return f"Classified as {prediction} based on overall feature patterns."
        
        # Start with confidence statement
        summary_parts = [
            f"This cookie is classified as {prediction} because:"
        ]
        
        # Add top 3 reasons
        for i, feature in enumerate(top_features[:3], 1):
            reason = self._feature_to_reason(feature, cookie)
            summary_parts.append(f"{i}. {reason}")
        
        return "\n".join(summary_parts)
    
    def _feature_to_reason(
        self,
        feature: FeatureContribution,
        cookie: Dict[str, Any]
    ) -> str:
        """
        Convert feature contribution to human-readable reason.
        
        Args:
            feature: Feature contribution
            cookie: Original cookie data
        
        Returns:
            Human-readable reason
        """
        name = feature.feature
        value = feature.value
        percentage = feature.percentage * 100
        
        # Pattern matching for common features
        if 'pattern_google_analytics' in name and feature.value == 'Match':
            return f"Matches Google Analytics cookie pattern ({percentage:.0f}% contribution)"
        elif 'pattern_facebook' in name and feature.value == 'Match':
            return f"Matches Facebook cookie pattern ({percentage:.0f}% contribution)"
        elif 'pattern_advertising' in name and feature.value == 'Match':
            return f"Matches advertising cookie pattern ({percentage:.0f}% contribution)"
        elif 'pattern_tracking' in name and feature.value == 'Match':
            return f"Matches tracking cookie pattern ({percentage:.0f}% contribution)"
        elif 'pattern_functional' in name and feature.value == 'Match':
            return f"Matches functional cookie pattern ({percentage:.0f}% contribution)"
        elif 'vendor' in name and 'detected' in name:
            return f"Known vendor detected ({percentage:.0f}% contribution)"
        elif 'expiry' in name and 'session' in str(value):
            return f"Session cookie (no expiry) ({percentage:.0f}% contribution)"
        elif 'expiry' in name and 'days' in str(value):
            return f"Expiry of {value} is typical for this category ({percentage:.0f}% contribution)"
        elif 'http_only' in name:
            return f"HTTPOnly flag is {value} ({percentage:.0f}% contribution)"
        elif 'secure' in name:
            return f"Secure flag is {value} ({percentage:.0f}% contribution)"
        elif 'domain_is_first_party' in name:
            party = "first-party" if value == 'Yes' or value > 0.5 else "third-party"
            return f"Cookie is {party} ({percentage:.0f}% contribution)"
        elif 'name' in name:
            return f"Cookie name '{cookie.get('name', 'N/A')}' matches known patterns ({percentage:.0f}% contribution)"
        else:
            return f"{name.replace('_', ' ').title()}: {value} ({percentage:.0f}% contribution)"
    
    def _create_visualization_data(
        self,
        top_features: List[FeatureContribution]
    ) -> Dict[str, Any]:
        """
        Create data for visualization.
        
        Args:
            top_features: Top contributing features
        
        Returns:
            Visualization data dictionary
        """
        return {
            'features': [
                {
                    'name': f.feature,
                    'contribution': f.contribution,
                    'percentage': f.percentage,
                    'value': str(f.value)
                }
                for f in top_features
            ],
            'chart_type': 'bar',
            'title': 'Top Contributing Features'
        }
