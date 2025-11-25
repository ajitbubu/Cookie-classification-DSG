# Implementation Plan

- [ ] 1. Set up ML infrastructure and project structure
  - Create directory structure for ML classifier module
  - Set up Python virtual environment with required dependencies
  - Configure model storage directory
  - Add ML-specific dependencies to requirements.txt (xgboost, shap, hypothesis, scikit-learn)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Create database schema for ML classification
  - Create ml_classifications table with indexes
  - Create ml_feedback table for user corrections
  - Create ml_metrics table for performance tracking
  - Create vendor_database table for known vendors
  - Write database migration scripts
  - _Requirements: 4.1, 6.1, 10.1_

- [ ] 3. Implement feature extraction module
- [ ] 3.1 Create FeatureExtractor class with extract_features method
  - Implement extraction of 25+ features from cookie metadata
  - Handle missing values with appropriate defaults
  - Implement vendor lookup and pattern matching
  - Add feature name mapping
  - _Requirements: 1.1, 1.3_

- [ ]* 3.2 Write property test for feature extraction completeness
  - **Property 1: Feature Extraction Completeness**
  - **Validates: Requirements 1.1**

- [ ]* 3.3 Write property test for feature extraction performance
  - **Property 2: Feature Extraction Performance**
  - **Validates: Requirements 1.2**

- [ ]* 3.4 Write property test for missing value handling
  - **Property 3: Missing Value Handling**
  - **Validates: Requirements 1.3**

- [ ] 4. Build initial training dataset
  - Create script to export existing cookie data
  - Manually label 500 most common cookies
  - Import known cookies from vendor database
  - Create data validation and quality checks
  - Split data into train/validation/test sets
  - _Requirements: 7.1_

- [ ] 5. Implement model training pipeline
- [ ] 5.1 Create training script with data preparation
  - Load labeled cookies from database
  - Extract features for all training samples
  - Handle class imbalance with SMOTE
  - Implement train/validation/test split
  - _Requirements: 7.1, 7.2_

- [ ] 5.2 Train baseline Random Forest model
  - Configure Random Forest classifier
  - Train on prepared dataset
  - Evaluate on test set
  - Save model artifacts
  - _Requirements: 7.2, 7.5_

- [ ] 5.3 Train production XGBoost model
  - Configure XGBoost classifier with hyperparameters
  - Implement early stopping
  - Apply confidence calibration (Platt scaling)
  - Evaluate and compare to baseline
  - _Requirements: 7.2, 7.3, 7.5_

- [ ]* 5.4 Write property test for model comparison threshold
  - **Property 27: Model Comparison Threshold**
  - **Validates: Requirements 7.3**

- [ ] 5.5 Implement model serialization and versioning
  - Save model with semantic versioning
  - Store feature names and metadata
  - Create model registry structure
  - _Requirements: 7.2_


- [ ] 6. Implement classification engine
- [ ] 6.1 Create CookieClassifier class with model loading
  - Implement model loading from disk
  - Add model caching for performance
  - Handle model loading failures gracefully
  - _Requirements: 1.4, 13.5_

- [ ] 6.2 Implement classify method for single predictions
  - Load model and predict category
  - Generate confidence scores
  - Categorize confidence level (High/Medium/Low)
  - Return all 5 category probabilities
  - Generate top 3 alternative predictions
  - _Requirements: 1.4, 2.1, 3.1, 3.2, 3.3, 15.1, 15.2, 15.3_

- [ ]* 6.3 Write property test for classification performance
  - **Property 4: Classification Performance**
  - **Validates: Requirements 1.4**

- [ ]* 6.4 Write property test for confidence score range
  - **Property 6: Confidence Score Range**
  - **Validates: Requirements 2.1**

- [ ]* 6.5 Write property test for confidence level categorization
  - **Property 39: Confidence Level Categorization**
  - **Validates: Requirements 11.3**

- [ ]* 6.6 Write property test for five category probabilities
  - **Property 48: Five Category Probabilities**
  - **Validates: Requirements 15.1**

- [ ]* 6.7 Write property test for alternative predictions sorting
  - **Property 50: Alternative Predictions Sorting**
  - **Validates: Requirements 15.3**

- [ ] 6.7 Implement classify_batch method for bulk predictions
  - Optimize for batch processing
  - Ensure performance meets requirements
  - _Requirements: 1.5_

- [ ]* 6.8 Write property test for batch classification performance
  - **Property 5: Batch Classification Performance**
  - **Validates: Requirements 1.5**

- [ ] 7. Implement explainability engine
- [ ] 7.1 Create ExplainabilityEngine class with SHAP integration
  - Initialize SHAP TreeExplainer
  - Calculate SHAP values for predictions
  - Rank features by contribution
  - Extract top 5 contributing features
  - _Requirements: 2.3, 2.5_

- [ ]* 7.2 Write property test for SHAP values completeness
  - **Property 7: SHAP Values Completeness**
  - **Validates: Requirements 2.3**

- [ ]* 7.3 Write property test for explanation generation performance
  - **Property 9: Explanation Generation Performance**
  - **Validates: Requirements 2.5**

- [ ] 7.4 Implement natural language explanation generation
  - Create explanation templates
  - Generate summaries referencing cookie attributes
  - Format feature contributions as readable text
  - _Requirements: 2.4_

- [ ]* 7.5 Write property test for explanation references cookie attributes
  - **Property 8: Explanation References Cookie Attributes**
  - **Validates: Requirements 2.4**

- [ ] 7.6 Create visualization data structure for UI
  - Format top features with percentages
  - Create bar chart data
  - Add color coding information
  - _Requirements: 11.1, 11.4_

- [ ]* 7.7 Write property test for explanation visual data structure
  - **Property 38: Explanation Visual Data Structure**
  - **Validates: Requirements 11.1**

- [ ] 8. Implement similarity detection module
- [x] 8.1 Create SimilarityDetector class
  - Implement Levenshtein distance calculation for names
  - Implement vendor matching logic
  - Implement domain pattern matching
  - Calculate weighted similarity score
  - _Requirements: 4.2, 8.1, 8.2_

- [ ]* 8.2 Write property test for similarity score range
  - **Property 28: Similarity Score Range**
  - **Validates: Requirements 8.1**

- [ ]* 8.3 Write property test for similarity calculation performance
  - **Property 29: Similarity Calculation Performance**
  - **Validates: Requirements 8.2**

- [x] 8.4 Implement find_similar method for database search
  - Query database for potential matches
  - Calculate similarity for each candidate
  - Filter by threshold (0.75)
  - Return sorted results
  - _Requirements: 4.3, 8.3, 8.4_

- [ ]* 8.5 Write property test for similarity threshold filtering
  - **Property 15: Similarity Threshold Filtering**
  - **Validates: Requirements 4.3**

- [ ]* 8.6 Write property test for similar cookie search performance
  - **Property 30: Similar Cookie Search Performance**
  - **Validates: Requirements 8.3**


- [ ] 9. Create FastAPI endpoints for ML classification
- [x] 9.1 Implement POST /api/v1/ml/classify endpoint
  - Define request/response models
  - Integrate feature extraction
  - Call classification engine
  - Generate explanations
  - Store results in database
  - Return formatted response
  - _Requirements: 1.4, 1.5, 2.1, 2.3, 2.4, 2.5_

- [ ]* 9.2 Write property test for high confidence auto-classification
  - **Property 10: High Confidence Auto-Classification**
  - **Validates: Requirements 3.1**

- [ ]* 9.3 Write property test for medium confidence review flagging
  - **Property 11: Medium Confidence Review Flagging**
  - **Validates: Requirements 3.2**

- [ ]* 9.4 Write property test for low confidence review queueing
  - **Property 12: Low Confidence Review Queueing**
  - **Validates: Requirements 3.3**

- [x] 9.5 Implement POST /api/v1/ml/feedback endpoint
  - Accept user corrections
  - Store in ml_feedback table
  - Trigger similar cookie detection
  - Support bulk application
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 15.5_

- [ ]* 9.6 Write property test for feedback persistence
  - **Property 13: Feedback Persistence**
  - **Validates: Requirements 4.1**

- [ ]* 9.7 Write property test for bulk update performance
  - **Property 16: Bulk Update Performance**
  - **Validates: Requirements 4.4**

- [ ]* 9.8 Write property test for alternative selection feedback
  - **Property 52: Alternative Selection Feedback**
  - **Validates: Requirements 15.5**

- [x] 9.9 Implement GET /api/v1/ml/similar-cookies endpoint
  - Accept cookie ID
  - Find similar cookies
  - Return with similarity scores
  - _Requirements: 8.3, 8.4_

- [ ]* 9.10 Write property test for similar cookie auto-detection
  - **Property 31: Similar Cookie Auto-Detection**
  - **Validates: Requirements 8.4**

- [x] 9.11 Implement GET /api/v1/ml/metrics endpoint
  - Query ml_metrics table
  - Calculate performance metrics
  - Return confusion matrix
  - Include confidence distribution
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ]* 9.12 Write property test for metrics logging completeness
  - **Property 22: Metrics Logging Completeness**
  - **Validates: Requirements 6.1**

- [ ]* 9.13 Write property test for confusion matrix completeness
  - **Property 24: Confusion Matrix Completeness**
  - **Validates: Requirements 6.4**

- [ ]* 9.14 Write property test for metrics export format
  - **Property 25: Metrics Export Format**
  - **Validates: Requirements 6.5**

- [x] 9.15 Add authentication and rate limiting
  - Implement JWT authentication
  - Add rate limiting middleware (100 req/min)
  - Add error handling
  - _Requirements: 10.1_

- [ ] 10. Implement monitoring and alerting
- [x] 10.1 Create metrics collection service
  - Log all classifications to ml_metrics table
  - Calculate aggregated metrics hourly/daily
  - Track confidence distribution
  - Track category distribution
  - _Requirements: 6.1, 6.2_

- [ ]* 10.2 Write property test for performance metrics calculation
  - **Property 23: Performance Metrics Calculation**
  - **Validates: Requirements 6.2**

- [x] 10.3 Implement drift detection
  - Calculate feature distribution drift (KL divergence)
  - Calculate prediction drift
  - Generate alerts when thresholds exceeded
  - _Requirements: 5.1, 5.2_

- [ ]* 10.4 Write property test for drift detection alerting
  - **Property 17: Drift Detection Alerting**
  - **Validates: Requirements 5.1**

- [ ]* 10.5 Write property test for prediction drift alerting
  - **Property 18: Prediction Drift Alerting**
  - **Validates: Requirements 5.2**

- [ ] 10.6 Implement accuracy monitoring and retraining triggers
  - Track model accuracy over time
  - Trigger retraining when accuracy drops below 90%
  - Trigger retraining when correction rate exceeds 25%
  - _Requirements: 5.3, 5.4_

- [ ]* 10.7 Write property test for accuracy drop retraining trigger
  - **Property 19: Accuracy Drop Retraining Trigger**
  - **Validates: Requirements 5.3**

- [ ]* 10.8 Write property test for correction rate alerting
  - **Property 20: Correction Rate Alerting**
  - **Validates: Requirements 5.4**

- [ ]* 10.9 Write property test for confidence drop flagging
  - **Property 21: Confidence Drop Flagging**
  - **Validates: Requirements 5.5**


- [ ] 11. Implement automated retraining pipeline
- [ ] 11.1 Create retraining orchestration script
  - Fetch new labeled cookies from ml_feedback
  - Merge with existing training data
  - Trigger model training
  - Evaluate new model
  - Compare to current production model
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 11.2 Write property test for retraining trigger on data accumulation
  - **Property 26: Retraining Trigger on Data Accumulation**
  - **Validates: Requirements 7.1**

- [ ] 11.3 Implement A/B testing framework
  - Deploy new model to 10% of traffic
  - Track metrics for both models
  - Compare performance after 48 hours
  - Automatic promotion or rollback
  - _Requirements: 7.4_

- [ ] 11.4 Create model deployment automation
  - Version new models with semantic versioning
  - Update production model pointer
  - Log deployment events
  - Maintain rollback capability
  - _Requirements: 7.2, 7.3_

- [ ] 12. Implement vendor database management
- [ ] 12.1 Create vendor database seeding script
  - Import known vendors from CookiePedia
  - Add common vendor patterns (Google, Facebook, etc.)
  - Set typical categories for each vendor
  - _Requirements: 9.1, 9.2_

- [ ] 12.2 Implement vendor lookup in feature extraction
  - Match cookie domain/name to vendor patterns
  - Calculate vendor confidence score
  - Apply confidence boost for known vendors
  - _Requirements: 9.1, 9.2, 9.5_

- [ ]* 12.3 Write property test for known vendor high confidence
  - **Property 33: Known Vendor High Confidence**
  - **Validates: Requirements 9.1**

- [ ]* 12.4 Write property test for vendor match confidence boost
  - **Property 34: Vendor Match Confidence Boost**
  - **Validates: Requirements 9.2**

- [ ] 13. Implement audit trail and compliance features
- [ ] 13.1 Create audit logging for all classifications
  - Log cookie_id, prediction, confidence, model_version, timestamp
  - Store in ml_classifications table
  - Implement 12-month retention policy
  - _Requirements: 10.1, 10.2_

- [ ]* 13.2 Write property test for audit log completeness
  - **Property 35: Audit Log Completeness**
  - **Validates: Requirements 10.1**

- [ ] 13.3 Implement classification history retrieval
  - Query all historical classifications for a cookie
  - Return with timestamps and model versions
  - Optimize query performance
  - _Requirements: 10.3_

- [ ]* 13.4 Write property test for classification history retrieval performance
  - **Property 36: Classification History Retrieval Performance**
  - **Validates: Requirements 10.3**

- [ ] 13.5 Add SHAP values to audit reports
  - Include explanations in all audit records
  - Format for regulatory compliance
  - _Requirements: 10.4_

- [ ]* 13.6 Write property test for audit report SHAP inclusion
  - **Property 37: Audit Report SHAP Inclusion**
  - **Validates: Requirements 10.4**

- [ ] 14. Build frontend UI components
- [ ] 14.1 Create confidence badge component
  - Display confidence level (High/Medium/Low)
  - Color code: green/yellow/red
  - Show percentage
  - _Requirements: 11.3, 11.4_

- [ ]* 14.2 Write property test for confidence score percentage format
  - **Property 40: Confidence Score Percentage Format**
  - **Validates: Requirements 11.4**

- [ ] 14.3 Create explanation panel component
  - Display top 5 contributing features
  - Show bar chart visualization
  - Display natural language summary
  - _Requirements: 2.3, 2.4, 11.1_

- [ ] 14.4 Create review queue interface
  - Filter by confidence level
  - Sort by confidence score
  - Show ML suggestions with explanations
  - Enable one-click approval
  - _Requirements: 3.2, 3.3_

- [ ] 14.5 Create similar cookies panel
  - Display when user classifies a cookie
  - Show similarity scores
  - Enable bulk application
  - _Requirements: 4.3, 8.4_

- [ ] 14.6 Integrate classification into existing cookie table
  - Add classification column
  - Add confidence badge
  - Add explanation tooltip/modal
  - Update on classification completion
  - _Requirements: 2.1, 2.3, 11.3_


- [ ] 15. Implement error handling and edge cases
- [ ] 15.1 Add graceful handling for missing cookie fields
  - Assign default identifiers for missing names
  - Use default values for missing expiry
  - Sanitize special characters
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 15.2 Implement fallback to rule-based classification
  - Create simple rule-based classifier
  - Fall back on model loading failure
  - Log errors and alert ops team
  - _Requirements: 13.4, 13.5_

- [ ] 15.3 Add comprehensive error handling to API endpoints
  - Handle validation errors (400)
  - Handle database errors (503)
  - Handle timeout errors (504)
  - Return clear error messages
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 16. Implement caching and performance optimizations
- [ ] 16.1 Add Redis caching for frequent classifications
  - Cache key: hash(name + domain + vendor)
  - TTL: 1 hour
  - Invalidate on model update
  - _Requirements: 1.4, 1.5_

- [ ] 16.2 Optimize database queries
  - Add indexes on frequently queried columns
  - Implement connection pooling
  - Add query timeout limits
  - _Requirements: 6.3, 8.3, 10.3_

- [ ] 16.3 Optimize model loading
  - Load model once on startup
  - Cache in memory
  - Implement lazy loading for explainer
  - _Requirements: 14.5_

- [ ]* 16.4 Write property test for model loading performance
  - **Property 47: Model Loading Performance**
  - **Validates: Requirements 14.5**

- [ ] 17. Create admin dashboard for model management
- [ ] 17.1 Build model performance dashboard
  - Display accuracy, precision, recall, F1
  - Show confusion matrix heatmap
  - Display confidence distribution
  - Show category distribution over time
  - _Requirements: 6.2, 6.4, 11.5_

- [ ]* 17.2 Write property test for confusion matrix structure
  - **Property 41: Confusion Matrix Structure**
  - **Validates: Requirements 11.5**

- [ ] 17.3 Build feature importance dashboard
  - Display top 10 features with percentages
  - Show feature importance trends
  - Compare across model versions
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ]* 17.4 Write property test for feature importance calculation
  - **Property 42: Feature Importance Calculation**
  - **Validates: Requirements 12.1**

- [ ]* 17.5 Write property test for feature importance ranking
  - **Property 43: Feature Importance Ranking**
  - **Validates: Requirements 12.2**

- [ ]* 17.6 Write property test for top features identification
  - **Property 44: Top Features Identification**
  - **Validates: Requirements 12.3**

- [ ]* 17.7 Write property test for model version comparison data
  - **Property 45: Model Version Comparison Data**
  - **Validates: Requirements 12.4**

- [ ]* 17.8 Write property test for feature importance export format
  - **Property 46: Feature Importance Export Format**
  - **Validates: Requirements 12.5**

- [ ] 17.9 Add manual retraining trigger
  - Button to trigger retraining
  - Show retraining status
  - Display new model metrics
  - _Requirements: 7.1_

- [ ] 18. Write integration tests
- [ ]* 18.1 Test full classification pipeline
  - Submit cookie → Extract features → Classify → Explain → Store
  - Verify database records
  - Verify API response format

- [ ]* 18.2 Test feedback loop workflow
  - Submit correction → Store feedback → Detect similar → Bulk apply
  - Verify all similar cookies updated
  - Verify feedback marked for training

- [ ]* 18.3 Test retraining workflow
  - Accumulate corrections → Trigger retraining → Validate → Deploy
  - Verify model version incremented
  - Verify metrics improve

- [ ]* 18.4 Test monitoring and alerting
  - Simulate accuracy drop → Verify alert
  - Simulate drift → Verify warning
  - Verify metrics dashboard updates

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Create deployment configuration
- [x] 20.1 Create Dockerfile for ML API service
  - Base image with Python 3.10
  - Install dependencies
  - Copy model files
  - Configure Uvicorn
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 20.2 Update docker-compose.yml
  - Add ml-api service
  - Configure environment variables
  - Set up volume mounts for models
  - Link to PostgreSQL and Redis
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 20.3 Create deployment documentation
  - Document environment variables
  - Document model deployment process
  - Document monitoring setup
  - Document rollback procedure
  - _Requirements: All_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
