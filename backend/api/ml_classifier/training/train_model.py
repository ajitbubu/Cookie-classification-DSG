"""
Train ML Model Script

Trains both baseline and production models, compares them, and saves the best.

Usage:
    python3 -m backend.api.ml_classifier.training.train_model
"""

import sys
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from backend.api.ml_classifier.training.model_trainer import ModelTrainer
from backend.api.ml_classifier.training.dataset_builder import DatasetBuilder


def main():
    """Train ML models."""
    parser = argparse.ArgumentParser(description='Train cookie classification models')
    parser.add_argument('--dataset', type=str, help='Path to dataset directory')
    parser.add_argument('--model-type', type=str, choices=['rf', 'xgboost', 'both'], default='both',
                       help='Model type to train (rf=Random Forest, xgboost=XGBoost, both=train and compare)')
    parser.add_argument('--version', type=str, default='1.0.0', help='Model version')
    parser.add_argument('--no-calibration', action='store_true', help='Skip probability calibration')
    parser.add_argument('--no-balance', action='store_true', help='Skip class balancing')
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("ML Model Training Pipeline")
    print("=" * 70)
    print()
    
    # Find latest dataset if not specified
    if args.dataset:
        dataset_dir = Path(args.dataset)
    else:
        training_data_dir = Path("models/training_data")
        if not training_data_dir.exists():
            print("❌ No training data found. Run build_dataset.py first.")
            sys.exit(1)
        
        # Find latest dataset
        datasets = sorted(training_data_dir.glob("initial_training_*"))
        if not datasets:
            print("❌ No datasets found in models/training_data/")
            sys.exit(1)
        
        dataset_dir = datasets[-1]
        print(f"📂 Using latest dataset: {dataset_dir.name}")
        print()
    
    # Load dataset
    builder = DatasetBuilder({})  # No DB needed for loading
    features_df, labels_df = builder.load_dataset(dataset_dir)
    
    # Get feature names
    feature_names = list(features_df.columns)
    
    # Create trainer
    trainer = ModelTrainer(output_dir="models")
    
    # Prepare data
    X_train, X_val, X_test, y_train, y_val, y_test = trainer.prepare_data(
        features_df,
        labels_df,
        balance_classes=not args.no_balance
    )
    
    models = {}
    
    # Train Random Forest
    if args.model_type in ['rf', 'both']:
        rf_model = trainer.train_random_forest(X_train, y_train, X_val, y_val)
        
        # Calibrate
        if not args.no_calibration:
            rf_model = trainer.calibrate_model(rf_model, X_val, y_val)
        
        models['Random Forest'] = rf_model
    
    # Train XGBoost
    if args.model_type in ['xgboost', 'both']:
        xgb_model = trainer.train_xgboost(X_train, y_train, X_val, y_val)
        
        # Calibrate (skip for XGBoost due to compatibility issues)
        # XGBoost already outputs well-calibrated probabilities
        if not args.no_calibration and args.model_type == 'xgboost':
            try:
                xgb_model = trainer.calibrate_model(xgb_model, X_val, y_val)
            except Exception as e:
                print(f"⚠️  Calibration skipped for XGBoost: {e}")
                print("   (XGBoost probabilities are already well-calibrated)")
        
        models['XGBoost'] = xgb_model
    
    # Compare models if training both
    if len(models) > 1:
        best_model_name = trainer.compare_models(models, X_test, y_test)
        best_model = models[best_model_name]
        model_type = 'random_forest' if 'Random' in best_model_name else 'xgboost'
    else:
        best_model_name = list(models.keys())[0]
        best_model = models[best_model_name]
        model_type = 'random_forest' if 'Random' in best_model_name else 'xgboost'
        
        # Evaluate single model
        trainer.evaluate_model(best_model, X_test, y_test, best_model_name)
    
    # Get final metrics
    final_metrics = trainer.evaluate_model(best_model, X_test, y_test, "Final Model")
    
    # Save best model
    model_dir = trainer.save_model(
        best_model,
        feature_names,
        final_metrics,
        args.version,
        model_type
    )
    
    print("=" * 70)
    print("✅ Training Complete!")
    print("=" * 70)
    print(f"\nBest Model: {best_model_name}")
    print(f"Model Type: {model_type}")
    print(f"Version: {args.version}")
    print(f"Saved to: {model_dir}")
    print()
    print("Performance Summary:")
    print(f"  Accuracy:  {final_metrics['accuracy']:.4f}")
    print(f"  Precision: {final_metrics['precision']:.4f}")
    print(f"  Recall:    {final_metrics['recall']:.4f}")
    print(f"  F1-Score:  {final_metrics['f1_score']:.4f}")
    print()
    print("Next Steps:")
    print("1. Review model performance metrics")
    print("2. Test model with sample cookies")
    print("3. Integrate into classification API (Task 6)")
    print()


if __name__ == "__main__":
    main()
