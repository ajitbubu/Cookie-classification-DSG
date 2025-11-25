# Database Migrations

## ML Classification Schema (v1.0.0)

### Overview
This migration adds support for ML-based cookie classification with confidence scoring, explainability, and continuous learning.

### Tables Created

#### 1. ml_classifications
Stores ML classification results with confidence scores and SHAP-based explanations.

**Key Columns:**
- `predicted_category` - Classification result (Strictly Necessary, Analytics, Marketing, Functional, Unknown)
- `confidence_score` - Calibrated confidence (0.0-1.0)
- `confidence_level` - High/Medium/Low
- `shap_values` - SHAP feature contributions (JSONB)
- `top_features` - Top 5 contributing features (JSONB)
- `explanation_summary` - Natural language explanation
- `auto_classified` - Whether prediction was auto-applied
- `requires_review` - Whether manual review is needed

#### 2. ml_feedback
Stores user corrections for continuous learning.

**Key Columns:**
- `predicted_label` - Original ML prediction
- `corrected_label` - User's correction
- `applied_to_similar` - Whether correction was bulk-applied
- `similar_cookies_count` - Number of similar cookies updated
- `used_in_training` - Whether feedback has been incorporated

#### 3. ml_metrics
Tracks model performance metrics over time.

**Key Columns:**
- `metric_date` / `metric_hour` - Time window
- `model_version` - Model version
- `total_predictions` - Total classifications
- `auto_classified_count` - Auto-applied count
- `confidence distribution` - High/Medium/Low counts
- `category_distribution` - Per-category counts
- `correction_count` / `correction_rate` - User feedback metrics

#### 4. vendor_database
Known vendor information for improved classification.

**Key Columns:**
- `vendor_name` - Vendor name (unique)
- `typical_category` - Vendor's typical cookie category
- `cookie_name_patterns` - Glob patterns for cookie names (JSONB)
- `domain_patterns` - Glob patterns for domains (JSONB)
- `confidence_score` - Vendor match confidence

### Helper Functions

- `calculate_correction_rate(total, corrections)` - Calculate correction rate
- `get_classification_stats(start, end, version)` - Get aggregated statistics
- `cleanup_old_ml_data()` - Archive data older than 12 months
- `update_vendor_updated_at()` - Auto-update vendor timestamps

### Initial Data

Seeded 5 common vendors:
- Google LLC (Analytics)
- Facebook (Marketing)
- LinkedIn Corporation (Analytics)
- Microsoft Corporation (Analytics)
- Twitter (Marketing)

### Running the Migration

```bash
# Apply migration
python backend/db/run_ml_migration.py

# Rollback migration (WARNING: Deletes all ML data)
python backend/db/run_ml_migration.py --rollback
```

### Environment Variables

Ensure these are set in your `.env` file:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cookie_scanner
DB_USER=postgres
DB_PASSWORD=postgres
```

### Indexes

All tables have appropriate indexes for:
- Foreign key lookups
- Time-based queries
- Confidence score filtering
- Model version filtering

### Data Retention

- **Classifications**: 12 months (auto-archived)
- **Feedback**: Permanent (used for training)
- **Metrics**: 12 months (auto-archived)
- **Vendors**: Permanent

### Next Steps

After running the migration:
1. Verify tables were created: `\dt` in psql
2. Check vendor data: `SELECT * FROM vendor_database;`
3. Proceed to Task 3: Implement feature extraction module
