"""
Model Training Module

Trains and evaluates ML models for cookie classification.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
from sklearn.model_selection import (
    train_test_split, cross_val_score, StratifiedKFold,
    learning_curve
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix, make_scorer
)
from sklearn.preprocessing import LabelEncoder
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE
import xgboost as xgb
import matplotlib.pyplot as plt

from ..config import CATEGORIES


class ModelTrainer:
    """Trains and evaluates ML models."""
    
    def __init__(self, output_dir: str = "models"):
        """
        Initialize model trainer.
        
        Args:
            output_dir: Directory to save trained models
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(CATEGORIES)
    
    def prepare_data(
        self,
        features_df: pd.DataFrame,
        labels_df: pd.DataFrame,
        test_size: float = 0.15,
        val_size: float = 0.15,
        balance_classes: bool = True,
        random_state: int = 42
    ) -> Tuple:
        """
        Prepare data for training.
        
        Args:
            features_df: Features DataFrame
            labels_df: Labels DataFrame
            test_size: Test set proportion
            val_size: Validation set proportion
            balance_classes: Whether to balance classes using SMOTE
            random_state: Random seed
        
        Returns:
            Tuple of (X_train, X_val, X_test, y_train, y_val, y_test)
        """
        print("=" * 70)
        print("Preparing Data")
        print("=" * 70)
        print()
        
        # Extract features and labels
        X = features_df.values
        y = labels_df['category'].values
        
        # Encode labels
        y_encoded = self.label_encoder.transform(y)
        
        print(f"Total samples: {len(X)}")
        print(f"Features: {X.shape[1]}")
        print(f"Classes: {len(np.unique(y_encoded))}")
        print()
        
        # Split into train+val and test
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y_encoded,
            test_size=test_size,
            stratify=y_encoded,
            random_state=random_state
        )
        
        # Split train+val into train and val
        val_size_adjusted = val_size / (1 - test_size)
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp,
            test_size=val_size_adjusted,
            stratify=y_temp,
            random_state=random_state
        )
        
        print(f"Train set: {len(X_train)} samples ({len(X_train)/len(X)*100:.1f}%)")
        print(f"Val set:   {len(X_val)} samples ({len(X_val)/len(X)*100:.1f}%)")
        print(f"Test set:  {len(X_test)} samples ({len(X_test)/len(X)*100:.1f}%)")
        print()
        
        # Balance classes using SMOTE
        if balance_classes:
            print("⚖️  Balancing classes using SMOTE...")
            smote = SMOTE(random_state=random_state)
            X_train, y_train = smote.fit_resample(X_train, y_train)
            print(f"✅ Balanced train set: {len(X_train)} samples")
            print()
        
        return X_train, X_val, X_test, y_train, y_val, y_test
    
    def cross_validate_model(
        self,
        model,
        X: np.ndarray,
        y: np.ndarray,
        cv_folds: int = 5
    ) -> Dict[str, Any]:
        """
        Perform stratified k-fold cross-validation.

        Args:
            model: Model to validate
            X: Features
            y: Labels
            cv_folds: Number of cross-validation folds

        Returns:
            Dictionary with CV results
        """
        print(f"🔄 Performing {cv_folds}-fold cross-validation...")

        # Create stratified k-fold splitter
        skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)

        # Calculate multiple metrics
        scoring = {
            'accuracy': 'accuracy',
            'precision': make_scorer(precision_score, average='weighted', zero_division=0),
            'recall': make_scorer(recall_score, average='weighted', zero_division=0),
            'f1': make_scorer(f1_score, average='weighted', zero_division=0)
        }

        from sklearn.model_selection import cross_validate
        cv_results = cross_validate(
            model, X, y,
            cv=skf,
            scoring=scoring,
            return_train_score=True,
            n_jobs=-1,
            verbose=0
        )

        # Print results
        print(f"\n📊 Cross-Validation Results ({cv_folds} folds):")
        print(f"  Accuracy:  {cv_results['test_accuracy'].mean():.4f} (+/- {cv_results['test_accuracy'].std():.4f})")
        print(f"  Precision: {cv_results['test_precision'].mean():.4f} (+/- {cv_results['test_precision'].std():.4f})")
        print(f"  Recall:    {cv_results['test_recall'].mean():.4f} (+/- {cv_results['test_recall'].std():.4f})")
        print(f"  F1-Score:  {cv_results['test_f1'].mean():.4f} (+/- {cv_results['test_f1'].std():.4f})")

        # Check for overfitting
        train_acc = cv_results['train_accuracy'].mean()
        test_acc = cv_results['test_accuracy'].mean()
        gap = train_acc - test_acc

        print(f"\n🔍 Overfitting Check:")
        print(f"  Train Accuracy: {train_acc:.4f}")
        print(f"  Test Accuracy:  {test_acc:.4f}")
        print(f"  Gap:            {gap:.4f}")

        if gap > 0.05:
            print(f"  ⚠️  WARNING: Significant train-test gap detected! Model may be overfitting.")
        elif gap > 0.03:
            print(f"  ⚡ CAUTION: Moderate train-test gap. Consider regularization.")
        else:
            print(f"  ✅ Good generalization - minimal overfitting.")

        print()

        return {
            'cv_accuracy_mean': cv_results['test_accuracy'].mean(),
            'cv_accuracy_std': cv_results['test_accuracy'].std(),
            'cv_f1_mean': cv_results['test_f1'].mean(),
            'cv_f1_std': cv_results['test_f1'].std(),
            'train_test_gap': gap,
            'all_scores': cv_results
        }

    def train_random_forest(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        run_cv: bool = True
    ) -> RandomForestClassifier:
        """
        Train baseline Random Forest model with improved regularization.

        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            run_cv: Whether to run cross-validation

        Returns:
            Trained Random Forest model
        """
        print("=" * 70)
        print("Training Random Forest (Baseline)")
        print("=" * 70)
        print()

        # Create model with stronger regularization to prevent overfitting
        model = RandomForestClassifier(
            n_estimators=100,  # Reduced from 200
            max_depth=15,      # Reduced from 20 - PREVENTS OVERFITTING
            min_samples_split=15,  # Increased from 10 - PREVENTS OVERFITTING
            min_samples_leaf=8,    # Increased from 5 - PREVENTS OVERFITTING
            max_features='sqrt',
            max_samples=0.8,       # NEW - Bootstrap sample size
            class_weight='balanced',
            random_state=42,
            n_jobs=-1,
            verbose=1
        )

        # Run cross-validation before final training
        if run_cv:
            cv_results = self.cross_validate_model(model, X_train, y_train, cv_folds=5)

        print("Training final model on full training set...")
        model.fit(X_train, y_train)

        # Evaluate on validation set
        y_val_pred = model.predict(X_val)
        val_accuracy = accuracy_score(y_val, y_val_pred)

        print(f"\n✅ Training complete!")
        print(f"Validation Accuracy: {val_accuracy:.4f}")
        print()

        return model
    
    def train_xgboost(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        run_cv: bool = True
    ) -> xgb.XGBClassifier:
        """
        Train production XGBoost model with cross-validation and regularization.

        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            run_cv: Whether to run cross-validation

        Returns:
            Trained XGBoost model
        """
        print("=" * 70)
        print("Training XGBoost (Production)")
        print("=" * 70)
        print()

        # Create model with enhanced regularization to prevent overfitting
        num_classes = len(np.unique(y_train))
        model = xgb.XGBClassifier(
            objective='multi:softprob',
            num_class=num_classes,
            max_depth=6,           # Reduced from 8 - PREVENTS OVERFITTING
            learning_rate=0.03,    # Reduced from 0.05 - SLOWER LEARNING
            n_estimators=500,      # Increased to compensate for lower LR
            subsample=0.7,         # Reduced from 0.8 - MORE REGULARIZATION
            colsample_bytree=0.7,  # Reduced from 0.8 - MORE REGULARIZATION
            min_child_weight=5,    # Increased from 3 - PREVENTS OVERFITTING
            gamma=0.2,             # Increased from 0.1 - MORE REGULARIZATION
            reg_alpha=0.3,         # Increased from 0.1 - L1 REGULARIZATION
            reg_lambda=2.0,        # Increased from 1.0 - L2 REGULARIZATION
            random_state=42,
            tree_method='hist',
            eval_metric=['mlogloss', 'merror'],
            early_stopping_rounds=30,  # Increased from 20
            verbosity=1
        )

        # Run cross-validation before final training
        if run_cv:
            cv_results = self.cross_validate_model(model, X_train, y_train, cv_folds=5)

        print("Training with early stopping and validation monitoring...")
        model.fit(
            X_train, y_train,
            eval_set=[(X_train, y_train), (X_val, y_val)],
            verbose=True
        )

        # Evaluate on validation set
        y_val_pred = model.predict(X_val)
        val_accuracy = accuracy_score(y_val, y_val_pred)

        # Check training vs validation performance
        y_train_pred = model.predict(X_train)
        train_accuracy = accuracy_score(y_train, y_train_pred)
        gap = train_accuracy - val_accuracy

        print(f"\n✅ Training complete!")
        print(f"Best iteration: {model.best_iteration}")
        print(f"Training Accuracy:   {train_accuracy:.4f}")
        print(f"Validation Accuracy: {val_accuracy:.4f}")
        print(f"Train-Val Gap:       {gap:.4f}")

        if gap > 0.05:
            print(f"⚠️  WARNING: Model may be overfitting (gap > 0.05)")
        elif gap > 0.03:
            print(f"⚡ CAUTION: Slight overfitting detected (gap > 0.03)")
        else:
            print(f"✅ Good generalization!")

        print()

        return model
    
    def calibrate_model(
        self,
        model,
        X_val: np.ndarray,
        y_val: np.ndarray,
        method: str = 'sigmoid'
    ):
        """
        Calibrate model probabilities using Platt scaling or isotonic regression.
        
        Args:
            model: Trained model
            X_val: Validation features
            y_val: Validation labels
            method: 'sigmoid' (Platt scaling) or 'isotonic'
        
        Returns:
            Calibrated model
        """
        print(f"🎯 Calibrating model using {method} method...")
        
        calibrated = CalibratedClassifierCV(
            model,
            method=method,
            cv='prefit'
        )
        
        calibrated.fit(X_val, y_val)
        
        print("✅ Calibration complete")
        return calibrated
    
    def evaluate_model(
        self,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray,
        model_name: str = "Model"
    ) -> Dict[str, Any]:
        """
        Evaluate model performance.
        
        Args:
            model: Trained model
            X_test: Test features
            y_test: Test labels
            model_name: Name for reporting
        
        Returns:
            Dictionary of evaluation metrics
        """
        print("=" * 70)
        print(f"Evaluating {model_name}")
        print("=" * 70)
        print()
        
        # Predictions
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)
        
        # Overall metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        print(f"Overall Metrics:")
        print(f"  Accuracy:  {accuracy:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1-Score:  {f1:.4f}")
        print()
        
        # Per-class metrics
        print("Per-Class Metrics:")
        
        # Get unique labels in test set
        unique_labels = np.unique(y_test)
        target_names = [self.label_encoder.classes_[i] for i in unique_labels]
        
        report = classification_report(
            y_test, y_pred,
            labels=unique_labels,
            target_names=target_names,
            output_dict=True,
            zero_division=0
        )
        
        for category in self.label_encoder.classes_:
            if category in report:
                metrics = report[category]
                print(f"  {category:25s}: P={metrics['precision']:.3f} R={metrics['recall']:.3f} F1={metrics['f1-score']:.3f}")
        print()
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print("Confusion Matrix:")
        print(cm)
        print()
        
        # Confidence calibration check
        confidence_scores = y_proba.max(axis=1)
        avg_confidence = confidence_scores.mean()
        print(f"Average Confidence: {avg_confidence:.4f}")
        print()
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'per_class_metrics': report,
            'confusion_matrix': cm.tolist(),
            'avg_confidence': avg_confidence
        }
    
    def check_dataset_size(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """
        Check if dataset size is sufficient for production ML.

        Args:
            X: Features
            y: Labels

        Returns:
            Dictionary with recommendations
        """
        n_samples = len(X)
        n_features = X.shape[1]
        n_classes = len(np.unique(y))

        # Minimum samples per class
        unique, counts = np.unique(y, return_counts=True)
        min_samples_per_class = counts.min()
        avg_samples_per_class = counts.mean()

        print("=" * 70)
        print("Dataset Size Analysis")
        print("=" * 70)
        print(f"Total samples:              {n_samples}")
        print(f"Number of features:         {n_features}")
        print(f"Number of classes:          {n_classes}")
        print(f"Min samples per class:      {min_samples_per_class}")
        print(f"Avg samples per class:      {avg_samples_per_class:.1f}")
        print()

        # Recommendations
        warnings = []
        recommendations = []

        # Rule of thumb: Need at least 10 * n_features samples
        min_recommended = 10 * n_features
        ideal_recommended = 50 * n_features

        if n_samples < min_recommended:
            warnings.append(f"CRITICAL: Dataset too small! Need at least {min_recommended} samples (10 * features)")
            recommendations.append(f"Collect at least {min_recommended - n_samples} more samples")
        elif n_samples < ideal_recommended:
            warnings.append(f"WARNING: Dataset smaller than ideal. Recommended: {ideal_recommended} samples")
            recommendations.append(f"Consider collecting {ideal_recommended - n_samples} more samples")
        else:
            print(f"✅ Dataset size is adequate for production")

        # Check class balance
        if min_samples_per_class < 50:
            warnings.append(f"WARNING: Some classes have < 50 samples (min: {min_samples_per_class})")
            recommendations.append("Use SMOTE or collect more samples for minority classes")

        if warnings:
            print("⚠️  WARNINGS:")
            for warning in warnings:
                print(f"  - {warning}")
            print()
            print("📋 RECOMMENDATIONS:")
            for rec in recommendations:
                print(f"  - {rec}")
        else:
            print("✅ Dataset size is sufficient for production ML")

        print("=" * 70)
        print()

        return {
            'n_samples': n_samples,
            'n_features': n_features,
            'n_classes': n_classes,
            'min_samples_per_class': int(min_samples_per_class),
            'warnings': warnings,
            'recommendations': recommendations,
            'is_production_ready': len(warnings) == 0 or n_samples >= min_recommended
        }

    def save_model(
        self,
        model,
        feature_names: list,
        metrics: Dict[str, Any],
        version: str,
        model_type: str = "xgboost",
        cv_results: Optional[Dict[str, Any]] = None
    ) -> Path:
        """
        Save trained model with metadata.
        
        Args:
            model: Trained model
            feature_names: List of feature names
            metrics: Evaluation metrics
            version: Model version (e.g., "1.0.0")
            model_type: Type of model
        
        Returns:
            Path to saved model directory
        """
        model_dir = self.output_dir / f"v{version}"
        model_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"💾 Saving model to {model_dir}...")
        
        # Save model
        model_path = model_dir / "model.pkl"
        joblib.dump(model, model_path)
        
        # Save label encoder
        encoder_path = model_dir / "label_encoder.pkl"
        joblib.dump(self.label_encoder, encoder_path)
        
        # Save feature names
        features_path = model_dir / "features.json"
        with open(features_path, 'w') as f:
            json.dump(feature_names, f, indent=2)
        
        # Save metadata with CV results
        metadata = {
            'version': version,
            'model_type': model_type,
            'trained_at': datetime.now().isoformat(),
            'num_features': len(feature_names),
            'categories': list(self.label_encoder.classes_),
            'metrics': metrics,
            'cross_validation': cv_results if cv_results else None
        }
        
        metadata_path = model_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✅ Model saved:")
        print(f"  - model.pkl")
        print(f"  - label_encoder.pkl")
        print(f"  - features.json")
        print(f"  - metadata.json")
        print()
        
        return model_dir
    
    def compare_models(
        self,
        models: Dict[str, Any],
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> str:
        """
        Compare multiple models and select the best.
        
        Args:
            models: Dictionary of {name: model}
            X_test: Test features
            y_test: Test labels
        
        Returns:
            Name of best model
        """
        print("=" * 70)
        print("Model Comparison")
        print("=" * 70)
        print()
        
        results = {}
        
        for name, model in models.items():
            metrics = self.evaluate_model(model, X_test, y_test, name)
            results[name] = metrics
        
        # Compare by F1-score
        print("Comparison Summary:")
        print(f"{'Model':<20} {'Accuracy':<12} {'F1-Score':<12} {'Avg Confidence':<15}")
        print("-" * 70)
        
        best_model = None
        best_f1 = 0
        
        for name, metrics in results.items():
            print(f"{name:<20} {metrics['accuracy']:<12.4f} {metrics['f1_score']:<12.4f} {metrics['avg_confidence']:<15.4f}")
            
            if metrics['f1_score'] > best_f1:
                best_f1 = metrics['f1_score']
                best_model = name
        
        print()
        print(f"🏆 Best Model: {best_model} (F1={best_f1:.4f})")
        print()
        
        return best_model
