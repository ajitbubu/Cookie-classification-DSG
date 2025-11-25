"""
ML Classification Database Manager

Handles all database operations for ML classification system.
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, date
from uuid import UUID
import psycopg2
from psycopg2.extras import RealDictCursor, Json
import json


class MLDatabaseManager:
    """Manages database operations for ML classification."""
    
    def __init__(self, db_config: Dict[str, Any]):
        """
        Initialize database manager.
        
        Args:
            db_config: Database configuration dict with host, port, database, user, password
        """
        self.db_config = db_config
        self._conn = None
    
    def connect(self):
        """Establish database connection."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(**self.db_config)
        return self._conn
    
    def close(self):
        """Close database connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()
    
    # ========================================================================
    # ML Classifications
    # ========================================================================
    
    def store_classification(
        self,
        cookie_id: UUID,
        scan_id: str,
        predicted_category: str,
        confidence_score: float,
        confidence_level: str,
        alternative_predictions: List[Dict],
        shap_values: Dict,
        top_features: List[Dict],
        explanation_summary: str,
        model_version: str,
        auto_classified: bool,
        requires_review: bool
    ) -> UUID:
        """
        Store ML classification result.
        
        Returns:
            UUID of created classification record
        """
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ml_classifications (
                    cookie_id, scan_id, predicted_category, confidence_score,
                    confidence_level, alternative_predictions, shap_values,
                    top_features, explanation_summary, model_version,
                    auto_classified, requires_review
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id;
            """, (
                str(cookie_id), scan_id, predicted_category, confidence_score,
                confidence_level, Json(alternative_predictions), Json(shap_values),
                Json(top_features), explanation_summary, model_version,
                auto_classified, requires_review
            ))
            
            classification_id = cursor.fetchone()[0]
            conn.commit()
            return UUID(classification_id)
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_classification(self, classification_id: UUID) -> Optional[Dict]:
        """Get classification by ID."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM ml_classifications WHERE id = %s;
            """, (str(classification_id),))
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        finally:
            cursor.close()
    
    def get_classifications_by_scan(self, scan_id: str) -> List[Dict]:
        """Get all classifications for a scan."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM ml_classifications 
                WHERE scan_id = %s
                ORDER BY classified_at DESC;
            """, (scan_id,))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
    
    def get_classification_history(self, cookie_id: UUID) -> List[Dict]:
        """Get classification history for a cookie."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM ml_classifications 
                WHERE cookie_id = %s
                ORDER BY classified_at DESC;
            """, (str(cookie_id),))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
    
    # ========================================================================
    # ML Feedback
    # ========================================================================
    
    def store_feedback(
        self,
        cookie_id: UUID,
        classification_id: Optional[UUID],
        predicted_label: str,
        corrected_label: str,
        confidence_score: float,
        user_id: Optional[UUID] = None,
        feedback_note: Optional[str] = None,
        applied_to_similar: bool = False,
        similar_cookies_count: int = 0,
        similar_cookie_ids: Optional[List[UUID]] = None
    ) -> UUID:
        """Store user feedback/correction."""
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ml_feedback (
                    cookie_id, classification_id, predicted_label, corrected_label,
                    confidence_score, user_id, feedback_note, applied_to_similar,
                    similar_cookies_count, similar_cookie_ids
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id;
            """, (
                str(cookie_id),
                str(classification_id) if classification_id else None,
                predicted_label, corrected_label, confidence_score,
                str(user_id) if user_id else None,
                feedback_note, applied_to_similar, similar_cookies_count,
                Json([str(cid) for cid in similar_cookie_ids]) if similar_cookie_ids else None
            ))
            
            feedback_id = cursor.fetchone()[0]
            conn.commit()
            return UUID(feedback_id)
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_unused_feedback(self, limit: int = 1000) -> List[Dict]:
        """Get feedback not yet used in training."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM ml_feedback 
                WHERE used_in_training = false
                ORDER BY created_at ASC
                LIMIT %s;
            """, (limit,))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
    
    def mark_feedback_used(self, feedback_ids: List[UUID]):
        """Mark feedback as used in training."""
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE ml_feedback 
                SET used_in_training = true
                WHERE id = ANY(%s);
            """, ([str(fid) for fid in feedback_ids],))
            
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    # ========================================================================
    # ML Metrics
    # ========================================================================
    
    def store_metrics(
        self,
        metric_date: date,
        model_version: str,
        metrics_data: Dict[str, Any],
        metric_hour: Optional[int] = None
    ):
        """Store aggregated metrics."""
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO ml_metrics (
                    metric_date, metric_hour, model_version,
                    total_predictions, auto_classified_count, requires_review_count,
                    high_confidence_count, medium_confidence_count, low_confidence_count,
                    avg_confidence_score, strictly_necessary_count, analytics_count,
                    marketing_count, functional_count, unknown_count,
                    correction_count, correction_rate,
                    avg_classification_latency_ms, p95_classification_latency_ms
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (metric_date, metric_hour, model_version)
                DO UPDATE SET
                    total_predictions = EXCLUDED.total_predictions,
                    auto_classified_count = EXCLUDED.auto_classified_count,
                    requires_review_count = EXCLUDED.requires_review_count,
                    high_confidence_count = EXCLUDED.high_confidence_count,
                    medium_confidence_count = EXCLUDED.medium_confidence_count,
                    low_confidence_count = EXCLUDED.low_confidence_count,
                    avg_confidence_score = EXCLUDED.avg_confidence_score,
                    strictly_necessary_count = EXCLUDED.strictly_necessary_count,
                    analytics_count = EXCLUDED.analytics_count,
                    marketing_count = EXCLUDED.marketing_count,
                    functional_count = EXCLUDED.functional_count,
                    unknown_count = EXCLUDED.unknown_count,
                    correction_count = EXCLUDED.correction_count,
                    correction_rate = EXCLUDED.correction_rate,
                    avg_classification_latency_ms = EXCLUDED.avg_classification_latency_ms,
                    p95_classification_latency_ms = EXCLUDED.p95_classification_latency_ms;
            """, (
                metric_date, metric_hour, model_version,
                metrics_data.get('total_predictions', 0),
                metrics_data.get('auto_classified_count', 0),
                metrics_data.get('requires_review_count', 0),
                metrics_data.get('high_confidence_count', 0),
                metrics_data.get('medium_confidence_count', 0),
                metrics_data.get('low_confidence_count', 0),
                metrics_data.get('avg_confidence_score'),
                metrics_data.get('strictly_necessary_count', 0),
                metrics_data.get('analytics_count', 0),
                metrics_data.get('marketing_count', 0),
                metrics_data.get('functional_count', 0),
                metrics_data.get('unknown_count', 0),
                metrics_data.get('correction_count', 0),
                metrics_data.get('correction_rate'),
                metrics_data.get('avg_classification_latency_ms'),
                metrics_data.get('p95_classification_latency_ms')
            ))
            
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    def get_metrics(
        self,
        start_date: date,
        end_date: date,
        model_version: Optional[str] = None
    ) -> List[Dict]:
        """Get metrics for date range."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            if model_version:
                cursor.execute("""
                    SELECT * FROM ml_metrics 
                    WHERE metric_date BETWEEN %s AND %s
                    AND model_version = %s
                    ORDER BY metric_date DESC, metric_hour DESC NULLS LAST;
                """, (start_date, end_date, model_version))
            else:
                cursor.execute("""
                    SELECT * FROM ml_metrics 
                    WHERE metric_date BETWEEN %s AND %s
                    ORDER BY metric_date DESC, metric_hour DESC NULLS LAST;
                """, (start_date, end_date))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
    
    # ========================================================================
    # Vendor Database
    # ========================================================================
    
    def get_vendor_by_name(self, vendor_name: str) -> Optional[Dict]:
        """Get vendor by name."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT * FROM vendor_database WHERE vendor_name = %s;
            """, (vendor_name,))
            
            result = cursor.fetchone()
            return dict(result) if result else None
            
        finally:
            cursor.close()
    
    def search_vendors(self, cookie_name: str, domain: str) -> List[Dict]:
        """Search for matching vendors based on cookie name and domain."""
        conn = self.connect()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # This is a simplified search - in production, implement pattern matching
            cursor.execute("""
                SELECT * FROM vendor_database 
                WHERE vendor_domain = %s
                OR %s ILIKE ANY(
                    SELECT jsonb_array_elements_text(cookie_name_patterns)
                )
                ORDER BY confidence_score DESC
                LIMIT 5;
            """, (domain, cookie_name))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
    
    def add_vendor(
        self,
        vendor_name: str,
        vendor_domain: str,
        typical_category: str,
        cookie_name_patterns: List[str],
        domain_patterns: List[str],
        confidence_score: float = 1.0,
        source: str = "manual"
    ) -> UUID:
        """Add new vendor to database."""
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO vendor_database (
                    vendor_name, vendor_domain, typical_category,
                    cookie_name_patterns, domain_patterns,
                    confidence_score, source
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                vendor_name, vendor_domain, typical_category,
                Json(cookie_name_patterns), Json(domain_patterns),
                confidence_score, source
            ))
            
            vendor_id = cursor.fetchone()[0]
            conn.commit()
            return UUID(vendor_id)
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
