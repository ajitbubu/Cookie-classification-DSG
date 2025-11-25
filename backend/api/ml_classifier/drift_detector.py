"""
Drift Detection Module

Monitors model drift by detecting changes in:
1. Feature distributions (using KL divergence)
2. Prediction distributions (category distribution changes)

Generates alerts when drift exceeds configured thresholds.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import numpy as np
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    """Alert severity levels."""
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class DriftAlert:
    """Drift detection alert."""
    alert_level: AlertLevel
    alert_type: str  # "feature_drift" or "prediction_drift"
    message: str
    metric_value: float
    threshold: float
    detected_at: datetime
    details: Dict[str, Any]


class DriftDetector:
    """
    Detects model drift by monitoring feature and prediction distributions.
    
    Implements:
    - Feature distribution drift using KL divergence
    - Prediction distribution drift (category changes)
    - Alert generation for threshold violations
    """
    
    def __init__(
        self,
        feature_drift_threshold: float = 0.1,
        prediction_drift_threshold: float = 0.20,
        baseline_window_days: int = 7,
        comparison_window_days: int = 1
    ):
        """
        Initialize drift detector.
        
        Args:
            feature_drift_threshold: KL divergence threshold for feature drift (default: 0.1)
            prediction_drift_threshold: Threshold for prediction drift (default: 0.20 = 20%)
            baseline_window_days: Days to use for baseline distribution (default: 7)
            comparison_window_days: Days to use for comparison (default: 1)
        """
        self.feature_drift_threshold = feature_drift_threshold
        self.prediction_drift_threshold = prediction_drift_threshold
        self.baseline_window_days = baseline_window_days
        self.comparison_window_days = comparison_window_days
        
        logger.info(
            f"Initialized DriftDetector with feature_threshold={feature_drift_threshold}, "
            f"prediction_threshold={prediction_drift_threshold}"
        )
    
    def detect_feature_drift(
        self,
        baseline_features: np.ndarray,
        current_features: np.ndarray,
        feature_names: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[DriftAlert]]:
        """
        Detect feature distribution drift using KL divergence.
        
        Args:
            baseline_features: Baseline feature matrix (n_samples, n_features)
            current_features: Current feature matrix (n_samples, n_features)
            feature_names: Optional list of feature names
        
        Returns:
            Tuple of (drift_detected: bool, alert: Optional[DriftAlert])
        """
        try:
            if baseline_features.shape[1] != current_features.shape[1]:
                logger.error(
                    f"Feature dimension mismatch: baseline={baseline_features.shape[1]}, "
                    f"current={current_features.shape[1]}"
                )
                return False, None
            
            n_features = baseline_features.shape[1]
            kl_divergences = []
            drifted_features = []
            
            # Calculate KL divergence for each feature
            for i in range(n_features):
                baseline_feature = baseline_features[:, i]
                current_feature = current_features[:, i]
                
                kl_div = self._calculate_kl_divergence(baseline_feature, current_feature)
                kl_divergences.append(kl_div)
                
                if kl_div > self.feature_drift_threshold:
                    feature_name = feature_names[i] if feature_names else f"feature_{i}"
                    drifted_features.append({
                        "feature": feature_name,
                        "kl_divergence": float(kl_div)
                    })
            
            # Calculate average KL divergence
            avg_kl_divergence = np.mean(kl_divergences)
            max_kl_divergence = np.max(kl_divergences)
            
            logger.info(
                f"Feature drift check: avg_kl={avg_kl_divergence:.4f}, "
                f"max_kl={max_kl_divergence:.4f}, "
                f"drifted_features={len(drifted_features)}"
            )
            
            # Generate alert if drift detected
            if drifted_features:
                alert = DriftAlert(
                    alert_level=AlertLevel.WARNING,
                    alert_type="feature_drift",
                    message=f"Feature distribution drift detected: {len(drifted_features)} features exceeded threshold",
                    metric_value=float(max_kl_divergence),
                    threshold=self.feature_drift_threshold,
                    detected_at=datetime.now(),
                    details={
                        "avg_kl_divergence": float(avg_kl_divergence),
                        "max_kl_divergence": float(max_kl_divergence),
                        "drifted_features": drifted_features,
                        "total_features": n_features
                    }
                )
                
                logger.warning(
                    f"Feature drift alert: {len(drifted_features)} features drifted, "
                    f"max KL divergence: {max_kl_divergence:.4f}"
                )
                
                return True, alert
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error detecting feature drift: {e}", exc_info=True)
            return False, None
    
    def detect_prediction_drift(
        self,
        baseline_predictions: Dict[str, int],
        current_predictions: Dict[str, int]
    ) -> Tuple[bool, Optional[DriftAlert]]:
        """
        Detect prediction distribution drift.
        
        Calculates percentage change in category distribution and alerts
        if change exceeds threshold (default: 20%).
        
        Args:
            baseline_predictions: Baseline category counts {"Analytics": 100, "Marketing": 50, ...}
            current_predictions: Current category counts
        
        Returns:
            Tuple of (drift_detected: bool, alert: Optional[DriftAlert])
        """
        try:
            # Calculate distributions
            baseline_total = sum(baseline_predictions.values())
            current_total = sum(current_predictions.values())
            
            if baseline_total == 0 or current_total == 0:
                logger.warning("Cannot detect prediction drift: zero predictions")
                return False, None
            
            baseline_dist = {
                cat: count / baseline_total
                for cat, count in baseline_predictions.items()
            }
            current_dist = {
                cat: count / current_total
                for cat, count in current_predictions.items()
            }
            
            # Calculate percentage changes
            changes = {}
            max_change = 0.0
            max_change_category = None
            
            all_categories = set(baseline_dist.keys()) | set(current_dist.keys())
            
            for category in all_categories:
                baseline_pct = baseline_dist.get(category, 0.0)
                current_pct = current_dist.get(category, 0.0)
                
                # Calculate absolute percentage point change
                change = abs(current_pct - baseline_pct)
                changes[category] = {
                    "baseline_pct": float(baseline_pct),
                    "current_pct": float(current_pct),
                    "change": float(change)
                }
                
                if change > max_change:
                    max_change = change
                    max_change_category = category
            
            logger.info(
                f"Prediction drift check: max_change={max_change:.2%} "
                f"(category: {max_change_category})"
            )
            
            # Generate alert if drift exceeds threshold
            if max_change > self.prediction_drift_threshold:
                alert = DriftAlert(
                    alert_level=AlertLevel.CRITICAL,
                    alert_type="prediction_drift",
                    message=f"Prediction distribution drift detected: {max_change:.1%} change in {max_change_category}",
                    metric_value=float(max_change),
                    threshold=self.prediction_drift_threshold,
                    detected_at=datetime.now(),
                    details={
                        "max_change": float(max_change),
                        "max_change_category": max_change_category,
                        "category_changes": changes,
                        "baseline_total": baseline_total,
                        "current_total": current_total
                    }
                )
                
                logger.warning(
                    f"Prediction drift alert: {max_change:.1%} change in {max_change_category} "
                    f"(threshold: {self.prediction_drift_threshold:.1%})"
                )
                
                return True, alert
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error detecting prediction drift: {e}", exc_info=True)
            return False, None
    
    def _calculate_kl_divergence(
        self,
        baseline: np.ndarray,
        current: np.ndarray,
        n_bins: int = 10
    ) -> float:
        """
        Calculate KL divergence between two distributions.
        
        Uses histogram binning to estimate probability distributions.
        
        Args:
            baseline: Baseline feature values
            current: Current feature values
            n_bins: Number of bins for histogram (default: 10)
        
        Returns:
            KL divergence value
        """
        try:
            # Determine bin edges from combined data
            combined = np.concatenate([baseline, current])
            bin_edges = np.histogram_bin_edges(combined, bins=n_bins)
            
            # Calculate histograms
            baseline_hist, _ = np.histogram(baseline, bins=bin_edges)
            current_hist, _ = np.histogram(current, bins=bin_edges)
            
            # Convert to probabilities (add small epsilon to avoid log(0))
            epsilon = 1e-10
            baseline_prob = (baseline_hist + epsilon) / (baseline_hist.sum() + n_bins * epsilon)
            current_prob = (current_hist + epsilon) / (current_hist.sum() + n_bins * epsilon)
            
            # Calculate KL divergence: sum(P(x) * log(P(x) / Q(x)))
            kl_div = np.sum(current_prob * np.log(current_prob / baseline_prob))
            
            return float(kl_div)
            
        except Exception as e:
            logger.error(f"Error calculating KL divergence: {e}", exc_info=True)
            return 0.0
    
    def check_drift_from_metrics(
        self,
        baseline_date: date,
        current_date: date,
        metrics_data: List[Dict[str, Any]]
    ) -> List[DriftAlert]:
        """
        Check for prediction drift using aggregated metrics data.
        
        Args:
            baseline_date: Start date for baseline period
            current_date: Date for current period
            metrics_data: List of metrics dictionaries from ml_metrics table
        
        Returns:
            List of drift alerts
        """
        alerts = []
        
        try:
            # Separate baseline and current metrics
            baseline_end = baseline_date + timedelta(days=self.baseline_window_days)
            
            baseline_metrics = [
                m for m in metrics_data
                if baseline_date <= m['metric_date'] < baseline_end
            ]
            
            current_metrics = [
                m for m in metrics_data
                if m['metric_date'] == current_date
            ]
            
            if not baseline_metrics or not current_metrics:
                logger.warning("Insufficient metrics data for drift detection")
                return alerts
            
            # Aggregate category counts
            baseline_predictions = self._aggregate_category_counts(baseline_metrics)
            current_predictions = self._aggregate_category_counts(current_metrics)
            
            # Check prediction drift
            drift_detected, alert = self.detect_prediction_drift(
                baseline_predictions,
                current_predictions
            )
            
            if drift_detected and alert:
                alerts.append(alert)
            
        except Exception as e:
            logger.error(f"Error checking drift from metrics: {e}", exc_info=True)
        
        return alerts
    
    def _aggregate_category_counts(self, metrics: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Aggregate category counts from metrics.
        
        Args:
            metrics: List of metrics dictionaries
        
        Returns:
            Dictionary of category counts
        """
        counts = {
            "Strictly Necessary": 0,
            "Analytics": 0,
            "Marketing": 0,
            "Functional": 0,
            "Unknown": 0
        }
        
        for metric in metrics:
            counts["Strictly Necessary"] += metric.get("strictly_necessary_count", 0)
            counts["Analytics"] += metric.get("analytics_count", 0)
            counts["Marketing"] += metric.get("marketing_count", 0)
            counts["Functional"] += metric.get("functional_count", 0)
            counts["Unknown"] += metric.get("unknown_count", 0)
        
        return counts
    
    def generate_drift_report(
        self,
        alerts: List[DriftAlert]
    ) -> Dict[str, Any]:
        """
        Generate drift detection report.
        
        Args:
            alerts: List of drift alerts
        
        Returns:
            Report dictionary
        """
        if not alerts:
            return {
                "drift_detected": False,
                "total_alerts": 0,
                "warning_count": 0,
                "critical_count": 0,
                "alerts": []
            }
        
        warning_count = sum(1 for a in alerts if a.alert_level == AlertLevel.WARNING)
        critical_count = sum(1 for a in alerts if a.alert_level == AlertLevel.CRITICAL)
        
        return {
            "drift_detected": True,
            "total_alerts": len(alerts),
            "warning_count": warning_count,
            "critical_count": critical_count,
            "alerts": [
                {
                    "level": alert.alert_level.value,
                    "type": alert.alert_type,
                    "message": alert.message,
                    "metric_value": alert.metric_value,
                    "threshold": alert.threshold,
                    "detected_at": alert.detected_at.isoformat(),
                    "details": alert.details
                }
                for alert in alerts
            ]
        }


# Global drift detector instance
_drift_detector = None


def get_drift_detector() -> DriftDetector:
    """Get singleton drift detector instance."""
    global _drift_detector
    if _drift_detector is None:
        _drift_detector = DriftDetector()
    return _drift_detector
