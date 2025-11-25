# Drift Detection Module

## Overview

The drift detection module monitors ML model performance by detecting changes in:
1. **Feature distributions** - Using KL divergence to detect shifts in input data
2. **Prediction distributions** - Tracking changes in category predictions over time

When drift exceeds configured thresholds, the system generates alerts to notify operators that the model may need retraining.

## Features

### Feature Distribution Drift

Monitors changes in the statistical distribution of input features using **Kullback-Leibler (KL) divergence**.

- **Threshold**: 0.1 (configurable)
- **Alert Level**: WARNING
- **Use Case**: Detects when incoming cookies have different characteristics than training data

**Example**: If cookies suddenly have much longer expiry times or different domain patterns, feature drift will be detected.

### Prediction Distribution Drift

Monitors changes in the distribution of predicted categories.

- **Threshold**: 20% (configurable)
- **Alert Level**: CRITICAL
- **Use Case**: Detects when the model starts predicting different categories than baseline

**Example**: If the model suddenly classifies 50% of cookies as "Marketing" when it previously classified 30%, prediction drift will be detected.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DriftDetector                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  detect_feature_drift()                                      │
│    ├─ Calculate KL divergence for each feature              │
│    ├─ Compare to threshold (0.1)                            │
│    └─ Generate WARNING alert if exceeded                    │
│                                                              │
│  detect_prediction_drift()                                   │
│    ├─ Calculate category distribution changes               │
│    ├─ Compare to threshold (20%)                            │
│    └─ Generate CRITICAL alert if exceeded                   │
│                                                              │
│  check_drift_from_metrics()                                  │
│    ├─ Aggregate metrics from database                       │
│    ├─ Compare baseline vs current period                    │
│    └─ Return list of alerts                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/v1/ml/drift/check

Check for drift between baseline and current periods.

**Request**:
```json
{
  "baseline_start_date": "2025-11-01",
  "baseline_end_date": "2025-11-08",
  "current_date": "2025-11-10",
  "model_version": "1.0.0"  // optional
}
```

**Response**:
```json
{
  "drift_detected": true,
  "total_alerts": 2,
  "warning_count": 1,
  "critical_count": 1,
  "alerts": [
    {
      "level": "warning",
      "type": "feature_drift",
      "message": "Feature distribution drift detected: 5 features exceeded threshold",
      "metric_value": 0.234,
      "threshold": 0.1,
      "detected_at": "2025-11-24T10:30:00",
      "details": {
        "avg_kl_divergence": 0.156,
        "max_kl_divergence": 0.234,
        "drifted_features": [
          {"feature": "expiry_days", "kl_divergence": 0.234},
          {"feature": "name_length", "kl_divergence": 0.189}
        ]
      }
    },
    {
      "level": "critical",
      "type": "prediction_drift",
      "message": "Prediction distribution drift detected: 25.3% change in Marketing",
      "metric_value": 0.253,
      "threshold": 0.20,
      "detected_at": "2025-11-24T10:30:00",
      "details": {
        "max_change": 0.253,
        "max_change_category": "Marketing",
        "category_changes": {
          "Marketing": {
            "baseline_pct": 0.286,
            "current_pct": 0.539,
            "change": 0.253
          }
        }
      }
    }
  ],
  "processing_time_ms": 45.2
}
```

### GET /api/v1/ml/drift/status

Get current drift status for the last N days.

**Query Parameters**:
- `days` (optional): Number of days to check (default: 7)

**Response**:
```json
{
  "status": "drifting",  // or "stable"
  "baseline_period": {
    "start": "2025-11-10",
    "end": "2025-11-17"
  },
  "current_date": "2025-11-24",
  "drift_detected": true,
  "total_alerts": 1,
  "warning_count": 0,
  "critical_count": 1,
  "timestamp": "2025-11-24T10:30:00"
}
```

## Usage Examples

### Python SDK

```python
from ml_classifier.drift_detector import DriftDetector
import numpy as np

# Initialize detector
detector = DriftDetector(
    feature_drift_threshold=0.1,
    prediction_drift_threshold=0.20
)

# Check feature drift
baseline_features = np.random.normal(0, 1, (1000, 25))
current_features = np.random.normal(0.5, 1, (1000, 25))

drift_detected, alert = detector.detect_feature_drift(
    baseline_features,
    current_features,
    feature_names=["name_length", "expiry_days", ...]
)

if drift_detected:
    print(f"Feature drift detected: {alert.message}")
    print(f"Drifted features: {alert.details['drifted_features']}")

# Check prediction drift
baseline_preds = {
    "Analytics": 400,
    "Marketing": 300,
    "Strictly Necessary": 200
}
current_preds = {
    "Analytics": 200,
    "Marketing": 500,
    "Strictly Necessary": 200
}

drift_detected, alert = detector.detect_prediction_drift(
    baseline_preds,
    current_preds
)

if drift_detected:
    print(f"Prediction drift detected: {alert.message}")
    print(f"Max change: {alert.metric_value:.1%}")
```

### REST API

```bash
# Check drift
curl -X POST http://localhost:8000/api/v1/ml/drift/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "baseline_start_date": "2025-11-01",
    "baseline_end_date": "2025-11-08",
    "current_date": "2025-11-10"
  }'

# Get drift status
curl http://localhost:8000/api/v1/ml/drift/status?days=7 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Configuration

### Thresholds

Adjust thresholds when initializing the detector:

```python
detector = DriftDetector(
    feature_drift_threshold=0.15,      # Higher = less sensitive
    prediction_drift_threshold=0.25,   # Higher = less sensitive
    baseline_window_days=14,           # Longer baseline period
    comparison_window_days=1           # Current period length
)
```

### Recommended Thresholds

| Metric | Conservative | Moderate | Aggressive |
|--------|-------------|----------|------------|
| Feature Drift (KL) | 0.05 | 0.1 | 0.2 |
| Prediction Drift (%) | 15% | 20% | 30% |

## Alert Handling

### Alert Levels

1. **WARNING** (Feature Drift)
   - Action: Monitor closely
   - Response: Review feature distributions
   - Urgency: Low

2. **CRITICAL** (Prediction Drift)
   - Action: Investigate immediately
   - Response: Consider model retraining
   - Urgency: High

### Recommended Actions

When drift is detected:

1. **Investigate Root Cause**
   - Check for data quality issues
   - Review recent changes to cookie scanning
   - Analyze drifted features/categories

2. **Validate Model Performance**
   - Check accuracy on recent data
   - Review user correction rates
   - Analyze confusion matrix

3. **Consider Retraining**
   - If accuracy drops below 90%
   - If correction rate exceeds 25%
   - If drift persists for multiple days

4. **Update Monitoring**
   - Adjust thresholds if needed
   - Add custom alerts
   - Update dashboards

## Integration with Monitoring

### Prometheus Metrics

```python
# Example metrics to export
drift_alerts_total = Counter('ml_drift_alerts_total', 'Total drift alerts', ['level', 'type'])
drift_kl_divergence = Gauge('ml_drift_kl_divergence', 'Max KL divergence')
drift_prediction_change = Gauge('ml_drift_prediction_change', 'Max prediction change')
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: ml_drift
    rules:
      - alert: FeatureDriftDetected
        expr: ml_drift_kl_divergence > 0.1
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Feature drift detected"
          
      - alert: PredictionDriftDetected
        expr: ml_drift_prediction_change > 0.20
        for: 30m
        labels:
          severity: critical
        annotations:
          summary: "Prediction drift detected"
```

## Testing

Run the test suite:

```bash
# Unit tests
python3 test_drift_detection.py

# API tests
python3 test_drift_api.py
```

## Performance

- **Feature drift calculation**: ~10ms per feature (for 1000 samples)
- **Prediction drift calculation**: <1ms
- **Metrics-based drift check**: ~50ms (depends on database query)

## Limitations

1. **Requires sufficient data**: Need at least 100 samples for reliable KL divergence
2. **Sensitive to outliers**: Extreme values can skew distributions
3. **Baseline selection**: Choosing appropriate baseline period is critical
4. **Categorical features**: KL divergence works best with continuous features

## Future Enhancements

1. **Multivariate drift detection**: Detect drift in feature combinations
2. **Adaptive thresholds**: Automatically adjust based on historical patterns
3. **Drift visualization**: Generate plots showing distribution changes
4. **Automated retraining**: Trigger retraining when drift exceeds thresholds
5. **Feature importance drift**: Track changes in feature importance over time

## References

- **Requirements**: 5.1, 5.2
- **Design Document**: Section "Monitoring and Observability"
- **KL Divergence**: https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence
- **Concept Drift**: https://en.wikipedia.org/wiki/Concept_drift

## Support

For issues or questions:
- Check logs: `backend/api/ml_classifier/drift_detector.py`
- Review metrics: `/api/v1/ml/metrics`
- Contact: ML Engineering Team
