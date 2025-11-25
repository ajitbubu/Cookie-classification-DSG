"""
Metrics Collection Service

Collects and aggregates ML classification metrics for monitoring and analysis.
"""

from typing import Dict, Any, Optional
from datetime import datetime, date
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ClassificationMetric:
    """Single classification metric."""
    cookie_id: str
    predicted_category: str
    confidence_score: float
    confidence_level: str
    auto_classified: bool
    requires_review: bool
    model_version: str
    classification_latency_ms: float
    timestamp: datetime


class MetricsCollector:
    """
    Collects and aggregates ML classification metrics.
    
    Tracks:
    - Total predictions
    - Auto-classification rate
    - Confidence distribution
    - Category distribution
    - Performance metrics
    - Correction rate
    """
    
    def __init__(self):
        """Initialize metrics collector."""
        self.metrics_buffer = []
        self.buffer_size = 100  # Flush after 100 metrics
    
    def log_classification(
        self,
        cookie_id: str,
        predicted_category: str,
        confidence_score: float,
        confidence_level: str,
        auto_classified: bool,
        requires_review: bool,
        model_version: str,
        classification_latency_ms: float
    ):
        """
        Log a classification metric.
        
        Args:
            cookie_id: Cookie UUID
            predicted_category: Predicted category
            confidence_score: Confidence score (0.0-1.0)
            confidence_level: High/Medium/Low
            auto_classified: Whether auto-classified
            requires_review: Whether requires review
            model_version: Model version used
            classification_latency_ms: Processing time in ms
        """
        metric = ClassificationMetric(
            cookie_id=cookie_id,
            predicted_category=predicted_category,
            confidence_score=confidence_score,
            confidence_level=confidence_level,
            auto_classified=auto_classified,
            requires_review=requires_review,
            model_version=model_version,
            classification_latency_ms=classification_latency_ms,
            timestamp=datetime.now()
        )
        
        self.metrics_buffer.append(metric)
        
        # Flush if buffer full
        if len(self.metrics_buffer) >= self.buffer_size:
            self.flush()
        
        logger.debug(
            f"Logged classification metric: {predicted_category} "
            f"(confidence: {confidence_score:.2f}, latency: {classification_latency_ms:.1f}ms)"
        )
    
    def flush(self):
        """
        Flush metrics buffer to database.
        
        Aggregates metrics and stores in ml_metrics table.
        """
        if not self.metrics_buffer:
            return
        
        try:
            # Aggregate metrics
            aggregated = self._aggregate_metrics(self.metrics_buffer)
            
            # Store in database
            self._store_metrics(aggregated)
            
            logger.info(f"Flushed {len(self.metrics_buffer)} metrics to database")
            
            # Clear buffer
            self.metrics_buffer = []
            
        except Exception as e:
            logger.error(f"Error flushing metrics: {e}", exc_info=True)
    
    def _aggregate_metrics(self, metrics: list) -> Dict[str, Any]:
        """
        Aggregate metrics for storage.
        
        Args:
            metrics: List of ClassificationMetric objects
        
        Returns:
            Aggregated metrics dictionary
        """
        if not metrics:
            return {}
        
        total = len(metrics)
        
        # Count by confidence level
        high_count = sum(1 for m in metrics if m.confidence_level == "High")
        medium_count = sum(1 for m in metrics if m.confidence_level == "Medium")
        low_count = sum(1 for m in metrics if m.confidence_level == "Low")
        
        # Count by category
        category_counts = {
            "strictly_necessary": sum(1 for m in metrics if m.predicted_category == "Strictly Necessary"),
            "analytics": sum(1 for m in metrics if m.predicted_category == "Analytics"),
            "marketing": sum(1 for m in metrics if m.predicted_category == "Marketing"),
            "functional": sum(1 for m in metrics if m.predicted_category == "Functional"),
            "unknown": sum(1 for m in metrics if m.predicted_category == "Unknown")
        }
        
        # Auto-classification counts
        auto_classified_count = sum(1 for m in metrics if m.auto_classified)
        requires_review_count = sum(1 for m in metrics if m.requires_review)
        
        # Average confidence
        avg_confidence = sum(m.confidence_score for m in metrics) / total
        
        # Performance metrics
        latencies = [m.classification_latency_ms for m in metrics]
        avg_latency = sum(latencies) / len(latencies)
        p95_latency = self._calculate_percentile(latencies, 95)
        
        # Get date and hour
        first_metric = metrics[0]
        metric_date = first_metric.timestamp.date()
        metric_hour = first_metric.timestamp.hour
        model_version = first_metric.model_version
        
        return {
            "metric_date": metric_date,
            "metric_hour": metric_hour,
            "model_version": model_version,
            "total_predictions": total,
            "auto_classified_count": auto_classified_count,
            "requires_review_count": requires_review_count,
            "high_confidence_count": high_count,
            "medium_confidence_count": medium_count,
            "low_confidence_count": low_count,
            "avg_confidence_score": avg_confidence,
            "strictly_necessary_count": category_counts["strictly_necessary"],
            "analytics_count": category_counts["analytics"],
            "marketing_count": category_counts["marketing"],
            "functional_count": category_counts["functional"],
            "unknown_count": category_counts["unknown"],
            "avg_classification_latency_ms": avg_latency,
            "p95_classification_latency_ms": p95_latency,
            "correction_count": 0,  # TODO: Get from ml_feedback table
            "correction_rate": 0.0
        }
    
    def _calculate_percentile(self, values: list, percentile: int) -> float:
        """
        Calculate percentile of values.
        
        Args:
            values: List of numeric values
            percentile: Percentile to calculate (0-100)
        
        Returns:
            Percentile value
        """
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        index = int(len(sorted_values) * percentile / 100)
        index = min(index, len(sorted_values) - 1)
        
        return sorted_values[index]
    
    def _store_metrics(self, aggregated: Dict[str, Any]):
        """
        Store aggregated metrics in database.
        
        Args:
            aggregated: Aggregated metrics dictionary
        """
        # TODO: Implement database storage
        # INSERT INTO ml_metrics (...) VALUES (...)
        # ON CONFLICT (metric_date, metric_hour, model_version)
        # DO UPDATE SET ...
        
        logger.info(
            f"Storing metrics: {aggregated['total_predictions']} predictions, "
            f"avg confidence: {aggregated['avg_confidence_score']:.2f}, "
            f"avg latency: {aggregated['avg_classification_latency_ms']:.1f}ms"
        )
    
    def get_hourly_metrics(
        self,
        metric_date: date,
        metric_hour: int,
        model_version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get hourly metrics from database.
        
        Args:
            metric_date: Date of metrics
            metric_hour: Hour of metrics (0-23)
            model_version: Optional model version filter
        
        Returns:
            Metrics dictionary or None
        """
        # TODO: Implement database query
        # SELECT * FROM ml_metrics
        # WHERE metric_date = ? AND metric_hour = ?
        # AND (model_version = ? OR ? IS NULL)
        
        return None
    
    def get_daily_metrics(
        self,
        metric_date: date,
        model_version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get daily aggregated metrics from database.
        
        Args:
            metric_date: Date of metrics
            model_version: Optional model version filter
        
        Returns:
            Aggregated metrics dictionary or None
        """
        # TODO: Implement database query
        # SELECT SUM(...), AVG(...) FROM ml_metrics
        # WHERE metric_date = ?
        # AND (model_version = ? OR ? IS NULL)
        # GROUP BY metric_date, model_version
        
        return None
    
    def get_metrics_range(
        self,
        start_date: date,
        end_date: date,
        model_version: Optional[str] = None
    ) -> list:
        """
        Get metrics for date range.
        
        Args:
            start_date: Start date
            end_date: End date
            model_version: Optional model version filter
        
        Returns:
            List of daily metrics
        """
        # TODO: Implement database query
        # SELECT * FROM ml_metrics
        # WHERE metric_date BETWEEN ? AND ?
        # AND (model_version = ? OR ? IS NULL)
        # ORDER BY metric_date
        
        return []


# Global metrics collector instance
_metrics_collector = None


def get_metrics_collector() -> MetricsCollector:
    """Get singleton metrics collector instance."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector
