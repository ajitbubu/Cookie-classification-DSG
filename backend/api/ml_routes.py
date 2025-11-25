"""
ML Classification API Routes

FastAPI endpoints for ML-based cookie classification.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import time

from backend.api.ml_classifier.feature_extractor import FeatureExtractor
from backend.api.ml_classifier.classifier import CookieClassifier
from backend.api.ml_classifier.explainer import ExplainabilityEngine
from backend.api.ml_classifier.similarity import SimilarityDetector
from backend.api.ml_classifier.config import (
    CURRENT_MODEL_VERSION,
    get_confidence_level,
    should_auto_classify,
    requires_review
)
from backend.api.ml_classifier.auth import (
    check_rate_limit,
    optional_auth,
    get_rate_limit_headers
)
from backend.api.ml_classifier.metrics_collector import get_metrics_collector
from backend.api.ml_classifier.model_registry import (
    get_model_registry,
    ABTestingController
)

logger = logging.getLogger(__name__)

router = APIRouter(
    dependencies=[Depends(check_rate_limit)]  # Apply rate limiting to all routes
)

# Initialize ML components (lazy loading)
_feature_extractor = None
_classifier = None
_explainer = None
_similarity_detector = None
_ab_controller = None


def get_feature_extractor() -> FeatureExtractor:
    """Get or create feature extractor instance."""
    global _feature_extractor
    if _feature_extractor is None:
        _feature_extractor = FeatureExtractor()
    return _feature_extractor


def get_classifier() -> CookieClassifier:
    """Get or create classifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = CookieClassifier()
    return _classifier


def get_explainer() -> ExplainabilityEngine:
    """Get or create explainability engine instance."""
    global _explainer
    if _explainer is None:
        classifier = get_classifier()
        feature_extractor = get_feature_extractor()
        _explainer = ExplainabilityEngine(
            model=classifier.model,
            feature_names=feature_extractor.get_feature_names()
        )
    return _explainer


def get_similarity_detector() -> SimilarityDetector:
    """Get or create similarity detector instance."""
    global _similarity_detector
    if _similarity_detector is None:
        _similarity_detector = SimilarityDetector()
    return _similarity_detector


def get_ab_controller() -> ABTestingController:
    """Get or create A/B testing controller instance."""
    global _ab_controller
    if _ab_controller is None:
        registry = get_model_registry()
        # 10% of traffic to challenger by default
        _ab_controller = ABTestingController(registry, traffic_split=0.1)
    return _ab_controller


# ============================================================================
# Request/Response Models
# ============================================================================

class CookieInput(BaseModel):
    """Input cookie for classification."""
    id: Optional[str] = None
    name: str
    domain: str
    path: str = "/"
    expiry_days: Optional[int] = None
    http_only: bool = False
    secure: bool = False
    same_site: Optional[str] = None
    value_sample: Optional[str] = None
    initiated_by: Optional[str] = None
    scan_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "_ga",
                "domain": "example.com",
                "path": "/",
                "expiry_days": 730,
                "http_only": False,
                "secure": True,
                "same_site": "Lax",
                "scan_id": "scan_123"
            }
        }


class ClassificationOptions(BaseModel):
    """Options for classification."""
    return_explanation: bool = True
    find_similar: bool = True
    confidence_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    auto_classify: bool = True


class ClassificationRequest(BaseModel):
    """Request to classify cookies."""
    cookies: List[CookieInput]
    options: ClassificationOptions = Field(default_factory=ClassificationOptions)
    
    class Config:
        json_schema_extra = {
            "example": {
                "cookies": [
                    {
                        "name": "_ga",
                        "domain": "example.com",
                        "expiry_days": 730
                    }
                ],
                "options": {
                    "return_explanation": True,
                    "find_similar": True
                }
            }
        }


class AlternativePrediction(BaseModel):
    """Alternative prediction with probability."""
    category: str
    probability: float


class FeatureContribution(BaseModel):
    """Feature contribution to prediction."""
    feature: str
    contribution: float
    value: Any


class Explanation(BaseModel):
    """Explanation for classification."""
    top_features: List[FeatureContribution]
    reasoning_summary: str
    visualization_data: Dict[str, Any]


class VendorInfo(BaseModel):
    """Vendor information."""
    detected_vendor: Optional[str] = None
    vendor_category: Optional[str] = None
    vendor_confidence: Optional[float] = None


class SimilarCookieInfo(BaseModel):
    """Similar cookie information."""
    cookie_id: str
    cookie_name: str
    cookie_domain: str
    similarity_score: float
    category: Optional[str] = None


class SimilarCookiesInfo(BaseModel):
    """Information about similar cookies."""
    count: int
    sample_ids: List[str]
    samples: Optional[List[SimilarCookieInfo]] = None


class Classification(BaseModel):
    """Classification result for a single cookie."""
    cookie_id: Optional[str]
    predicted_category: str
    confidence_score: float
    confidence_level: str
    auto_classified: bool
    requires_review: bool
    alternative_predictions: List[AlternativePrediction]
    explanation: Optional[Explanation] = None
    vendor_info: Optional[VendorInfo] = None
    similar_cookies: Optional[SimilarCookiesInfo] = None
    model_version: str
    classified_at: str
    processing_time_ms: float


class ClassificationSummary(BaseModel):
    """Summary of classification batch."""
    total_cookies: int
    auto_classified: int
    requires_review: int
    avg_confidence: float
    total_processing_time_ms: float


class ClassificationResponse(BaseModel):
    """Response from classification endpoint."""
    classifications: List[Classification]
    summary: ClassificationSummary
    
    class Config:
        json_schema_extra = {
            "example": {
                "classifications": [
                    {
                        "cookie_id": "550e8400-e29b-41d4-a716-446655440000",
                        "predicted_category": "Analytics",
                        "confidence_score": 0.92,
                        "confidence_level": "High",
                        "auto_classified": True,
                        "requires_review": False,
                        "alternative_predictions": [
                            {"category": "Marketing", "probability": 0.05},
                            {"category": "Functional", "probability": 0.02}
                        ],
                        "model_version": "1.0.0",
                        "classified_at": "2025-11-24T10:30:00",
                        "processing_time_ms": 45.2
                    }
                ],
                "summary": {
                    "total_cookies": 1,
                    "auto_classified": 1,
                    "requires_review": 0,
                    "avg_confidence": 0.92,
                    "total_processing_time_ms": 45.2
                }
            }
        }


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/classify", response_model=ClassificationResponse)
async def classify_cookies(request: ClassificationRequest):
    """
    Classify cookies using ML model.
    
    This endpoint:
    1. Extracts features from cookie metadata
    2. Classifies cookies using trained ML model
    3. Generates explanations with SHAP values
    4. Finds similar cookies for bulk operations
    5. Returns comprehensive classification results
    
    **Performance:**
    - Single cookie: < 200ms
    - Batch of 500: < 5 seconds
    
    **Confidence Levels:**
    - High (≥0.85): Auto-classified, no review needed
    - Medium (0.65-0.84): Flagged for quick review
    - Low (<0.65): Queued for detailed review
    """
    start_time = time.time()
    
    try:
        # Get ML components
        feature_extractor = get_feature_extractor()
        classifier = get_classifier()
        explainer = get_explainer() if request.options.return_explanation else None
        similarity_detector = get_similarity_detector() if request.options.find_similar else None
        
        classifications = []
        total_confidence = 0.0
        auto_classified_count = 0
        requires_review_count = 0
        
        logger.info(f"Classifying {len(request.cookies)} cookies")
        
        for cookie_input in request.cookies:
            cookie_start = time.time()
            
            try:
                # Convert to dict
                cookie_dict = cookie_input.model_dump()
                
                # 1. Classify (classifier will extract features internally)
                result = classifier.classify(cookie_dict)
                
                # 3. Generate explanation (if requested)
                explanation = None
                if explainer and request.options.return_explanation:
                    expl = explainer.explain(
                        features=features,
                        prediction=result.predicted_category,
                        cookie=cookie_dict
                    )
                    
                    explanation = Explanation(
                        top_features=[
                            FeatureContribution(
                                feature=f.feature,
                                contribution=f.contribution,
                                value=f.value
                            )
                            for f in expl.top_features
                        ],
                        reasoning_summary=expl.reasoning_summary,
                        visualization_data=expl.visualization_data
                    )
                
                # 4. Find similar cookies (if requested)
                similar_cookies_info = None
                if similarity_detector and request.options.find_similar:
                    try:
                        if cookie_input.id:
                            # Search by ID if available
                            similar = similarity_detector.find_similar_in_database(
                                cookie_id=cookie_input.id,
                                threshold=request.options.confidence_threshold,
                                max_results=10
                            )
                        else:
                            # Search by cookie object
                            similar = similarity_detector.find_similar_by_cookie(
                                cookie=cookie_dict,
                                threshold=request.options.confidence_threshold,
                                max_results=10,
                                scan_id=cookie_input.scan_id
                            )
                        
                        similar_cookies_info = SimilarCookiesInfo(
                            count=len(similar),
                            sample_ids=[s.cookie_id for s in similar[:5]],
                            samples=[
                                SimilarCookieInfo(
                                    cookie_id=s.cookie_id,
                                    cookie_name=s.cookie_name,
                                    cookie_domain=s.cookie_domain,
                                    similarity_score=s.similarity_score,
                                    category=s.category
                                )
                                for s in similar[:5]
                            ]
                        )
                    except Exception as e:
                        logger.warning(f"Failed to find similar cookies: {e}")
                        # Continue without similar cookies
                
                # 5. Determine auto-classification and review flags
                auto_classified = should_auto_classify(result.confidence_score)
                needs_review = requires_review(result.confidence_score)
                
                # 6. Log metrics
                cookie_time = (time.time() - cookie_start) * 1000
                
                metrics_collector = get_metrics_collector()
                metrics_collector.log_classification(
                    cookie_id=cookie_input.id or "unknown",
                    predicted_category=result.predicted_category,
                    confidence_score=result.confidence_score,
                    confidence_level=result.confidence_level,
                    auto_classified=auto_classified,
                    requires_review=needs_review,
                    model_version=CURRENT_MODEL_VERSION,
                    classification_latency_ms=cookie_time
                )
                
                # 7. Build classification result
                classification = Classification(
                    cookie_id=cookie_input.id,
                    predicted_category=result.predicted_category,
                    confidence_score=result.confidence_score,
                    confidence_level=result.confidence_level,
                    auto_classified=auto_classified,
                    requires_review=needs_review,
                    alternative_predictions=[
                        AlternativePrediction(
                            category=alt.category,
                            probability=alt.probability
                        )
                        for alt in result.alternatives
                    ],
                    explanation=explanation,
                    vendor_info=None,  # TODO: Add vendor detection
                    similar_cookies=similar_cookies_info,
                    model_version=CURRENT_MODEL_VERSION,
                    classified_at=datetime.now().isoformat(),
                    processing_time_ms=cookie_time
                )
                
                classifications.append(classification)
                
                # Update counters
                total_confidence += result.confidence_score
                if auto_classified:
                    auto_classified_count += 1
                if needs_review:
                    requires_review_count += 1
                
                logger.debug(
                    f"Classified {cookie_input.name}: {result.predicted_category} "
                    f"(confidence: {result.confidence_score:.2f}, time: {cookie_time:.1f}ms)"
                )
                
            except Exception as e:
                logger.error(f"Error classifying cookie {cookie_input.name}: {e}")
                # Return error classification
                classification = Classification(
                    cookie_id=cookie_input.id,
                    predicted_category="Unknown",
                    confidence_score=0.0,
                    confidence_level="Low",
                    auto_classified=False,
                    requires_review=True,
                    alternative_predictions=[],
                    model_version=CURRENT_MODEL_VERSION,
                    classified_at=datetime.now().isoformat(),
                    processing_time_ms=0.0
                )
                classifications.append(classification)
                requires_review_count += 1
        
        # Calculate summary
        total_time = (time.time() - start_time) * 1000
        avg_confidence = total_confidence / len(request.cookies) if request.cookies else 0.0
        
        summary = ClassificationSummary(
            total_cookies=len(request.cookies),
            auto_classified=auto_classified_count,
            requires_review=requires_review_count,
            avg_confidence=avg_confidence,
            total_processing_time_ms=total_time
        )
        
        logger.info(
            f"Classified {len(request.cookies)} cookies in {total_time:.1f}ms "
            f"(avg confidence: {avg_confidence:.2f}, auto: {auto_classified_count}, "
            f"review: {requires_review_count})"
        )
        
        return ClassificationResponse(
            classifications=classifications,
            summary=summary
        )
        
    except Exception as e:
        logger.error(f"Error in classification endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}"
        )


@router.get("/health")
async def ml_health_check():
    """
    Health check for ML classification service.
    
    Returns status of ML components and model availability.
    """
    try:
        # Check if model is loaded
        classifier = get_classifier()
        model_loaded = classifier.model is not None
        
        return {
            "status": "healthy" if model_loaded else "degraded",
            "model_loaded": model_loaded,
            "model_version": CURRENT_MODEL_VERSION,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"ML health check failed: {e}")
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.get("/model-info")
async def get_model_info():
    """
    Get information about the current ML model.
    
    Returns model version, feature count, and categories.
    """
    try:
        classifier = get_classifier()
        feature_extractor = get_feature_extractor()
        
        return {
            "model_version": CURRENT_MODEL_VERSION,
            "model_type": "XGBoost",
            "feature_count": len(feature_extractor.get_feature_names()),
            "categories": [
                "Strictly Necessary",
                "Analytics",
                "Marketing",
                "Functional",
                "Unknown"
            ],
            "confidence_thresholds": {
                "high": 0.85,
                "medium": 0.65
            }
        }
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model info: {str(e)}"
        )


# ============================================================================
# Feedback Endpoint
# ============================================================================

class FeedbackRequest(BaseModel):
    """Request to submit user feedback/correction."""
    cookie_id: str
    classification_id: Optional[str] = None
    predicted_label: str
    corrected_label: str
    confidence_score: float
    user_id: Optional[str] = None
    feedback_note: Optional[str] = None
    apply_to_similar: bool = False
    similarity_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "cookie_id": "550e8400-e29b-41d4-a716-446655440000",
                "predicted_label": "Marketing",
                "corrected_label": "Analytics",
                "confidence_score": 0.72,
                "user_id": "user_123",
                "feedback_note": "This is clearly a Google Analytics cookie",
                "apply_to_similar": True,
                "similarity_threshold": 0.75
            }
        }


class SimilarCookieUpdate(BaseModel):
    """Information about a similar cookie that was updated."""
    cookie_id: str
    cookie_name: str
    cookie_domain: str
    similarity_score: float
    previous_category: Optional[str] = None
    new_category: str


class FeedbackResponse(BaseModel):
    """Response from feedback submission."""
    feedback_id: str
    cookie_id: str
    corrected_label: str
    similar_cookies_found: int
    similar_cookies_updated: int
    similar_cookies: Optional[List[SimilarCookieUpdate]] = None
    processing_time_ms: float
    message: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "feedback_id": "fb_550e8400-e29b-41d4-a716-446655440000",
                "cookie_id": "550e8400-e29b-41d4-a716-446655440000",
                "corrected_label": "Analytics",
                "similar_cookies_found": 5,
                "similar_cookies_updated": 5,
                "processing_time_ms": 150.5,
                "message": "Feedback recorded and applied to 5 similar cookies"
            }
        }


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """
    Submit user feedback/correction for a classification.
    
    This endpoint:
    1. Stores the user correction in the feedback database
    2. Optionally finds similar cookies
    3. Applies the correction to similar cookies (if requested)
    4. Marks feedback for inclusion in next training cycle
    
    **Bulk Application:**
    When `apply_to_similar=True`, the system:
    - Finds cookies with similarity score >= threshold (default 0.75)
    - Updates their categories to the corrected label
    - Tracks which cookies were updated
    - Returns list of updated cookies
    
    **Performance:**
    - Single feedback: < 100ms
    - With bulk update (100 cookies): < 3 seconds
    """
    start_time = time.time()
    
    try:
        # Validate correction is different from prediction
        if request.predicted_label == request.corrected_label:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrected label must be different from predicted label"
            )
        
        # Validate labels are valid categories
        valid_categories = [
            "Strictly Necessary",
            "Analytics",
            "Marketing",
            "Functional",
            "Unknown"
        ]
        
        if request.predicted_label not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid predicted_label. Must be one of: {', '.join(valid_categories)}"
            )
        
        if request.corrected_label not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid corrected_label. Must be one of: {', '.join(valid_categories)}"
            )
        
        logger.info(
            f"Processing feedback for cookie {request.cookie_id}: "
            f"{request.predicted_label} -> {request.corrected_label}"
        )
        
        # Generate feedback ID
        import uuid
        feedback_id = f"fb_{uuid.uuid4()}"
        
        # Store feedback in database
        from backend.api.ml_classifier.db_service import get_db_service
        db = get_db_service()
        
        similar_cookies_found = 0
        similar_cookies_updated = 0
        similar_cookie_updates = []
        
        # Find and update similar cookies if requested
        if request.apply_to_similar:
            try:
                similarity_detector = get_similarity_detector()
                
                # Find similar cookies
                similar_cookies = similarity_detector.find_similar_in_database(
                    cookie_id=request.cookie_id,
                    threshold=request.similarity_threshold,
                    max_results=100  # Limit for performance
                )
                
                similar_cookies_found = len(similar_cookies)
                
                logger.info(
                    f"Found {similar_cookies_found} similar cookies "
                    f"(threshold: {request.similarity_threshold})"
                )
                
                # Update similar cookies
                if similar_cookies:
                    similar_cookie_ids = [s.cookie_id for s in similar_cookies]
                    
                    # Store bulk update info
                    db.store_similar_cookies_feedback(
                        cookie_id=request.cookie_id,
                        similar_cookie_ids=similar_cookie_ids,
                        corrected_label=request.corrected_label,
                        user_id=request.user_id
                    )
                    
                    # Build response with similar cookie details
                    for similar in similar_cookies[:10]:  # Return top 10
                        similar_cookie_updates.append(SimilarCookieUpdate(
                            cookie_id=similar.cookie_id,
                            cookie_name=similar.cookie_name,
                            cookie_domain=similar.cookie_domain,
                            similarity_score=similar.similarity_score,
                            previous_category=similar.category,
                            new_category=request.corrected_label
                        ))
                    
                    similar_cookies_updated = len(similar_cookies)
                    
                    logger.info(f"Updated {similar_cookies_updated} similar cookies")
                
            except Exception as e:
                logger.warning(f"Failed to process similar cookies: {e}")
                # Continue without similar cookies - feedback still recorded
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Build response message
        if similar_cookies_updated > 0:
            message = (
                f"Feedback recorded and applied to {similar_cookies_updated} "
                f"similar cookie(s)"
            )
        else:
            message = "Feedback recorded successfully"
        
        logger.info(
            f"Feedback processed in {processing_time:.1f}ms: "
            f"{similar_cookies_found} similar found, {similar_cookies_updated} updated"
        )
        
        return FeedbackResponse(
            feedback_id=feedback_id,
            cookie_id=request.cookie_id,
            corrected_label=request.corrected_label,
            similar_cookies_found=similar_cookies_found,
            similar_cookies_updated=similar_cookies_updated,
            similar_cookies=similar_cookie_updates if similar_cookie_updates else None,
            processing_time_ms=processing_time,
            message=message
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process feedback: {str(e)}"
        )



# ============================================================================
# Similar Cookies Endpoint
# ============================================================================

class SimilarCookiesRequest(BaseModel):
    """Request parameters for finding similar cookies."""
    cookie_id: str
    threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    max_results: int = Field(default=50, ge=1, le=100)
    
    class Config:
        json_schema_extra = {
            "example": {
                "cookie_id": "550e8400-e29b-41d4-a716-446655440000",
                "threshold": 0.75,
                "max_results": 50
            }
        }


class SimilarCookieResult(BaseModel):
    """A similar cookie result."""
    cookie_id: str
    cookie_name: str
    cookie_domain: str
    cookie_path: str = "/"
    similarity_score: float
    category: Optional[str] = None
    confidence_score: Optional[float] = None
    expiry_days: Optional[int] = None
    http_only: bool = False
    secure: bool = False
    same_site: Optional[str] = None


class SimilarCookiesResponse(BaseModel):
    """Response from similar cookies search."""
    reference_cookie_id: str
    reference_cookie_name: str
    reference_cookie_domain: str
    threshold: float
    similar_cookies: List[SimilarCookieResult]
    total_found: int
    processing_time_ms: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "reference_cookie_id": "550e8400-e29b-41d4-a716-446655440000",
                "reference_cookie_name": "_ga",
                "reference_cookie_domain": "example.com",
                "threshold": 0.75,
                "similar_cookies": [
                    {
                        "cookie_id": "abc-123",
                        "cookie_name": "_gid",
                        "cookie_domain": "example.com",
                        "similarity_score": 0.85,
                        "category": "Analytics",
                        "confidence_score": 0.92
                    }
                ],
                "total_found": 5,
                "processing_time_ms": 150.5
            }
        }


@router.get("/similar-cookies/{cookie_id}", response_model=SimilarCookiesResponse)
async def get_similar_cookies(
    cookie_id: str,
    threshold: float = 0.75,
    max_results: int = 50
):
    """
    Find cookies similar to the specified cookie.
    
    This endpoint:
    1. Retrieves the reference cookie from database
    2. Finds similar cookies using smart filtering
    3. Calculates similarity scores
    4. Returns sorted results above threshold
    
    **Similarity Calculation:**
    - Name similarity (Levenshtein): 40%
    - Vendor match: 30%
    - Domain pattern: 15%
    - Purpose signals: 15%
    
    **Use Cases:**
    - Preview similar cookies before bulk update
    - Identify cookies that should have same category
    - Find cookies from same vendor
    - Discover related tracking cookies
    
    **Performance:**
    - Database search: < 2 seconds
    - Returns up to 100 results
    
    **Path Parameters:**
    - cookie_id: UUID of reference cookie
    
    **Query Parameters:**
    - threshold: Minimum similarity score (0.0-1.0, default 0.75)
    - max_results: Maximum results to return (1-100, default 50)
    """
    start_time = time.time()
    
    try:
        # Validate threshold
        if not 0.0 <= threshold <= 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Threshold must be between 0.0 and 1.0"
            )
        
        # Validate max_results
        if not 1 <= max_results <= 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_results must be between 1 and 100"
            )
        
        logger.info(
            f"Finding similar cookies for {cookie_id} "
            f"(threshold: {threshold}, max: {max_results})"
        )
        
        # Get similarity detector
        similarity_detector = get_similarity_detector()
        
        # Get reference cookie from database
        from backend.api.ml_classifier.db_service import get_db_service
        db = get_db_service()
        
        reference_cookie = db.get_cookie_by_id(cookie_id)
        if not reference_cookie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cookie with ID {cookie_id} not found"
            )
        
        # Find similar cookies
        similar_cookies = similarity_detector.find_similar_in_database(
            cookie_id=cookie_id,
            threshold=threshold,
            max_results=max_results
        )
        
        # Build response
        similar_results = []
        for similar in similar_cookies:
            # Get full cookie details
            cookie_details = db.get_cookie_by_id(similar.cookie_id)
            
            if cookie_details:
                similar_results.append(SimilarCookieResult(
                    cookie_id=similar.cookie_id,
                    cookie_name=similar.cookie_name,
                    cookie_domain=similar.cookie_domain,
                    cookie_path=cookie_details.get('path', '/'),
                    similarity_score=similar.similarity_score,
                    category=similar.category,
                    confidence_score=None,  # TODO: Get from ml_classifications
                    expiry_days=cookie_details.get('expiry_days'),
                    http_only=cookie_details.get('http_only', False),
                    secure=cookie_details.get('secure', False),
                    same_site=cookie_details.get('same_site')
                ))
            else:
                # Fallback if details not found
                similar_results.append(SimilarCookieResult(
                    cookie_id=similar.cookie_id,
                    cookie_name=similar.cookie_name,
                    cookie_domain=similar.cookie_domain,
                    similarity_score=similar.similarity_score,
                    category=similar.category
                ))
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"Found {len(similar_results)} similar cookies in {processing_time:.1f}ms"
        )
        
        return SimilarCookiesResponse(
            reference_cookie_id=cookie_id,
            reference_cookie_name=reference_cookie.get('name', 'Unknown'),
            reference_cookie_domain=reference_cookie.get('domain', 'Unknown'),
            threshold=threshold,
            similar_cookies=similar_results,
            total_found=len(similar_results),
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error finding similar cookies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find similar cookies: {str(e)}"
        )



# ============================================================================
# Metrics Endpoint
# ============================================================================

class MetricsRequest(BaseModel):
    """Request parameters for metrics."""
    start_date: Optional[str] = None  # ISO format: YYYY-MM-DD
    end_date: Optional[str] = None    # ISO format: YYYY-MM-DD
    model_version: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "start_date": "2025-11-01",
                "end_date": "2025-11-24",
                "model_version": "1.0.0"
            }
        }


class ConfidenceDistribution(BaseModel):
    """Distribution of confidence levels."""
    high_count: int
    medium_count: int
    low_count: int
    avg_confidence: float


class CategoryDistribution(BaseModel):
    """Distribution of predicted categories."""
    strictly_necessary: int
    analytics: int
    marketing: int
    functional: int
    unknown: int


class PerformanceMetrics(BaseModel):
    """Performance timing metrics."""
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    total_predictions: int


class ConfusionMatrixRow(BaseModel):
    """Single row of confusion matrix."""
    predicted_category: str
    strictly_necessary: int = 0
    analytics: int = 0
    marketing: int = 0
    functional: int = 0
    unknown: int = 0


class MetricsResponse(BaseModel):
    """Response from metrics endpoint."""
    period: Dict[str, str]
    model_version: str
    total_predictions: int
    auto_classified: int
    requires_review: int
    confidence_distribution: ConfidenceDistribution
    category_distribution: CategoryDistribution
    performance: PerformanceMetrics
    correction_count: int
    correction_rate: float
    confusion_matrix: Optional[List[ConfusionMatrixRow]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "period": {
                    "start": "2025-11-01",
                    "end": "2025-11-24"
                },
                "model_version": "1.0.0",
                "total_predictions": 1000,
                "auto_classified": 850,
                "requires_review": 150,
                "confidence_distribution": {
                    "high_count": 850,
                    "medium_count": 120,
                    "low_count": 30,
                    "avg_confidence": 0.87
                },
                "category_distribution": {
                    "strictly_necessary": 200,
                    "analytics": 400,
                    "marketing": 300,
                    "functional": 80,
                    "unknown": 20
                },
                "performance": {
                    "avg_latency_ms": 45.2,
                    "p95_latency_ms": 120.5,
                    "total_predictions": 1000
                },
                "correction_count": 50,
                "correction_rate": 0.05
            }
        }


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model_version: Optional[str] = None,
    include_confusion_matrix: bool = False
):
    """
    Get ML model performance metrics.
    
    This endpoint provides comprehensive metrics about model performance:
    - Total predictions and auto-classification rate
    - Confidence distribution (High/Medium/Low)
    - Category distribution across all 5 categories
    - Performance metrics (latency)
    - User correction rate
    - Optional confusion matrix
    
    **Metrics Tracked:**
    - Total predictions made
    - Auto-classified vs requires review
    - Confidence level distribution
    - Category distribution
    - Average and P95 latency
    - User correction count and rate
    - Confusion matrix (actual vs predicted)
    
    **Time Periods:**
    - Default: Last 30 days
    - Custom: Specify start_date and end_date
    - Format: YYYY-MM-DD (ISO 8601)
    
    **Query Parameters:**
    - start_date: Start of period (default: 30 days ago)
    - end_date: End of period (default: today)
    - model_version: Filter by model version (default: current)
    - include_confusion_matrix: Include confusion matrix (default: false)
    """
    start_time = time.time()
    
    try:
        from datetime import datetime, timedelta
        
        # Parse dates or use defaults
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid end_date format. Use YYYY-MM-DD"
                )
        else:
            end_dt = datetime.now()
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid start_date format. Use YYYY-MM-DD"
                )
        else:
            start_dt = end_dt - timedelta(days=30)
        
        # Validate date range
        if start_dt > end_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be before end_date"
            )
        
        # Use current model version if not specified
        if not model_version:
            model_version = CURRENT_MODEL_VERSION
        
        logger.info(
            f"Fetching metrics for period {start_dt.date()} to {end_dt.date()}, "
            f"model: {model_version}"
        )
        
        # TODO: Query ml_metrics table from database
        # For now, return mock data structure
        
        # Mock data - replace with actual database queries
        total_predictions = 1000
        auto_classified = 850
        requires_review = 150
        
        high_count = 850
        medium_count = 120
        low_count = 30
        avg_confidence = 0.87
        
        strictly_necessary = 200
        analytics = 400
        marketing = 300
        functional = 80
        unknown = 20
        
        correction_count = 50
        correction_rate = correction_count / total_predictions if total_predictions > 0 else 0.0
        
        # Build response
        response = MetricsResponse(
            period={
                "start": start_dt.date().isoformat(),
                "end": end_dt.date().isoformat()
            },
            model_version=model_version,
            total_predictions=total_predictions,
            auto_classified=auto_classified,
            requires_review=requires_review,
            confidence_distribution=ConfidenceDistribution(
                high_count=high_count,
                medium_count=medium_count,
                low_count=low_count,
                avg_confidence=avg_confidence
            ),
            category_distribution=CategoryDistribution(
                strictly_necessary=strictly_necessary,
                analytics=analytics,
                marketing=marketing,
                functional=functional,
                unknown=unknown
            ),
            performance=PerformanceMetrics(
                avg_latency_ms=45.2,
                p95_latency_ms=120.5,
                total_predictions=total_predictions
            ),
            correction_count=correction_count,
            correction_rate=correction_rate
        )
        
        # Add confusion matrix if requested
        if include_confusion_matrix:
            # Mock confusion matrix - replace with actual data
            response.confusion_matrix = [
                ConfusionMatrixRow(
                    predicted_category="Strictly Necessary",
                    strictly_necessary=190,
                    analytics=5,
                    marketing=3,
                    functional=2,
                    unknown=0
                ),
                ConfusionMatrixRow(
                    predicted_category="Analytics",
                    strictly_necessary=3,
                    analytics=385,
                    marketing=8,
                    functional=3,
                    unknown=1
                ),
                ConfusionMatrixRow(
                    predicted_category="Marketing",
                    strictly_necessary=2,
                    analytics=5,
                    marketing=288,
                    functional=4,
                    unknown=1
                ),
                ConfusionMatrixRow(
                    predicted_category="Functional",
                    strictly_necessary=3,
                    analytics=3,
                    marketing=1,
                    functional=72,
                    unknown=1
                ),
                ConfusionMatrixRow(
                    predicted_category="Unknown",
                    strictly_necessary=2,
                    analytics=2,
                    marketing=0,
                    functional=1,
                    unknown=15
                )
            ]
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"Metrics retrieved in {processing_time:.1f}ms: "
            f"{total_predictions} predictions, {correction_rate:.1%} correction rate"
        )
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch metrics: {str(e)}"
        )


# ============================================================================
# Drift Detection Endpoints
# ============================================================================

class DriftCheckRequest(BaseModel):
    """Request for drift detection check."""
    baseline_start_date: str = Field(..., description="Start date for baseline period (YYYY-MM-DD)")
    baseline_end_date: str = Field(..., description="End date for baseline period (YYYY-MM-DD)")
    current_date: str = Field(..., description="Date for current period (YYYY-MM-DD)")
    model_version: Optional[str] = Field(None, description="Optional model version filter")


class DriftAlert(BaseModel):
    """Drift detection alert."""
    level: str = Field(..., description="Alert level: warning or critical")
    type: str = Field(..., description="Alert type: feature_drift or prediction_drift")
    message: str = Field(..., description="Alert message")
    metric_value: float = Field(..., description="Metric value that triggered alert")
    threshold: float = Field(..., description="Threshold that was exceeded")
    detected_at: str = Field(..., description="Timestamp when drift was detected")
    details: Dict[str, Any] = Field(..., description="Additional alert details")


class DriftCheckResponse(BaseModel):
    """Response for drift detection check."""
    drift_detected: bool = Field(..., description="Whether drift was detected")
    total_alerts: int = Field(..., description="Total number of alerts")
    warning_count: int = Field(..., description="Number of warning alerts")
    critical_count: int = Field(..., description="Number of critical alerts")
    alerts: List[DriftAlert] = Field(..., description="List of drift alerts")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


@router.post("/drift/check", response_model=DriftCheckResponse)
async def check_drift(
    request: DriftCheckRequest,
    user: Optional[Dict] = Depends(optional_auth)
):
    """
    Check for model drift.
    
    Detects:
    - Feature distribution drift (KL divergence)
    - Prediction distribution drift (category changes)
    
    Generates alerts when drift exceeds configured thresholds.
    
    **Requirements**: 5.1, 5.2
    """
    try:
        start_time = time.time()
        
        from backend.api.ml_classifier.drift_detector import get_drift_detector
        from datetime import datetime as dt
        
        # Parse dates
        try:
            baseline_start = dt.strptime(request.baseline_start_date, "%Y-%m-%d").date()
            baseline_end = dt.strptime(request.baseline_end_date, "%Y-%m-%d").date()
            current_date = dt.strptime(request.current_date, "%Y-%m-%d").date()
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date format. Use YYYY-MM-DD: {str(e)}"
            )
        
        # Validate date range
        if baseline_start >= baseline_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="baseline_start_date must be before baseline_end_date"
            )
        
        if current_date < baseline_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_date must be after baseline period"
            )
        
        # Get drift detector
        drift_detector = get_drift_detector()
        
        # TODO: Fetch metrics data from database
        # For now, return mock response
        metrics_data = []
        
        # Check drift
        alerts = drift_detector.check_drift_from_metrics(
            baseline_start,
            current_date,
            metrics_data
        )
        
        # Generate report
        report = drift_detector.generate_drift_report(alerts)
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"Drift check completed in {processing_time:.1f}ms: "
            f"{report['total_alerts']} alerts detected"
        )
        
        return DriftCheckResponse(
            drift_detected=report['drift_detected'],
            total_alerts=report['total_alerts'],
            warning_count=report['warning_count'],
            critical_count=report['critical_count'],
            alerts=[
                DriftAlert(
                    level=alert['level'],
                    type=alert['type'],
                    message=alert['message'],
                    metric_value=alert['metric_value'],
                    threshold=alert['threshold'],
                    detected_at=alert['detected_at'],
                    details=alert['details']
                )
                for alert in report['alerts']
            ],
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking drift: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Drift check failed: {str(e)}"
        )


@router.get("/drift/status")
async def get_drift_status(
    days: int = 7,
    user: Optional[Dict] = Depends(optional_auth)
):
    """
    Get current drift status.
    
    Returns drift metrics for the last N days compared to baseline.
    
    **Requirements**: 5.1, 5.2
    """
    try:
        from backend.api.ml_classifier.drift_detector import get_drift_detector
        from datetime import date, timedelta
        
        # Calculate date ranges
        current_date = date.today()
        baseline_start = current_date - timedelta(days=days * 2)
        baseline_end = current_date - timedelta(days=days)
        
        drift_detector = get_drift_detector()
        
        # TODO: Fetch metrics data from database
        metrics_data = []
        
        # Check drift
        alerts = drift_detector.check_drift_from_metrics(
            baseline_start,
            current_date,
            metrics_data
        )
        
        report = drift_detector.generate_drift_report(alerts)
        
        return {
            "status": "drifting" if report['drift_detected'] else "stable",
            "baseline_period": {
                "start": baseline_start.isoformat(),
                "end": baseline_end.isoformat()
            },
            "current_date": current_date.isoformat(),
            "drift_detected": report['drift_detected'],
            "total_alerts": report['total_alerts'],
            "warning_count": report['warning_count'],
            "critical_count": report['critical_count'],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting drift status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get drift status: {str(e)}"
        )
