"""
Build Training Dataset Script

Run this script to create the initial training dataset.

Usage:
    python3 -m backend.api.ml_classifier.training.build_dataset
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from backend.api.ml_classifier.training.dataset_builder import DatasetBuilder


def main():
    """Build training dataset."""
    # Load environment variables
    load_dotenv()
    
    # Database configuration
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'cookie_scanner'),
        'user': os.getenv('DB_USER', 'scanner'),
        'password': os.getenv('DB_PASSWORD', 'scanner_password')
    }
    
    # Create dataset builder
    output_dir = Path(__file__).parent.parent.parent.parent.parent / "models" / "training_data"
    builder = DatasetBuilder(db_config, output_dir=str(output_dir))
    
    try:
        # Build dataset
        features_df, labels_df = builder.build_training_dataset(
            include_db_cookies=True,
            include_common_cookies=True,
            synthetic_count=300,  # Create 300 synthetic variations
            min_samples_per_category=100
        )
        
        # Validate dataset
        if not builder.validate_dataset(features_df, labels_df):
            print("\n❌ Dataset validation failed. Please review and fix issues.")
            sys.exit(1)
        
        # Save dataset
        dataset_dir = builder.save_dataset(features_df, labels_df, name="initial_training")
        
        print("\n" + "=" * 70)
        print("✅ Training Dataset Built Successfully!")
        print("=" * 70)
        print(f"\nDataset location: {dataset_dir}")
        print(f"Total samples: {len(features_df)}")
        print(f"Total features: {len(features_df.columns)}")
        print("\nNext steps:")
        print("1. Review the dataset in the output directory")
        print("2. Proceed to Task 5: Train the ML model")
        print("3. Run: python3 -m backend.api.ml_classifier.training.train_model")
        
    except Exception as e:
        print(f"\n❌ Error building dataset: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
