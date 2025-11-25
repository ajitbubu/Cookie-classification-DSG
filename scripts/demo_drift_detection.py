#!/usr/bin/env python3
"""
Drift Detection Demo

Demonstrates the drift detection capabilities of the ML Cookie Classification System.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'api'))

import numpy as np
from datetime import date, timedelta
from ml_classifier.drift_detector import get_drift_detector


def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def demo_feature_drift():
    """Demonstrate feature drift detection."""
    print_header("DEMO 1: Feature Distribution Drift")
    
    print("\nScenario: Cookie characteristics change over time")
    print("  - Baseline: Normal cookie expiry times (mean=365 days)")
    print("  - Current:  Longer expiry times (mean=730 days)")
    
    detector = get_drift_detector()
    
    # Simulate baseline features (normal distribution)
    print("\n📊 Generating baseline feature data (1000 samples)...")
    baseline_features = np.random.normal(365, 100, (1000, 10))
    
    # Simulate current features (shifted distribution)
    print("📊 Generating current feature data (1000 samples)...")
    current_features = np.random.normal(730, 100, (1000, 10))
    
    feature_names = [
        "expiry_days", "name_length", "domain_length", 
        "path_length", "value_length", "http_only",
        "secure", "same_site", "is_third_party", "vendor_confidence"
    ]
    
    # Detect drift
    print("\n🔍 Checking for feature drift...")
    drift_detected, alert = detector.detect_feature_drift(
        baseline_features,
        current_features,
        feature_names
    )
    
    if drift_detected:
        print("\n⚠️  DRIFT DETECTED!")
        print(f"\n📋 Alert Details:")
        print(f"   Level: {alert.alert_level.value.upper()}")
        print(f"   Type: {alert.alert_type}")
        print(f"   Message: {alert.message}")
        print(f"\n📈 Metrics:")
        print(f"   Max KL Divergence: {alert.metric_value:.4f}")
        print(f"   Threshold: {alert.threshold}")
        print(f"   Avg KL Divergence: {alert.details['avg_kl_divergence']:.4f}")
        
        print(f"\n🎯 Drifted Features ({len(alert.details['drifted_features'])}):")
        for feat in alert.details['drifted_features'][:5]:
            print(f"   • {feat['feature']}: KL = {feat['kl_divergence']:.4f}")
    else:
        print("\n✅ No drift detected")
    
    print("\n💡 Recommendation:")
    if drift_detected:
        print("   → Investigate why cookie characteristics changed")
        print("   → Consider retraining model with new data")
        print("   → Monitor model accuracy closely")
    else:
        print("   → Continue normal operations")


def demo_prediction_drift():
    """Demonstrate prediction drift detection."""
    print_header("DEMO 2: Prediction Distribution Drift")
    
    print("\nScenario: Model starts predicting different categories")
    print("  - Baseline: 40% Analytics, 30% Marketing, 30% Other")
    print("  - Current:  20% Analytics, 60% Marketing, 20% Other")
    
    detector = get_drift_detector()
    
    # Baseline predictions
    baseline_predictions = {
        "Analytics": 400,
        "Marketing": 300,
        "Strictly Necessary": 200,
        "Functional": 100,
        "Unknown": 50
    }
    
    # Current predictions (significant shift)
    current_predictions = {
        "Analytics": 200,
        "Marketing": 600,
        "Strictly Necessary": 200,
        "Functional": 100,
        "Unknown": 50
    }
    
    print("\n📊 Baseline Distribution:")
    total_baseline = sum(baseline_predictions.values())
    for cat, count in baseline_predictions.items():
        pct = (count / total_baseline) * 100
        print(f"   {cat:20s}: {count:4d} ({pct:5.1f}%)")
    
    print("\n📊 Current Distribution:")
    total_current = sum(current_predictions.values())
    for cat, count in current_predictions.items():
        pct = (count / total_current) * 100
        print(f"   {cat:20s}: {count:4d} ({pct:5.1f}%)")
    
    # Detect drift
    print("\n🔍 Checking for prediction drift...")
    drift_detected, alert = detector.detect_prediction_drift(
        baseline_predictions,
        current_predictions
    )
    
    if drift_detected:
        print("\n🚨 CRITICAL DRIFT DETECTED!")
        print(f"\n📋 Alert Details:")
        print(f"   Level: {alert.alert_level.value.upper()}")
        print(f"   Type: {alert.alert_type}")
        print(f"   Message: {alert.message}")
        print(f"\n📈 Metrics:")
        print(f"   Max Change: {alert.metric_value:.1%}")
        print(f"   Threshold: {alert.threshold:.1%}")
        print(f"   Category: {alert.details['max_change_category']}")
        
        print(f"\n📊 Category Changes:")
        for cat, changes in alert.details['category_changes'].items():
            if changes['change'] > 0.05:  # Show significant changes
                print(f"   {cat:20s}: {changes['baseline_pct']:.1%} → {changes['current_pct']:.1%} (Δ {changes['change']:.1%})")
    else:
        print("\n✅ No drift detected")
    
    print("\n💡 Recommendation:")
    if drift_detected:
        print("   → URGENT: Investigate model behavior")
        print("   → Check for data quality issues")
        print("   → Review recent changes to cookie scanning")
        print("   → Consider immediate model retraining")
    else:
        print("   → Continue normal operations")


def demo_metrics_based_drift():
    """Demonstrate metrics-based drift detection."""
    print_header("DEMO 3: Metrics-Based Drift Detection")
    
    print("\nScenario: Analyzing drift from historical metrics")
    print("  - Baseline: Last 7 days (Nov 1-7)")
    print("  - Current:  Today (Nov 10)")
    
    detector = get_drift_detector()
    
    # Create mock metrics data
    baseline_date = date(2025, 11, 1)
    current_date = date(2025, 11, 10)
    
    metrics_data = []
    
    print("\n📊 Generating baseline metrics (7 days)...")
    for i in range(7):
        metrics_data.append({
            'metric_date': baseline_date + timedelta(days=i),
            'strictly_necessary_count': 200,
            'analytics_count': 400,
            'marketing_count': 300,
            'functional_count': 100,
            'unknown_count': 50
        })
    
    print("📊 Generating current metrics (1 day with drift)...")
    metrics_data.append({
        'metric_date': current_date,
        'strictly_necessary_count': 200,
        'analytics_count': 100,  # Dropped significantly
        'marketing_count': 650,  # Increased significantly
        'functional_count': 100,
        'unknown_count': 50
    })
    
    # Check drift
    print("\n🔍 Analyzing metrics for drift...")
    alerts = detector.check_drift_from_metrics(
        baseline_date,
        current_date,
        metrics_data
    )
    
    # Generate report
    report = detector.generate_drift_report(alerts)
    
    print(f"\n📋 Drift Report:")
    print(f"   Drift Detected: {'YES' if report['drift_detected'] else 'NO'}")
    print(f"   Total Alerts: {report['total_alerts']}")
    print(f"   Warning Count: {report['warning_count']}")
    print(f"   Critical Count: {report['critical_count']}")
    
    if report['drift_detected']:
        print(f"\n🚨 Alerts:")
        for i, alert in enumerate(report['alerts'], 1):
            print(f"\n   Alert #{i}:")
            print(f"      Level: {alert['level'].upper()}")
            print(f"      Type: {alert['type']}")
            print(f"      Message: {alert['message']}")
            print(f"      Metric: {alert['metric_value']:.1%}")
            print(f"      Threshold: {alert['threshold']:.1%}")


def demo_drift_workflow():
    """Demonstrate complete drift detection workflow."""
    print_header("DEMO 4: Complete Drift Detection Workflow")
    
    print("\nScenario: Daily drift monitoring workflow")
    print("  1. Collect feature data from recent classifications")
    print("  2. Check for feature drift")
    print("  3. Check for prediction drift")
    print("  4. Generate comprehensive report")
    print("  5. Take action based on alerts")
    
    detector = get_drift_detector()
    
    # Step 1: Collect data
    print("\n📊 Step 1: Collecting data...")
    baseline_features = np.random.normal(0, 1, (1000, 10))
    current_features = np.random.normal(1.5, 1, (1000, 10))
    
    baseline_preds = {"Analytics": 500, "Marketing": 300, "Strictly Necessary": 200}
    current_preds = {"Analytics": 200, "Marketing": 600, "Strictly Necessary": 200}
    
    # Step 2: Check feature drift
    print("🔍 Step 2: Checking feature drift...")
    feature_drift, feature_alert = detector.detect_feature_drift(baseline_features, current_features)
    print(f"   Result: {'DRIFT DETECTED' if feature_drift else 'No drift'}")
    
    # Step 3: Check prediction drift
    print("🔍 Step 3: Checking prediction drift...")
    pred_drift, pred_alert = detector.detect_prediction_drift(baseline_preds, current_preds)
    print(f"   Result: {'DRIFT DETECTED' if pred_drift else 'No drift'}")
    
    # Step 4: Generate report
    print("📝 Step 4: Generating report...")
    all_alerts = [a for a in [feature_alert, pred_alert] if a is not None]
    report = detector.generate_drift_report(all_alerts)
    
    print(f"\n📋 Comprehensive Drift Report:")
    print(f"   Status: {'🚨 DRIFTING' if report['drift_detected'] else '✅ STABLE'}")
    print(f"   Total Alerts: {report['total_alerts']}")
    print(f"   Warnings: {report['warning_count']}")
    print(f"   Critical: {report['critical_count']}")
    
    # Step 5: Recommendations
    print("\n💡 Step 5: Recommended Actions:")
    if report['critical_count'] > 0:
        print("   🚨 CRITICAL:")
        print("      → Stop auto-classification")
        print("      → Investigate immediately")
        print("      → Trigger emergency retraining")
    elif report['warning_count'] > 0:
        print("   ⚠️  WARNING:")
        print("      → Monitor closely")
        print("      → Review feature distributions")
        print("      → Schedule retraining")
    else:
        print("   ✅ ALL CLEAR:")
        print("      → Continue normal operations")
        print("      → Maintain regular monitoring")


def main():
    """Run all drift detection demos."""
    print("\n" + "=" * 70)
    print("  ML COOKIE CLASSIFICATION - DRIFT DETECTION DEMO")
    print("=" * 70)
    print("\n  This demo showcases the drift detection capabilities")
    print("  of the ML Cookie Classification System.")
    print("\n  Drift detection helps monitor model performance by")
    print("  identifying when input data or predictions change")
    print("  significantly over time.")
    
    try:
        demo_feature_drift()
        input("\n\nPress Enter to continue to next demo...")
        
        demo_prediction_drift()
        input("\n\nPress Enter to continue to next demo...")
        
        demo_metrics_based_drift()
        input("\n\nPress Enter to continue to next demo...")
        
        demo_drift_workflow()
        
        print("\n" + "=" * 70)
        print("  ✅ DEMO COMPLETE")
        print("=" * 70)
        print("\n  The drift detection system is production-ready!")
        print("\n  Key Features:")
        print("    • Feature distribution drift (KL divergence)")
        print("    • Prediction distribution drift (category changes)")
        print("    • Metrics-based drift analysis")
        print("    • Automated alert generation")
        print("    • REST API endpoints")
        print("\n  Next Steps:")
        print("    • Integrate with monitoring dashboard")
        print("    • Set up automated alerts")
        print("    • Configure retraining triggers")
        print("=" * 70)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
