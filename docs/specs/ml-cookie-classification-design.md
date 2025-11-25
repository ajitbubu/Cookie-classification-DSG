# ML Cookie Classification System - Design Document

## Overview

The ML Cookie Classification System is an intelligent engine that automatically categorizes cookies into regulatory-compliant categories using machine learning. The system uses lightweight, interpretable models (XGBoost, Random Forest) to provide explainable classifications with confidence scores, enabling privacy engineers to efficiently manage cookie compliance.

### Key Design Principles

1. **Explainability First**: Every classification includes SHAP-based explanations showing why a decision was made
2. **Confidence-Driven Workflow**: High-confidence predictions are auto-applied; low-confidence ones are queued for review
3. **Continuous Learning**: User corrections feed back into the training pipeline to improve accuracy over time
4. **Performance**: Sub-200ms classification latency with horizontal scalability
5. **Auditability**: Complete audit trail of all automated decisions for regulatory compliance

### System Context

The classification system integrates with the existing cookie scanner infrastructure:
- **Input**: Cookie metadata from browser-based scans (name, domain, expiry, vendor, etc.)
- **Output**: Category assignment (Strictly Necessary, Analytics, Marketing, Functional, Unknown) with confidence score and explanation
- **Feedback Loop**: User corrections stored in database for model retraining

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  - Cookie Table with Classification Column                      │
│  - Confidence Badge Display                                      │
│  - Review Queue Interface                                        │
│  - Explanation Panel with SHAP Visualizations                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                            │
│  - POST /api/v1/ml/classify                                      │
│  - POST /api/v1/ml/feedback                                      │
│  - GET  /api/v1/ml/metrics                                       │
│  - GET  /api/v1/ml/similar-cookies                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ML Services Layer                              │
├──────────────────┬──────────────┬──────────────┬────────────────┤
│ Feature          │ Classification│ Explainability│ Similarity    │
│ Extractor        │ Engine        │ Engine        │ Detector      │
│                  │               │               │               │
│ • Parse cookie   │ • Load model  │ • SHAP values │ • Fuzzy match │
│ • Extract 25+    │ • Predict     │ • NL summary  │ • Score calc  │
│   features       │ • Confidence  │ • Visualize   │ • Threshold   │
│ • Vendor lookup  │ • Calibrate   │               │               │
└──────────────────┴──────────────┴──────────────┴────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data Layer (PostgreSQL)                        │
│  - cookies table (existing)                                      │
│  - ml_classifications table (predictions + confidence)           │
│  - ml_feedback table (user corrections)                          │
│  - ml_metrics table (performance tracking)                       │
│  - vendor_database table (known vendors)                         │
└─────────────────────────────────────────────────────────────────┘
```


### Component Responsibilities

#### 1. Feature Extractor
- Extracts 25+ features from raw cookie metadata
- Handles missing values with appropriate defaults
- Performs vendor lookup and pattern matching
- Outputs structured feature vector for model input

#### 2. Classification Engine
- Loads trained XGBoost/Random Forest model
- Performs inference on feature vectors
- Generates probability distribution over 5 categories
- Applies confidence calibration (Platt scaling)
- Returns top prediction + alternatives

#### 3. Explainability Engine
- Calculates SHAP values for each prediction
- Ranks features by contribution
- Generates natural language explanations
- Creates visualization data for UI

#### 4. Similarity Detector
- Compares cookies using fuzzy matching on name, vendor, domain
- Calculates similarity scores (0.0-1.0)
- Identifies cookies above threshold (0.75)
- Enables bulk classification operations

#### 5. Feedback Loop Manager
- Stores user corrections in database
- Triggers similarity detection for bulk apply
- Schedules model retraining when thresholds met
- Tracks correction rates for monitoring

---

## Components and Interfaces

### 1. Feature Extraction Module

**Location**: `backend/api/ml_classifier/feature_extractor.py`

**Interface**:
```python
class FeatureExtractor:
    def extract_features(self, cookie: Dict[str, Any]) -> np.ndarray:
        """
        Extract feature vector from cookie metadata.
        
        Args:
            cookie: Dictionary with keys: name, domain, path, expiry_days,
                   http_only, secure, same_site, value_sample, initiated_by
        
        Returns:
            numpy array of shape (25+,) with extracted features
        """
        pass
    
    def get_feature_names(self) -> List[str]:
        """Return ordered list of feature names."""
        pass
```


**Features to Extract** (minimum 25):

| Feature Name | Type | Description | Example |
|--------------|------|-------------|---------|
| `name_length` | int | Length of cookie name | 15 |
| `name_has_underscore` | bool | Name starts with underscore | True |
| `name_has_uuid` | bool | Name contains UUID pattern | False |
| `name_prefix` | categorical | First 3 chars of name | "_ga" |
| `domain_is_first_party` | bool | Domain matches site domain | True |
| `domain_is_subdomain` | bool | Is subdomain | False |
| `domain_tld` | categorical | Top-level domain | "com" |
| `expiry_days` | int | Days until expiry | 730 |
| `expiry_category` | categorical | session/short/medium/long | "long" |
| `http_only` | bool | HTTPOnly flag | False |
| `secure` | bool | Secure flag | True |
| `same_site` | categorical | SameSite value | "Lax" |
| `path_is_root` | bool | Path is "/" | True |
| `vendor_name` | categorical | Detected vendor | "Google LLC" |
| `vendor_category` | categorical | Vendor's typical category | "Analytics" |
| `vendor_confidence` | float | Vendor match confidence | 0.98 |
| `script_domain` | categorical | Domain of initiating script | "google-analytics.com" |
| `script_type` | categorical | analytics/advertising/other | "analytics" |
| `value_has_uuid` | bool | Value contains UUID | True |
| `value_length` | int | Length of cookie value | 45 |
| `name_pattern_ga` | bool | Matches Google Analytics pattern | True |
| `name_pattern_fb` | bool | Matches Facebook pattern | False |
| `name_pattern_ad` | bool | Contains "ad" substring | False |
| `is_third_party` | bool | Domain differs from site | False |
| `historical_category` | categorical | Previous classification | "Analytics" |
| `correction_count` | int | Times manually corrected | 0 |


### 2. Classification Engine Module

**Location**: `backend/api/ml_classifier/classifier.py`

**Interface**:
```python
class CookieClassifier:
    def __init__(self, model_path: str):
        """Load trained model from disk."""
        pass
    
    def classify(self, features: np.ndarray) -> ClassificationResult:
        """
        Classify cookie based on features.
        
        Args:
            features: Feature vector from FeatureExtractor
        
        Returns:
            ClassificationResult with:
                - predicted_category: str
                - confidence_score: float (0.0-1.0)
                - confidence_level: str ("High"/"Medium"/"Low")
                - probabilities: Dict[str, float] for all 5 categories
                - alternatives: List of top 3 alternative predictions
        """
        pass
    
    def classify_batch(self, features: List[np.ndarray]) -> List[ClassificationResult]:
        """Classify multiple cookies efficiently."""
        pass
```

**Model Selection**:
- **Primary**: XGBoost (best accuracy/performance balance)
- **Fallback**: Random Forest (simpler, more interpretable)
- **Configuration**: Stored in `models/config.json`

**Confidence Calibration**:
- Use Platt scaling or isotonic regression
- Calibrate on validation set during training
- Ensure predicted confidence matches empirical accuracy


### 3. Explainability Engine Module

**Location**: `backend/api/ml_classifier/explainer.py`

**Interface**:
```python
class ExplainabilityEngine:
    def __init__(self, model, feature_names: List[str]):
        """Initialize SHAP explainer with model."""
        pass
    
    def explain(self, features: np.ndarray, prediction: str) -> Explanation:
        """
        Generate explanation for a classification.
        
        Args:
            features: Feature vector used for prediction
            prediction: Predicted category
        
        Returns:
            Explanation with:
                - shap_values: Dict[str, float] (feature -> contribution)
                - top_features: List of top 5 contributing features
                - natural_language_summary: str
                - visualization_data: Dict for UI rendering
        """
        pass
```

**SHAP Integration**:
- Use TreeExplainer for tree-based models (fast)
- Calculate SHAP values for each prediction
- Cache explainer object for performance

**Natural Language Generation**:
```python
def generate_summary(shap_values: Dict, cookie: Dict, prediction: str) -> str:
    """
    Generate human-readable explanation.
    
    Template:
    "This cookie is classified as {category} with {confidence_level} confidence because:
    1. {top_reason_1}
    2. {top_reason_2}
    3. {top_reason_3}"
    """
    pass
```


### 4. Similarity Detection Module

**Location**: `backend/api/ml_classifier/similarity.py`

**Interface**:
```python
class SimilarityDetector:
    def calculate_similarity(self, cookie_a: Dict, cookie_b: Dict) -> float:
        """
        Calculate similarity score between two cookies.
        
        Weights:
        - Name similarity (Levenshtein): 40%
        - Vendor match: 30%
        - Domain pattern: 15%
        - Purpose signals: 15%
        
        Returns:
            float between 0.0 and 1.0
        """
        pass
    
    def find_similar(self, cookie: Dict, threshold: float = 0.75) -> List[Dict]:
        """
        Find all cookies similar to given cookie above threshold.
        
        Args:
            cookie: Reference cookie
            threshold: Minimum similarity score (default 0.75)
        
        Returns:
            List of similar cookies with similarity scores
        """
        pass
```

**Similarity Algorithm**:
```python
def calculate_similarity(cookie_a, cookie_b):
    score = 0.0
    
    # Name similarity (40%)
    name_sim = levenshtein_ratio(cookie_a.name, cookie_b.name)
    score += name_sim * 0.40
    
    # Vendor match (30%)
    if cookie_a.vendor == cookie_b.vendor and cookie_a.vendor != "Unknown":
        score += 0.30
    
    # Domain pattern (15%)
    if same_domain_pattern(cookie_a.domain, cookie_b.domain):
        score += 0.15
    
    # Purpose indicators (15%)
    if similar_purpose_signals(cookie_a, cookie_b):
        score += 0.15
    
    return score
```


---

## Data Models

### Database Schema

#### ml_classifications Table
```sql
CREATE TABLE ml_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cookie_id UUID NOT NULL REFERENCES cookies(id),
    scan_id UUID NOT NULL,
    
    -- Prediction
    predicted_category VARCHAR(50) NOT NULL,
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('High', 'Medium', 'Low')),
    
    -- Alternatives
    alternative_predictions JSONB, -- [{category: str, probability: float}, ...]
    
    -- Explanation
    shap_values JSONB, -- {feature_name: contribution_value, ...}
    top_features JSONB, -- [{feature: str, contribution: float, value: any}, ...]
    explanation_summary TEXT,
    
    -- Metadata
    model_version VARCHAR(20) NOT NULL,
    auto_classified BOOLEAN NOT NULL,
    requires_review BOOLEAN NOT NULL,
    classified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_cookie_id (cookie_id),
    INDEX idx_scan_id (scan_id),
    INDEX idx_confidence (confidence_score),
    INDEX idx_requires_review (requires_review),
    INDEX idx_classified_at (classified_at)
);
```

#### ml_feedback Table
```sql
CREATE TABLE ml_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cookie_id UUID NOT NULL REFERENCES cookies(id),
    classification_id UUID REFERENCES ml_classifications(id),
    
    -- Correction
    predicted_label VARCHAR(50) NOT NULL,
    corrected_label VARCHAR(50) NOT NULL,
    confidence_score FLOAT NOT NULL,
    
    -- User context
    user_id UUID,
    feedback_note TEXT,
    
    -- Bulk application
    applied_to_similar BOOLEAN DEFAULT FALSE,
    similar_cookies_count INTEGER DEFAULT 0,
    similar_cookie_ids JSONB, -- [uuid, uuid, ...]
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    used_in_training BOOLEAN DEFAULT FALSE,
    
    -- Indexes
    INDEX idx_cookie_id (cookie_id),
    INDEX idx_created_at (created_at),
    INDEX idx_used_in_training (used_in_training)
);
```


#### ml_metrics Table
```sql
CREATE TABLE ml_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time window
    metric_date DATE NOT NULL,
    metric_hour INTEGER, -- NULL for daily aggregates
    
    -- Model info
    model_version VARCHAR(20) NOT NULL,
    
    -- Performance metrics
    total_predictions INTEGER NOT NULL,
    auto_classified_count INTEGER NOT NULL,
    requires_review_count INTEGER NOT NULL,
    
    -- Confidence distribution
    high_confidence_count INTEGER NOT NULL,
    medium_confidence_count INTEGER NOT NULL,
    low_confidence_count INTEGER NOT NULL,
    avg_confidence_score FLOAT NOT NULL,
    
    -- Category distribution
    strictly_necessary_count INTEGER NOT NULL,
    analytics_count INTEGER NOT NULL,
    marketing_count INTEGER NOT NULL,
    functional_count INTEGER NOT NULL,
    unknown_count INTEGER NOT NULL,
    
    -- User feedback
    correction_count INTEGER NOT NULL,
    correction_rate FLOAT NOT NULL,
    
    -- Performance
    avg_classification_latency_ms FLOAT,
    p95_classification_latency_ms FLOAT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_metric_date (metric_date),
    INDEX idx_model_version (model_version),
    UNIQUE (metric_date, metric_hour, model_version)
);
```

#### vendor_database Table
```sql
CREATE TABLE vendor_database (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Vendor info
    vendor_name VARCHAR(255) NOT NULL UNIQUE,
    vendor_domain VARCHAR(255),
    typical_category VARCHAR(50) NOT NULL,
    
    -- Patterns
    cookie_name_patterns JSONB, -- ["_ga*", "_gid", "_gat*"]
    domain_patterns JSONB, -- ["*.google-analytics.com", "*.googletagmanager.com"]
    
    -- Metadata
    confidence_score FLOAT DEFAULT 1.0,
    source VARCHAR(100), -- "manual", "cookiepedia", "customer_data"
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    INDEX idx_vendor_name (vendor_name)
);
```


### API Data Models

#### ClassificationRequest
```python
@dataclass
class ClassificationRequest:
    cookies: List[CookieInput]
    options: ClassificationOptions = field(default_factory=ClassificationOptions)

@dataclass
class CookieInput:
    id: str
    name: str
    domain: str
    path: str = "/"
    expiry_days: Optional[int] = None
    http_only: bool = False
    secure: bool = False
    same_site: Optional[str] = None
    value_sample: Optional[str] = None
    initiated_by: Optional[str] = None
    scan_id: str

@dataclass
class ClassificationOptions:
    return_explanation: bool = True
    confidence_threshold: float = 0.75
    auto_classify: bool = True
```

#### ClassificationResponse
```python
@dataclass
class ClassificationResponse:
    classifications: List[Classification]
    summary: ClassificationSummary

@dataclass
class Classification:
    cookie_id: str
    predicted_category: str
    confidence_score: float
    confidence_level: str  # "High", "Medium", "Low"
    auto_classified: bool
    alternative_predictions: List[AlternativePrediction]
    explanation: Explanation
    vendor_info: VendorInfo
    similar_cookies: SimilarCookiesInfo
    model_version: str
    classified_at: datetime

@dataclass
class AlternativePrediction:
    category: str
    probability: float

@dataclass
class Explanation:
    top_features: List[FeatureContribution]
    reasoning_summary: str
    visualization_data: Dict[str, Any]

@dataclass
class FeatureContribution:
    feature: str
    contribution: float
    value: Any

@dataclass
class VendorInfo:
    detected_vendor: Optional[str]
    vendor_category: Optional[str]
    vendor_confidence: Optional[float]

@dataclass
class SimilarCookiesInfo:
    count: int
    sample_ids: List[str]

@dataclass
class ClassificationSummary:
    total_cookies: int
    auto_classified: int
    requires_review: int
    avg_confidence: float
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Feature Extraction Completeness
*For any* cookie input, the feature extraction process should produce a feature vector with at least 25 features.
**Validates: Requirements 1.1**

### Property 2: Feature Extraction Performance
*For any* cookie input, feature extraction should complete in less than 100 milliseconds.
**Validates: Requirements 1.2**

### Property 3: Missing Value Handling
*For any* cookie with missing metadata fields, the feature extractor should apply default values and produce a valid feature vector without throwing exceptions.
**Validates: Requirements 1.3**

### Property 4: Classification Performance
*For any* valid feature vector, the classification engine should return a category assignment within 200 milliseconds.
**Validates: Requirements 1.4**

### Property 5: Batch Classification Performance
*For any* batch of up to 500 cookies, the classification engine should complete all classifications within 5 seconds.
**Validates: Requirements 1.5**

### Property 6: Confidence Score Range
*For any* classification result, the confidence score should be a valid float between 0.0 and 1.0 inclusive.
**Validates: Requirements 2.1**

### Property 7: SHAP Values Completeness
*For any* classification result with explanation enabled, the result should include SHAP values for exactly 5 top contributing features.
**Validates: Requirements 2.3**

### Property 8: Explanation References Cookie Attributes
*For any* natural language explanation, the summary text should reference at least one actual cookie attribute (name, domain, vendor, or expiry).
**Validates: Requirements 2.4**

### Property 9: Explanation Generation Performance
*For any* classification, explanation generation should complete in less than 50 milliseconds.
**Validates: Requirements 2.5**

### Property 10: High Confidence Auto-Classification
*For any* classification with confidence score >= 0.85, the auto_classified flag should be True and requires_review should be False.
**Validates: Requirements 3.1**

### Property 11: Medium Confidence Review Flagging
*For any* classification with confidence score between 0.65 and 0.84 (inclusive), the requires_review flag should be True.
**Validates: Requirements 3.2**

### Property 12: Low Confidence Review Queueing
*For any* classification with confidence score < 0.65, the requires_review flag should be True and confidence_level should be "Low".
**Validates: Requirements 3.3**


### Property 13: Feedback Persistence
*For any* user correction submitted, a corresponding record should be created in the ml_feedback table with all required fields populated.
**Validates: Requirements 4.1**

### Property 14: Similar Cookie Detection
*For any* cookie, the similarity detector should identify other cookies and return similarity scores between 0.0 and 1.0.
**Validates: Requirements 4.2**

### Property 15: Similarity Threshold Filtering
*For any* similar cookie search with threshold 0.75, all returned cookies should have similarity scores >= 0.75.
**Validates: Requirements 4.3**

### Property 16: Bulk Update Performance
*For any* bulk correction operation on 100 cookies, the update should complete within 3 seconds.
**Validates: Requirements 4.4**

### Property 17: Drift Detection Alerting
*For any* feature distribution with KL divergence exceeding the configured threshold, the system should generate a warning alert.
**Validates: Requirements 5.1**

### Property 18: Prediction Drift Alerting
*For any* time window where category distribution changes by more than 20%, the system should generate a critical alert.
**Validates: Requirements 5.2**

### Property 19: Accuracy Drop Retraining Trigger
*For any* model with accuracy below 90%, the system should trigger an automatic retraining workflow.
**Validates: Requirements 5.3**

### Property 20: Correction Rate Alerting
*For any* time window where correction rate exceeds 25%, the system should generate a critical model quality alert.
**Validates: Requirements 5.4**

### Property 21: Confidence Drop Flagging
*For any* previously classified cookie with a confidence score decrease of 0.15 or more, the system should flag the cookie for re-review.
**Validates: Requirements 5.5**

### Property 22: Metrics Logging Completeness
*For any* completed classification, a metrics log entry should be created containing cookie_id, predicted_category, confidence_score, model_version, and timestamp.
**Validates: Requirements 6.1**

### Property 23: Performance Metrics Calculation
*For any* set of predictions with ground truth labels, the system should calculate precision, recall, and F1-score for each of the 5 categories.
**Validates: Requirements 6.2**

### Property 24: Confusion Matrix Completeness
*For any* confusion matrix generated, it should include counts for all 25 combinations of actual vs predicted categories (5x5 matrix).
**Validates: Requirements 6.4**

### Property 25: Metrics Export Format
*For any* metrics export request, the system should provide data in both valid CSV and valid JSON formats.
**Validates: Requirements 6.5**


### Property 26: Retraining Trigger on Data Accumulation
*For any* system state where 500 or more new labeled cookies have been accumulated, the system should trigger an automatic retraining workflow.
**Validates: Requirements 7.1**

### Property 27: Model Comparison Threshold
*For any* new model being compared to the current production model, the new model should only be promoted if it outperforms by at least 2% accuracy.
**Validates: Requirements 7.3**

### Property 28: Similarity Score Range
*For any* pair of cookies compared, the similarity score should be a valid float between 0.0 and 1.0 inclusive.
**Validates: Requirements 8.1**

### Property 29: Similarity Calculation Performance
*For any* pair of cookies, the similarity calculation should complete in less than 50 milliseconds.
**Validates: Requirements 8.2**

### Property 30: Similar Cookie Search Performance
*For any* cookie, searching for similar cookies across the entire database should return results within 2 seconds.
**Validates: Requirements 8.3**

### Property 31: Similar Cookie Auto-Detection
*For any* user classification action, the system should automatically detect and display similar cookies with similarity scores >= 0.75.
**Validates: Requirements 8.4**

### Property 32: Pattern Rule Generation
*For any* set of repeated user corrections on similar cookies, the system should automatically generate classification rules for future predictions.
**Validates: Requirements 8.5**

### Property 33: Known Vendor High Confidence
*For any* cookie from a known vendor (vendor_confidence >= 0.90), the vendor match should be detected with confidence >= 0.90.
**Validates: Requirements 9.1**

### Property 34: Vendor Match Confidence Boost
*For any* classification where a known vendor is identified, the overall confidence score should be increased by 0.05.
**Validates: Requirements 9.2**

### Property 35: Audit Log Completeness
*For any* classification decision, an audit log entry should be created containing cookie_id, predicted_category, confidence_score, model_version, and timestamp.
**Validates: Requirements 10.1**

### Property 36: Classification History Retrieval Performance
*For any* cookie, retrieving its complete classification history should complete within 1 second.
**Validates: Requirements 10.3**

### Property 37: Audit Report SHAP Inclusion
*For any* audit report generated, all automated decisions should include SHAP values in the explanation data.
**Validates: Requirements 10.4**


### Property 38: Explanation Visual Data Structure
*For any* classification with explanation enabled, the visualization data should contain exactly 5 features with their percentage contributions.
**Validates: Requirements 11.1**

### Property 39: Confidence Level Categorization
*For any* confidence score, the confidence_level should be "High" if score >= 0.85, "Medium" if 0.65 <= score < 0.85, and "Low" if score < 0.65.
**Validates: Requirements 11.3**

### Property 40: Confidence Score Percentage Format
*For any* confidence score displayed, it should be formatted as a percentage between 0% and 100%.
**Validates: Requirements 11.4**

### Property 41: Confusion Matrix Structure
*For any* confusion matrix generated, it should be a 5x5 matrix with rows representing predicted categories and columns representing actual categories.
**Validates: Requirements 11.5**

### Property 42: Feature Importance Calculation
*For any* trained model, global feature importance scores should be calculated for all features used in training.
**Validates: Requirements 12.1**

### Property 43: Feature Importance Ranking
*For any* feature importance display, features should be ranked in descending order by their contribution to model predictions.
**Validates: Requirements 12.2**

### Property 44: Top Features Identification
*For any* feature importance analysis, the system should identify exactly the top 10 most important features with their percentage contributions.
**Validates: Requirements 12.3**

### Property 45: Model Version Comparison Data
*For any* model version comparison, the data structure should contain feature importance values for both the current and previous model versions.
**Validates: Requirements 12.4**

### Property 46: Feature Importance Export Format
*For any* feature importance export, the data should be in a structured format containing feature names and their corresponding importance scores.
**Validates: Requirements 12.5**

### Property 47: Model Loading Performance
*For any* new service instance, model loading should complete in less than 2 seconds.
**Validates: Requirements 14.5**

### Property 48: Five Category Probabilities
*For any* classification result, the system should return probability scores for all 5 categories (Strictly Necessary, Analytics, Marketing, Functional, Unknown).
**Validates: Requirements 15.1**


### Property 49: Top Three Alternatives
*For any* classification result, the system should include exactly the top 3 alternative predictions with their probability scores.
**Validates: Requirements 15.2**

### Property 50: Alternative Predictions Sorting
*For any* list of alternative predictions, they should be sorted by probability in descending order.
**Validates: Requirements 15.3**

### Property 51: Alternative Prediction Threshold
*For any* alternative predictions displayed in the UI, only alternatives with probability scores above 0.10 should be highlighted.
**Validates: Requirements 15.4**

### Property 52: Alternative Selection Feedback
*For any* user selection of an alternative prediction, the system should create a feedback record in the ml_feedback table treating it as a correction.
**Validates: Requirements 15.5**

---

## Error Handling

### Error Categories

#### 1. Input Validation Errors
- **Missing Required Fields**: Return 400 Bad Request with clear error message
- **Invalid Data Types**: Return 400 Bad Request specifying expected type
- **Out of Range Values**: Return 400 Bad Request with valid range

#### 2. Model Errors
- **Model Loading Failure**: Fall back to rule-based classification, log error, alert ops team
- **Prediction Failure**: Return "Unknown" category with low confidence, log error
- **SHAP Calculation Failure**: Return classification without explanation, log warning

#### 3. Database Errors
- **Connection Failure**: Retry 3 times with exponential backoff, then return 503
- **Query Timeout**: Return 504 Gateway Timeout, log slow query
- **Constraint Violation**: Return 409 Conflict with details

#### 4. Performance Errors
- **Timeout Exceeded**: Return partial results if available, log performance issue
- **Memory Limit**: Reduce batch size and retry, log resource issue

### Graceful Degradation Strategy

```python
def classify_with_fallback(cookie: Dict) -> Classification:
    try:
        # Try ML classification
        return ml_classifier.classify(cookie)
    except ModelLoadError:
        # Fall back to rule-based
        logger.error("ML model unavailable, using rule-based fallback")
        return rule_based_classifier.classify(cookie)
    except Exception as e:
        # Last resort: return Unknown
        logger.error(f"Classification failed: {e}")
        return Classification(
            predicted_category="Unknown",
            confidence_score=0.0,
            confidence_level="Low",
            auto_classified=False,
            requires_review=True
        )
```


---

## Testing Strategy

### Unit Testing

Unit tests will verify specific components and edge cases:

**Feature Extraction Tests**:
- Test extraction with complete cookie data
- Test handling of missing fields (name, domain, expiry)
- Test special characters and encoding issues
- Test vendor lookup with known/unknown vendors
- Test pattern matching for common cookie names

**Classification Tests**:
- Test prediction with valid feature vectors
- Test confidence score range validation
- Test confidence level categorization
- Test alternative predictions generation
- Test batch classification

**Similarity Tests**:
- Test similarity calculation with identical cookies (score = 1.0)
- Test similarity with completely different cookies (score = 0.0)
- Test Levenshtein distance calculation
- Test vendor matching logic
- Test threshold filtering

**Explanation Tests**:
- Test SHAP value calculation
- Test natural language summary generation
- Test feature contribution ranking
- Test visualization data structure

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **Hypothesis** (Python PBT library):

**Configuration**: Each property test will run a minimum of 100 iterations with randomly generated inputs.

**Test Tagging**: Each property-based test will include a comment explicitly referencing the correctness property from the design document using this format:
```python
# Feature: ml-cookie-classification, Property 1: Feature Extraction Completeness
```

**Property Test Examples**:

```python
from hypothesis import given, strategies as st
import hypothesis.strategies as st

# Feature: ml-cookie-classification, Property 1: Feature Extraction Completeness
@given(cookie=cookie_strategy())
@settings(max_examples=100)
def test_feature_extraction_completeness(cookie):
    """For any cookie input, feature extraction produces >= 25 features."""
    extractor = FeatureExtractor()
    features = extractor.extract_features(cookie)
    assert len(features) >= 25

# Feature: ml-cookie-classification, Property 6: Confidence Score Range
@given(features=feature_vector_strategy())
@settings(max_examples=100)
def test_confidence_score_range(features):
    """For any classification, confidence score is between 0.0 and 1.0."""
    classifier = CookieClassifier()
    result = classifier.classify(features)
    assert 0.0 <= result.confidence_score <= 1.0

# Feature: ml-cookie-classification, Property 28: Similarity Score Range
@given(cookie_a=cookie_strategy(), cookie_b=cookie_strategy())
@settings(max_examples=100)
def test_similarity_score_range(cookie_a, cookie_b):
    """For any pair of cookies, similarity score is between 0.0 and 1.0."""
    detector = SimilarityDetector()
    score = detector.calculate_similarity(cookie_a, cookie_b)
    assert 0.0 <= score <= 1.0
```


**Hypothesis Strategies**:

```python
import hypothesis.strategies as st
from hypothesis import assume

@st.composite
def cookie_strategy(draw):
    """Generate random cookie data for testing."""
    return {
        "id": draw(st.uuids()).hex,
        "name": draw(st.text(min_size=1, max_size=100)),
        "domain": draw(st.from_regex(r"[a-z0-9\-]+\.[a-z]{2,}", fullmatch=True)),
        "path": draw(st.sampled_from(["/", "/path", "/path/to/resource"])),
        "expiry_days": draw(st.one_of(st.none(), st.integers(min_value=0, max_value=3650))),
        "http_only": draw(st.booleans()),
        "secure": draw(st.booleans()),
        "same_site": draw(st.sampled_from([None, "Strict", "Lax", "None"])),
        "value_sample": draw(st.one_of(st.none(), st.text(max_size=200))),
        "initiated_by": draw(st.one_of(st.none(), st.from_regex(r"https?://[a-z0-9\-\.]+", fullmatch=True))),
        "scan_id": draw(st.uuids()).hex
    }

@st.composite
def feature_vector_strategy(draw):
    """Generate random feature vectors."""
    return np.array([draw(st.floats(min_value=-10, max_value=10)) for _ in range(25)])

@st.composite
def classification_result_strategy(draw):
    """Generate random classification results."""
    categories = ["Strictly Necessary", "Analytics", "Marketing", "Functional", "Unknown"]
    return ClassificationResult(
        predicted_category=draw(st.sampled_from(categories)),
        confidence_score=draw(st.floats(min_value=0.0, max_value=1.0)),
        confidence_level=draw(st.sampled_from(["High", "Medium", "Low"])),
        probabilities={cat: draw(st.floats(min_value=0.0, max_value=1.0)) for cat in categories},
        alternatives=[]
    )
```

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Full Classification Pipeline**:
   - Submit cookie → Extract features → Classify → Generate explanation → Store results
   - Verify database records created correctly
   - Verify API response matches expected schema

2. **Feedback Loop**:
   - Submit correction → Store feedback → Detect similar cookies → Apply bulk update
   - Verify all similar cookies updated
   - Verify feedback marked for training

3. **Retraining Workflow**:
   - Accumulate 500 corrections → Trigger retraining → Validate new model → Deploy
   - Verify model version incremented
   - Verify metrics show improvement

4. **Monitoring and Alerting**:
   - Simulate accuracy drop → Verify alert generated
   - Simulate drift → Verify warning logged
   - Verify metrics dashboard updates

### Performance Testing

Performance tests will verify latency and throughput requirements:

- **Single Classification**: < 200ms (p95)
- **Batch Classification**: 500 cookies in < 5 seconds
- **Feature Extraction**: < 100ms per cookie
- **Explanation Generation**: < 50ms per cookie
- **Similarity Search**: < 2 seconds for full database
- **Model Loading**: < 2 seconds on cold start


---

## Model Training Pipeline

### Training Data Requirements

**Minimum Dataset Size**: 5,000 labeled cookies
- Strictly Necessary: 1,000 samples (20%)
- Analytics: 1,500 samples (30%)
- Marketing: 1,500 samples (30%)
- Functional: 1,000 samples (20%)

**Data Sources**:
1. Manual labeling by privacy engineers (500 most common cookies)
2. Import from CookiePedia/CookieDatabase APIs
3. Anonymized customer data (with consent)
4. User corrections from feedback loop

### Training Process

```python
# 1. Data Preparation
def prepare_training_data():
    # Load labeled cookies from database
    cookies = load_labeled_cookies()
    
    # Extract features
    X = [feature_extractor.extract_features(c) for c in cookies]
    y = [c.label for c in cookies]
    
    # Split data
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, stratify=y_temp)
    
    # Handle class imbalance
    smote = SMOTE(random_state=42)
    X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)
    
    return X_train_balanced, X_val, X_test, y_train_balanced, y_val, y_test

# 2. Model Training
def train_model():
    X_train, X_val, X_test, y_train, y_val, y_test = prepare_training_data()
    
    # Train XGBoost model
    model = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=5,
        max_depth=8,
        learning_rate=0.05,
        n_estimators=300,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        early_stopping_rounds=20,
        verbose=True
    )
    
    return model

# 3. Model Evaluation
def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    
    # Calculate metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted')
    recall = recall_score(y_test, y_pred, average='weighted')
    f1 = f1_score(y_test, y_pred, average='weighted')
    
    # Per-category metrics
    report = classification_report(y_test, y_pred, output_dict=True)
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'per_category': report,
        'confusion_matrix': cm
    }

# 4. Confidence Calibration
def calibrate_model(model, X_val, y_val):
    # Get uncalibrated probabilities
    y_proba = model.predict_proba(X_val)
    
    # Apply Platt scaling
    calibrator = CalibratedClassifierCV(model, method='sigmoid', cv='prefit')
    calibrator.fit(X_val, y_val)
    
    return calibrator

# 5. Model Serialization
def save_model(model, version: str):
    model_dir = f"models/v{version}"
    os.makedirs(model_dir, exist_ok=True)
    
    # Save model
    joblib.dump(model, f"{model_dir}/model.pkl")
    
    # Save feature names
    with open(f"{model_dir}/features.json", 'w') as f:
        json.dump(feature_extractor.get_feature_names(), f)
    
    # Save metadata
    metadata = {
        'version': version,
        'trained_at': datetime.now().isoformat(),
        'training_samples': len(X_train),
        'model_type': 'XGBoost',
        'accuracy': metrics['accuracy'],
        'f1_score': metrics['f1']
    }
    with open(f"{model_dir}/metadata.json", 'w') as f:
        json.dump(metadata, f)
```


### Retraining Triggers

The system will automatically retrain when:

1. **Data Accumulation**: 500+ new labeled cookies collected
2. **Correction Rate**: >10% of predictions corrected by users
3. **Accuracy Drop**: Model accuracy falls below 92%
4. **Scheduled**: Weekly if new data available
5. **Manual**: Admin triggers retraining via API

### Model Deployment Process

```python
def deploy_new_model(new_model_version: str):
    # 1. Load and validate new model
    new_model = load_model(new_model_version)
    current_model = load_model(get_current_version())
    
    # 2. Compare performance on test set
    new_metrics = evaluate_model(new_model, X_test, y_test)
    current_metrics = evaluate_model(current_model, X_test, y_test)
    
    # 3. Require 2% improvement
    if new_metrics['accuracy'] < current_metrics['accuracy'] + 0.02:
        logger.warning(f"New model does not meet 2% improvement threshold")
        return False
    
    # 4. A/B test on 10% of traffic for 48 hours
    ab_test_result = run_ab_test(
        control_model=current_model,
        treatment_model=new_model,
        traffic_split=0.1,
        duration_hours=48
    )
    
    # 5. Analyze A/B test results
    if ab_test_result['treatment_accuracy'] > ab_test_result['control_accuracy']:
        # Promote to production
        set_production_model(new_model_version)
        logger.info(f"Deployed model {new_model_version} to production")
        return True
    else:
        logger.warning(f"A/B test failed for model {new_model_version}")
        return False
```

---

## Monitoring and Observability

### Key Metrics to Track

#### Model Performance Metrics
- **Accuracy**: Overall prediction accuracy
- **Precision/Recall/F1**: Per-category performance
- **Confusion Matrix**: Misclassification patterns
- **Confidence Distribution**: % High/Medium/Low confidence predictions

#### Business Metrics
- **Auto-Classification Rate**: % of cookies auto-classified (target: 85%+)
- **Unknown Rate**: % of cookies classified as Unknown (target: <10%)
- **Correction Rate**: % of predictions manually overridden (target: <10%)
- **Time Saved**: Hours saved vs manual classification

#### System Metrics
- **Classification Latency**: p50, p95, p99 response times
- **Throughput**: Classifications per second
- **Error Rate**: % of failed classifications
- **Model Loading Time**: Time to load model on cold start

#### Drift Metrics
- **Feature Drift**: KL divergence of feature distributions
- **Prediction Drift**: Change in category distribution over time
- **Confidence Drift**: Change in average confidence scores

### Alerting Rules

```python
# Critical Alerts (PagerDuty)
- Accuracy < 90%
- Error rate > 5%
- Correction rate > 25%
- API latency p95 > 500ms

# Warning Alerts (Slack)
- Accuracy < 93%
- Unknown rate > 15%
- Confidence scores trending down
- Feature drift detected

# Info Alerts (Email)
- New model deployed
- Retraining completed
- 500+ new corrections available
```

### Logging Strategy

```python
import structlog

logger = structlog.get_logger()

# Log every classification
logger.info(
    "classification_completed",
    cookie_id=cookie_id,
    predicted_category=result.predicted_category,
    confidence_score=result.confidence_score,
    model_version=model_version,
    latency_ms=latency,
    auto_classified=result.auto_classified
)

# Log user corrections
logger.info(
    "user_correction",
    cookie_id=cookie_id,
    predicted_label=predicted,
    corrected_label=corrected,
    user_id=user_id,
    similar_cookies_count=similar_count
)

# Log model events
logger.info(
    "model_deployed",
    model_version=version,
    accuracy=metrics['accuracy'],
    f1_score=metrics['f1'],
    training_samples=sample_count
)
```


---

## Security Considerations

### Data Protection

1. **Model Artifacts**: Encrypt model files at rest using AES-256
2. **Training Data**: Store in encrypted database, restrict access via IAM
3. **API Authentication**: Require JWT tokens for all ML endpoints
4. **Rate Limiting**: 100 requests/minute per user to prevent abuse
5. **PII Handling**: Never include actual cookie values in training data, only metadata

### Access Control

```python
# API endpoint protection
@app.post("/api/v1/ml/classify")
@require_auth
@rate_limit(requests=100, window=60)
async def classify_cookies(request: ClassificationRequest, user: User):
    # Verify user has permission to classify cookies
    if not user.has_permission("ml.classify"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Process classification
    return await classification_service.classify(request)
```

### Audit Trail

All ML operations are logged for compliance:
- Classification decisions (cookie_id, prediction, confidence, timestamp)
- User corrections (who, what, when)
- Model deployments (version, metrics, deployer)
- Data access (who accessed training data, when)

---

## Deployment Architecture

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                      (NGINX / AWS ALB)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  ML API     │  │  ML API     │  │  ML API     │
│  Instance 1 │  │  Instance 2 │  │  Instance 3 │
│             │  │             │  │             │
│ • FastAPI   │  │ • FastAPI   │  │ • FastAPI   │
│ • Model     │  │ • Model     │  │ • Model     │
│ • Redis     │  │ • Redis     │  │ • Redis     │
└─────────────┘  └─────────────┘  └─────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
         ┌───────────────────────────────┐
         │      PostgreSQL Database       │
         │  • ml_classifications          │
         │  • ml_feedback                 │
         │  • ml_metrics                  │
         │  • vendor_database             │
         └───────────────────────────────┘
```

### Scaling Strategy

**Horizontal Scaling**:
- Run multiple ML API instances behind load balancer
- Each instance loads model into memory on startup
- Stateless design enables easy scaling

**Caching**:
- Redis cache for frequently classified cookies
- Cache key: hash(cookie_name + domain + vendor)
- TTL: 1 hour
- Invalidate on model update

**Database Optimization**:
- Index on cookie_id, scan_id, confidence_score
- Partition ml_metrics table by date
- Archive old classifications after 12 months

### Docker Configuration

```dockerfile
# Dockerfile for ML API
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/api/ml_classifier /app/ml_classifier
COPY models /app/models

# Expose port
EXPOSE 8000

# Run FastAPI with Uvicorn
CMD ["uvicorn", "ml_classifier.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```


---

## Technology Stack

### ML Framework
- **Training**: scikit-learn 1.3+, XGBoost 2.0+
- **Explainability**: SHAP 0.42+
- **Feature Engineering**: pandas 2.0+, NumPy 1.24+
- **Model Serving**: FastAPI 0.104+, Uvicorn 0.24+

### Data Storage
- **Primary Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Model Storage**: Local filesystem (or S3 for production)

### Monitoring
- **Metrics**: Prometheus + Grafana
- **Logging**: structlog + ELK stack
- **Alerting**: PagerDuty / Slack webhooks

### Development Tools
- **Testing**: pytest 7+, Hypothesis 6+ (for property-based testing)
- **Linting**: ruff, mypy
- **CI/CD**: GitHub Actions
- **Containerization**: Docker, docker-compose

---

## Migration Strategy

### Phase 1: Parallel Run (Week 1-2)
- Deploy ML classification alongside existing manual process
- Run ML on all cookies but don't auto-apply
- Collect predictions and confidence scores
- Compare ML predictions to manual labels
- Measure accuracy and identify issues

### Phase 2: Soft Launch (Week 3-4)
- Enable auto-classification for High confidence (≥0.85) only
- Queue Medium/Low confidence for manual review
- Monitor correction rates and user feedback
- Adjust confidence thresholds if needed

### Phase 3: Full Rollout (Week 5+)
- Enable auto-classification for all confidence levels
- Reduce manual review queue to Low confidence only
- Continuous monitoring and model retraining
- Collect user feedback for improvements

### Rollback Plan

If issues arise:
1. Disable auto-classification via feature flag
2. Revert to manual classification workflow
3. Investigate and fix issues
4. Re-deploy with fixes

---

## Future Enhancements

### V2 Features (Q2 2026)

1. **Multi-Label Classification**
   - Support cookies with multiple purposes (e.g., Analytics + Marketing)
   - Display probability distribution for all applicable categories

2. **Active Learning**
   - Intelligently select which low-confidence cookies to show users first
   - Maximize information gain per labeling effort

3. **Transfer Learning**
   - Pre-train on public cookie datasets
   - Fine-tune per customer with their specific cookies

4. **Vendor Policy Monitoring**
   - Automatically parse vendor privacy policies
   - Detect discrepancies between declared and actual usage

5. **Cookie Relationship Graph**
   - Detect cookies that work together (e.g., _ga, _gid, _gat)
   - Bulk classify related cookies

---

## Open Questions

1. **Q**: Should we support multi-label classification in V1?
   **A**: No, start with single-label (primary purpose). Add multi-label in V2 based on user feedback.

2. **Q**: What confidence threshold should trigger auto-classification?
   **A**: Start with 0.85. Monitor correction rates and adjust if needed (0.80-0.90 range).

3. **Q**: How should we handle cookies with conflicting vendor information?
   **A**: Use the vendor with highest confidence score. If tie, flag for manual review.

4. **Q**: Should we expose raw SHAP values to end users?
   **A**: No, show visual bar charts and natural language summaries. Raw values available via API for power users.

5. **Q**: How often should we retrain the model?
   **A**: Weekly if 500+ new corrections available, otherwise monthly. Also trigger on accuracy drop.

---

## Appendix

### Example API Requests/Responses

See PRD Section 12 for detailed API specifications.

### Model Performance Benchmarks

Target metrics for production model:
- Overall Accuracy: ≥95%
- Strictly Necessary F1: ≥0.95
- Analytics F1: ≥0.92
- Marketing F1: ≥0.92
- Functional F1: ≥0.88
- Auto-Classification Rate: ≥85%
- Unknown Rate: <10%
- User Correction Rate: <10%

### References

- SHAP Documentation: https://shap.readthedocs.io/
- XGBoost Documentation: https://xgboost.readthedocs.io/
- Hypothesis Documentation: https://hypothesis.readthedocs.io/
- GDPR Article 22: Automated Decision-Making
- CookiePedia API: https://cookiepedia.co.uk/

---

**Document Version**: 1.0  
**Last Updated**: November 24, 2025  
**Next Review**: December 15, 2025
