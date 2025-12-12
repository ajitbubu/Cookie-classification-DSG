"""
Package Training Files for Google Colab

Creates a zip file containing all necessary files for training the model in Google Colab.

Usage:
    python3 scripts/package_for_colab.py
"""

import os
import sys
import shutil
import zipfile
from pathlib import Path
from datetime import datetime


def create_colab_package():
    """Create training package for Google Colab."""

    print("=" * 70)
    print("Creating Google Colab Training Package")
    print("=" * 70)
    print()

    # Paths
    project_root = Path(__file__).parent.parent
    package_dir = project_root / "colab_package"
    zip_path = project_root / "colab_training_package.zip"

    # Clean previous package
    if package_dir.exists():
        print(f"🗑️  Removing old package directory...")
        shutil.rmtree(package_dir)

    if zip_path.exists():
        print(f"🗑️  Removing old zip file...")
        zip_path.unlink()

    # Create package directory
    print(f"\n📁 Creating package directory...")
    package_dir.mkdir(parents=True, exist_ok=True)

    # 1. Copy ML classifier code
    print(f"\n📦 Packaging ML classifier code...")
    ml_classifier_src = project_root / "backend" / "api" / "ml_classifier"
    ml_classifier_dest = package_dir / "ml_classifier"

    # Copy only necessary files
    shutil.copytree(
        ml_classifier_src,
        ml_classifier_dest,
        ignore=shutil.ignore_patterns(
            '__pycache__',
            '*.pyc',
            '*.pyo',
            '.pytest_cache',
            'tests',
            'examples',
            '*.md'
        )
    )
    print(f"   ✅ Copied ML classifier code")

    # 2. Copy latest training dataset
    print(f"\n📊 Packaging training dataset...")
    training_data_dir = project_root / "models" / "training_data"

    if not training_data_dir.exists():
        print(f"   ❌ No training data found!")
        print(f"   Please run: python3 -m backend.api.ml_classifier.training.build_dataset")
        sys.exit(1)

    # Find latest dataset
    datasets = sorted(training_data_dir.glob("initial_training_*"))
    if not datasets:
        print(f"   ❌ No datasets found!")
        sys.exit(1)

    latest_dataset = datasets[-1]
    dataset_dest = package_dir / "training_data" / latest_dataset.name

    shutil.copytree(latest_dataset, dataset_dest)
    print(f"   ✅ Copied dataset: {latest_dataset.name}")

    # Check dataset size
    dataset_size_mb = sum(
        f.stat().st_size for f in dataset_dest.rglob('*') if f.is_file()
    ) / (1024 * 1024)
    print(f"   📏 Dataset size: {dataset_size_mb:.2f} MB")

    # 3. Create standalone training script
    print(f"\n🐍 Creating standalone training script...")
    train_script_content = f'''"""
Standalone Training Script for Google Colab

This script trains cookie classification models without requiring the full backend.
"""

import sys
import os
from pathlib import Path

# Add ml_classifier to path
sys.path.insert(0, '/content')

# Import training components
from ml_classifier.training.model_trainer import ModelTrainer
from ml_classifier.training.dataset_builder import DatasetBuilder
import argparse


def main():
    """Train ML models."""
    parser = argparse.ArgumentParser(description='Train cookie classification models')
    parser.add_argument('--dataset', type=str, help='Path to dataset directory')
    parser.add_argument('--model-type', type=str, choices=['rf', 'xgboost', 'both'],
                       default='both', help='Model type to train')
    parser.add_argument('--version', type=str, default='2.0.0', help='Model version')
    parser.add_argument('--no-calibration', action='store_true',
                       help='Skip probability calibration')
    parser.add_argument('--no-balance', action='store_true', help='Skip class balancing')

    args = parser.parse_args()

    print("=" * 70)
    print("ML Model Training Pipeline (Google Colab)")
    print("=" * 70)
    print()

    # Find dataset
    if args.dataset:
        dataset_dir = Path(args.dataset)
    else:
        training_data_dir = Path("/content/training_data")
        datasets = sorted(training_data_dir.glob("initial_training_*"))
        if not datasets:
            print("❌ No datasets found!")
            sys.exit(1)
        dataset_dir = datasets[-1]

    print(f"📂 Using dataset: {{dataset_dir.name}}")
    print()

    # Load dataset
    builder = DatasetBuilder({{}})
    features_df, labels_df = builder.load_dataset(dataset_dir)

    print(f"✅ Loaded dataset: {{len(features_df)}} samples, {{len(features_df.columns)}} features")
    print()

    # Create trainer
    trainer = ModelTrainer(output_dir="/content/models")

    # Prepare data
    X_train, X_val, X_test, y_train, y_val, y_test = trainer.prepare_data(
        features_df, labels_df, balance_classes=not args.no_balance
    )

    models = {{}}

    # Train Random Forest
    if args.model_type in ['rf', 'both']:
        print("\\n" + "=" * 70)
        print("Training Random Forest")
        print("=" * 70)
        rf_model = trainer.train_random_forest(X_train, y_train, X_val, y_val)

        if not args.no_calibration:
            rf_model = trainer.calibrate_model(rf_model, X_val, y_val)

        models['Random Forest'] = rf_model

    # Train XGBoost
    if args.model_type in ['xgboost', 'both']:
        print("\\n" + "=" * 70)
        print("Training XGBoost")
        print("=" * 70)
        xgb_model = trainer.train_xgboost(X_train, y_train, X_val, y_val)
        models['XGBoost'] = xgb_model

    # Compare models
    if len(models) > 1:
        print("\\n" + "=" * 70)
        print("Model Comparison")
        print("=" * 70)
        best_model_name = trainer.compare_models(models, X_test, y_test)
        best_model = models[best_model_name]
        model_type = 'random_forest' if 'Random' in best_model_name else 'xgboost'
    else:
        best_model_name = list(models.keys())[0]
        best_model = models[best_model_name]
        model_type = 'random_forest' if 'Random' in best_model_name else 'xgboost'
        trainer.evaluate_model(best_model, X_test, y_test, best_model_name)

    # Final evaluation
    final_metrics = trainer.evaluate_model(best_model, X_test, y_test, "Final Model")

    # Save model
    feature_names = list(features_df.columns)
    model_dir = trainer.save_model(
        best_model, feature_names, final_metrics, args.version, model_type
    )

    print("\\n" + "=" * 70)
    print("✅ Training Complete!")
    print("=" * 70)
    print(f"\\nBest Model: {{best_model_name}}")
    print(f"Version: {{args.version}}")
    print(f"Saved to: {{model_dir}}")
    print(f"\\nPerformance:")
    print(f"  Accuracy:  {{final_metrics['accuracy']:.4f}}")
    print(f"  Precision: {{final_metrics['precision']:.4f}}")
    print(f"  Recall:    {{final_metrics['recall']:.4f}}")
    print(f"  F1-Score:  {{final_metrics['f1_score']:.4f}}")
    print()


if __name__ == "__main__":
    main()
'''

    train_script_path = package_dir / "train_model.py"
    with open(train_script_path, 'w') as f:
        f.write(train_script_content)
    print(f"   ✅ Created train_model.py")

    # 4. Create README for Colab
    print(f"\n📝 Creating README...")
    readme_content = f'''# Cookie Classification Model Training Package

Created: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Contents

- `ml_classifier/` - ML classification code (feature extractor, model trainer, etc.)
- `training_data/` - Pre-built training dataset
- `train_model.py` - Standalone training script for Colab

## Quick Start in Google Colab

1. Upload this zip file to Google Drive
2. Open the Colab notebook: `Cookie_Model_Training.ipynb`
3. Run all cells
4. Download trained model

## Training Locally (Alternative)

```bash
# Extract package
unzip colab_training_package.zip
cd colab_package/

# Train models
python3 train_model.py --model-type both --version 2.0.0
```

## Training Options

```bash
# Train both models (default)
python3 train_model.py --model-type both --version 2.0.0

# Train only Random Forest
python3 train_model.py --model-type rf --version 2.0.0

# Train only XGBoost
python3 train_model.py --model-type xgboost --version 2.0.0

# Skip calibration
python3 train_model.py --model-type both --version 2.0.0 --no-calibration

# Skip class balancing (SMOTE)
python3 train_model.py --model-type both --version 2.0.0 --no-balance
```

## Expected Output

- Models saved to: `models/v2.0.0/`
- Files: `model.pkl`, `metadata.json`, `feature_names.json`

## Performance Expectations

- Accuracy: 85-96%
- Training time: 4-6 minutes (GPU), 10-15 minutes (CPU)

## Support

For issues, check the full guide: `GOOGLE_COLAB_TRAINING_GUIDE.md`
'''

    readme_path = package_dir / "README.md"
    with open(readme_path, 'w') as f:
        f.write(readme_content)
    print(f"   ✅ Created README.md")

    # 5. Create zip file
    print(f"\n📦 Creating zip file...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(package_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(package_dir)
                zipf.write(file_path, arcname)

    # Get zip size
    zip_size_mb = zip_path.stat().st_size / (1024 * 1024)

    print(f"   ✅ Created: {zip_path.name}")
    print(f"   📏 Size: {zip_size_mb:.2f} MB")

    # 6. Show package contents
    print(f"\n📋 Package Contents:")
    for item in sorted(package_dir.rglob('*')):
        if item.is_file():
            rel_path = item.relative_to(package_dir)
            size_kb = item.stat().st_size / 1024
            print(f"   {rel_path} ({size_kb:.1f} KB)")

    # 7. Cleanup temp directory
    print(f"\n🧹 Cleaning up...")
    shutil.rmtree(package_dir)

    print(f"\n" + "=" * 70)
    print("✅ Package Created Successfully!")
    print("=" * 70)
    print(f"\n📦 File: {zip_path}")
    print(f"📏 Size: {zip_size_mb:.2f} MB")

    print(f"\n📤 Upload Instructions:")
    print(f"1. Go to Google Drive: https://drive.google.com")
    print(f"2. Create folder: 'Cookie_ML_Training'")
    print(f"3. Upload: {zip_path.name}")
    print(f"4. Upload: Cookie_Model_Training.ipynb")
    print(f"5. Open notebook in Google Colab")
    print(f"6. Run all cells to train model")

    print(f"\n💡 Tips:")
    print(f"   - Enable GPU in Colab for faster training (4-6 min vs 10-15 min)")
    print(f"   - Training will create models/v2.0.0/ directory")
    print(f"   - Download trained model or save to Google Drive")

    print(f"\n📚 Documentation:")
    print(f"   - Full guide: docs/GOOGLE_COLAB_TRAINING_GUIDE.md")
    print(f"   - Notebook: Cookie_Model_Training.ipynb")

    print()


if __name__ == "__main__":
    try:
        create_colab_package()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
