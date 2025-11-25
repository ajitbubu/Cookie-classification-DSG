"""
Training Dataset Builder

Creates and manages training datasets for ML model training.
"""

import os
import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

from ..feature_extractor import FeatureExtractor
from ..config import CATEGORIES


class DatasetBuilder:
    """Builds training datasets from labeled cookie data."""
    
    def __init__(self, db_config: Dict[str, Any], output_dir: str = "training_data"):
        """
        Initialize dataset builder.
        
        Args:
            db_config: Database configuration
            output_dir: Directory to save training data
        """
        self.db_config = db_config
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.feature_extractor = FeatureExtractor()
    
    def export_cookies_from_database(self, limit: Optional[int] = None) -> pd.DataFrame:
        """
        Export cookies from database.
        
        Args:
            limit: Maximum number of cookies to export (None for all)
        
        Returns:
            DataFrame with cookie data
        """
        print("📊 Exporting cookies from database...")
        
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Query cookies with categories
            query = """
                SELECT 
                    c.id,
                    c.name,
                    c.domain,
                    c.value,
                    c.category,
                    c.type,
                    c.requires_consent,
                    c.is_third_party,
                    c.size,
                    c.scan_id,
                    c.created_at
                FROM cookies c
                WHERE c.category IS NOT NULL
                AND c.category != ''
                ORDER BY c.created_at DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            if not rows:
                print("⚠️  No labeled cookies found in database")
                return pd.DataFrame()
            
            df = pd.DataFrame([dict(row) for row in rows])
            print(f"✅ Exported {len(df)} cookies")
            
            return df
            
        finally:
            cursor.close()
            conn.close()
    
    def load_common_cookies_dataset(self) -> List[Dict[str, Any]]:
        """
        Load dataset of common cookies with known categories.
        
        Returns:
            List of cookie dictionaries with labels
        """
        print("📚 Loading common cookies dataset...")
        
        # Common cookies dataset (manually curated)
        common_cookies = [
            # Google Analytics
            {'name': '_ga', 'domain': 'google-analytics.com', 'category': 'Analytics', 'expiry_days': 730},
            {'name': '_gid', 'domain': 'google-analytics.com', 'category': 'Analytics', 'expiry_days': 1},
            {'name': '_gat', 'domain': 'google-analytics.com', 'category': 'Analytics', 'expiry_days': 1},
            {'name': '_gat_gtag_UA', 'domain': 'google-analytics.com', 'category': 'Analytics', 'expiry_days': 1},
            {'name': '_ga_container', 'domain': 'googletagmanager.com', 'category': 'Analytics', 'expiry_days': 730},
            
            # Facebook
            {'name': '_fbp', 'domain': 'facebook.com', 'category': 'Marketing', 'expiry_days': 90},
            {'name': '_fbc', 'domain': 'facebook.com', 'category': 'Marketing', 'expiry_days': 90},
            {'name': 'fr', 'domain': 'facebook.com', 'category': 'Marketing', 'expiry_days': 90},
            {'name': 'sb', 'domain': 'facebook.com', 'category': 'Marketing', 'expiry_days': 730},
            {'name': 'datr', 'domain': 'facebook.com', 'category': 'Marketing', 'expiry_days': 730},
            
            # LinkedIn
            {'name': 'li_sugr', 'domain': 'linkedin.com', 'category': 'Analytics', 'expiry_days': 90},
            {'name': 'AnalyticsSyncHistory', 'domain': 'linkedin.com', 'category': 'Analytics', 'expiry_days': 30},
            {'name': 'lms_analytics', 'domain': 'linkedin.com', 'category': 'Analytics', 'expiry_days': 30},
            {'name': 'UserMatchHistory', 'domain': 'linkedin.com', 'category': 'Analytics', 'expiry_days': 30},
            
            # Microsoft/Bing
            {'name': '_uetsid', 'domain': 'bing.com', 'category': 'Analytics', 'expiry_days': 1},
            {'name': '_uetvid', 'domain': 'bing.com', 'category': 'Analytics', 'expiry_days': 390},
            {'name': 'MUID', 'domain': 'microsoft.com', 'category': 'Analytics', 'expiry_days': 390},
            
            # Twitter
            {'name': 'personalization_id', 'domain': 'twitter.com', 'category': 'Marketing', 'expiry_days': 730},
            {'name': 'guest_id', 'domain': 'twitter.com', 'category': 'Marketing', 'expiry_days': 730},
            
            # Functional/Necessary
            {'name': 'PHPSESSID', 'domain': 'example.com', 'category': 'Strictly Necessary', 'expiry_days': None},
            {'name': 'session_id', 'domain': 'example.com', 'category': 'Strictly Necessary', 'expiry_days': None},
            {'name': 'JSESSIONID', 'domain': 'example.com', 'category': 'Strictly Necessary', 'expiry_days': None},
            {'name': 'csrf_token', 'domain': 'example.com', 'category': 'Strictly Necessary', 'expiry_days': None},
            {'name': 'auth_token', 'domain': 'example.com', 'category': 'Strictly Necessary', 'expiry_days': 1},
            
            # Functional
            {'name': 'language', 'domain': 'example.com', 'category': 'Functional', 'expiry_days': 365},
            {'name': 'currency', 'domain': 'example.com', 'category': 'Functional', 'expiry_days': 365},
            {'name': 'timezone', 'domain': 'example.com', 'category': 'Functional', 'expiry_days': 365},
            {'name': 'theme', 'domain': 'example.com', 'category': 'Functional', 'expiry_days': 365},
            
            # Advertising
            {'name': 'IDE', 'domain': 'doubleclick.net', 'category': 'Marketing', 'expiry_days': 390},
            {'name': 'test_cookie', 'domain': 'doubleclick.net', 'category': 'Marketing', 'expiry_days': 1},
            {'name': 'NID', 'domain': 'google.com', 'category': 'Marketing', 'expiry_days': 180},
        ]
        
        print(f"✅ Loaded {len(common_cookies)} common cookies")
        return common_cookies
    
    def create_synthetic_variations(self, base_cookies: List[Dict], count: int = 100) -> List[Dict]:
        """
        Create synthetic variations of base cookies for data augmentation.
        
        Args:
            base_cookies: Base cookie templates
            count: Number of variations to create
        
        Returns:
            List of synthetic cookies
        """
        print(f"🔄 Creating {count} synthetic variations...")
        
        synthetic = []
        
        for i in range(count):
            # Pick random base cookie
            base = base_cookies[i % len(base_cookies)].copy()
            
            # Add variations
            if np.random.random() > 0.5:
                # Add random suffix
                base['name'] = f"{base['name']}_{np.random.randint(1000, 9999)}"
            
            if np.random.random() > 0.5:
                # Vary expiry slightly
                if base.get('expiry_days'):
                    variation = int(base['expiry_days'] * np.random.uniform(0.8, 1.2))
                    base['expiry_days'] = variation
            
            # Add security flags randomly
            base['http_only'] = bool(np.random.random() > 0.5)
            base['secure'] = bool(np.random.random() > 0.3)
            base['same_site'] = np.random.choice(['None', 'Lax', 'Strict', None])
            
            synthetic.append(base)
        
        print(f"✅ Created {len(synthetic)} synthetic cookies")
        return synthetic
    
    def build_training_dataset(
        self,
        include_db_cookies: bool = True,
        include_common_cookies: bool = True,
        synthetic_count: int = 200,
        min_samples_per_category: int = 100
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Build complete training dataset.
        
        Args:
            include_db_cookies: Include cookies from database
            include_common_cookies: Include common cookies dataset
            synthetic_count: Number of synthetic variations to create
            min_samples_per_category: Minimum samples per category
        
        Returns:
            Tuple of (features_df, labels_df)
        """
        print("=" * 70)
        print("Building Training Dataset")
        print("=" * 70)
        print()
        
        all_cookies = []
        
        # Load from database
        if include_db_cookies:
            db_df = self.export_cookies_from_database()
            if not db_df.empty:
                db_cookies = db_df.to_dict('records')
                all_cookies.extend(db_cookies)
        
        # Load common cookies
        if include_common_cookies:
            common = self.load_common_cookies_dataset()
            all_cookies.extend(common)
        
        # Create synthetic variations
        if synthetic_count > 0 and all_cookies:
            synthetic = self.create_synthetic_variations(all_cookies, synthetic_count)
            all_cookies.extend(synthetic)
        
        if not all_cookies:
            raise ValueError("No cookies available for training dataset")
        
        print(f"\n📊 Total cookies collected: {len(all_cookies)}")
        
        # Extract features
        print("\n🔧 Extracting features...")
        features_list = []
        labels_list = []
        valid_cookies = []
        
        for cookie in all_cookies:
            try:
                # Ensure required fields
                if 'name' not in cookie or 'domain' not in cookie:
                    continue
                
                if 'category' not in cookie or not cookie['category']:
                    continue
                
                # Extract features
                features = self.feature_extractor.extract_features(cookie)
                features_list.append(features)
                labels_list.append(cookie['category'])
                valid_cookies.append(cookie)
                
            except Exception as e:
                print(f"⚠️  Skipping cookie {cookie.get('name', 'unknown')}: {e}")
                continue
        
        print(f"✅ Extracted features for {len(features_list)} cookies")
        
        # Create DataFrames
        feature_names = self.feature_extractor.get_feature_names()
        features_df = pd.DataFrame(features_list, columns=feature_names)
        labels_df = pd.DataFrame({
            'category': labels_list,
            'cookie_name': [c['name'] for c in valid_cookies],
            'cookie_domain': [c['domain'] for c in valid_cookies]
        })
        
        # Show category distribution
        print("\n📈 Category Distribution:")
        category_counts = labels_df['category'].value_counts()
        for category, count in category_counts.items():
            print(f"  {category:25s}: {count:4d} samples")
        
        # Check minimum samples
        print(f"\n✅ Minimum samples per category: {min_samples_per_category}")
        insufficient = category_counts[category_counts < min_samples_per_category]
        if not insufficient.empty:
            print(f"⚠️  Categories with insufficient samples:")
            for category, count in insufficient.items():
                print(f"  {category}: {count} (need {min_samples_per_category})")
        
        return features_df, labels_df
    
    def save_dataset(
        self,
        features_df: pd.DataFrame,
        labels_df: pd.DataFrame,
        name: str = "training_dataset"
    ):
        """
        Save dataset to disk.
        
        Args:
            features_df: Features DataFrame
            labels_df: Labels DataFrame
            name: Dataset name
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dataset_dir = self.output_dir / f"{name}_{timestamp}"
        dataset_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n💾 Saving dataset to {dataset_dir}...")
        
        # Save as CSV
        features_df.to_csv(dataset_dir / "features.csv", index=False)
        labels_df.to_csv(dataset_dir / "labels.csv", index=False)
        
        # Save as Parquet (more efficient)
        features_df.to_parquet(dataset_dir / "features.parquet", index=False)
        labels_df.to_parquet(dataset_dir / "labels.parquet", index=False)
        
        # Save metadata
        metadata = {
            'created_at': timestamp,
            'num_samples': len(features_df),
            'num_features': len(features_df.columns),
            'feature_names': list(features_df.columns),
            'categories': list(labels_df['category'].unique()),
            'category_distribution': labels_df['category'].value_counts().to_dict()
        }
        
        with open(dataset_dir / "metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✅ Dataset saved:")
        print(f"  - features.csv ({len(features_df)} rows, {len(features_df.columns)} columns)")
        print(f"  - labels.csv ({len(labels_df)} rows)")
        print(f"  - features.parquet")
        print(f"  - labels.parquet")
        print(f"  - metadata.json")
        
        return dataset_dir
    
    def load_dataset(self, dataset_dir: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Load dataset from disk.
        
        Args:
            dataset_dir: Directory containing dataset files
        
        Returns:
            Tuple of (features_df, labels_df)
        """
        dataset_path = Path(dataset_dir)
        
        print(f"📂 Loading dataset from {dataset_path}...")
        
        # Try Parquet first (faster), fall back to CSV
        if (dataset_path / "features.parquet").exists():
            features_df = pd.read_parquet(dataset_path / "features.parquet")
            labels_df = pd.read_parquet(dataset_path / "labels.parquet")
        else:
            features_df = pd.read_csv(dataset_path / "features.csv")
            labels_df = pd.read_csv(dataset_path / "labels.csv")
        
        print(f"✅ Loaded {len(features_df)} samples with {len(features_df.columns)} features")
        
        return features_df, labels_df
    
    def validate_dataset(self, features_df: pd.DataFrame, labels_df: pd.DataFrame) -> bool:
        """
        Validate dataset quality.
        
        Args:
            features_df: Features DataFrame
            labels_df: Labels DataFrame
        
        Returns:
            True if dataset is valid
        """
        print("\n🔍 Validating dataset...")
        
        issues = []
        
        # Check shapes match
        if len(features_df) != len(labels_df):
            issues.append(f"Shape mismatch: {len(features_df)} features vs {len(labels_df)} labels")
        
        # Check for missing values
        missing_features = features_df.isnull().sum().sum()
        if missing_features > 0:
            issues.append(f"Missing values in features: {missing_features}")
        
        missing_labels = labels_df['category'].isnull().sum()
        if missing_labels > 0:
            issues.append(f"Missing labels: {missing_labels}")
        
        # Check for invalid categories
        valid_categories = set(CATEGORIES)
        invalid = set(labels_df['category'].unique()) - valid_categories
        if invalid:
            issues.append(f"Invalid categories: {invalid}")
        
        # Check for duplicates
        duplicates = features_df.duplicated().sum()
        if duplicates > 0:
            print(f"⚠️  Found {duplicates} duplicate samples")
        
        # Report issues
        if issues:
            print("❌ Dataset validation failed:")
            for issue in issues:
                print(f"  - {issue}")
            return False
        
        print("✅ Dataset validation passed")
        return True
