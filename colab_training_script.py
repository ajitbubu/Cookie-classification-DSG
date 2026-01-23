# Cookie Classification Model Training - Direct Upload
# Copy each cell to Google Colab

# ==============================================================================
# CELL 1: Upload Files
# ==============================================================================

from google.colab import files
import os

print("📤 Upload your CSV files")
print("Select BOTH files when prompted:")
print("  - cookie_training_100k_train_80.csv")
print("  - cookie_training_100k_test_20.csv")
print()

uploaded = files.upload()

# Verify uploads
if 'cookie_training_100k_train_80.csv' in uploaded and 'cookie_training_100k_test_20.csv' in uploaded:
    DATA_DIR = '/content'
    print(f"\n✅ Files uploaded successfully!")
    print(f"✅ Training file: {len(uploaded['cookie_training_100k_train_80.csv']):,} bytes")
    print(f"✅ Test file: {len(uploaded['cookie_training_100k_test_20.csv']):,} bytes")
    print("\n🎉 Ready to train!")
else:
    print("\n❌ Missing files! Please upload both CSV files.")


# ==============================================================================
# CELL 2: Install Dependencies
# ==============================================================================

!pip install -q scikit-learn xgboost imbalanced-learn pandas numpy matplotlib seaborn

print("✅ All dependencies installed!")


# ==============================================================================
# CELL 3: Import Libraries
# ==============================================================================

import pandas as pd
import numpy as np
import joblib
import json
from datetime import datetime
from pathlib import Path

from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)
from imblearn.over_sampling import SMOTE
import xgboost as xgb
import matplotlib.pyplot as plt
import seaborn as sns

print("✅ Libraries imported successfully!")


# ==============================================================================
# CELL 4: Load and Explore Data
# ==============================================================================

# Load training and test data
train_df = pd.read_csv(f"{DATA_DIR}/cookie_training_100k_train_80.csv")
test_df = pd.read_csv(f"{DATA_DIR}/cookie_training_100k_test_20.csv")

print("📊 Dataset Loaded!")
print(f"Training samples: {len(train_df):,}")
print(f"Test samples: {len(test_df):,}")
print(f"Total samples: {len(train_df) + len(test_df):,}")
print()

# Display first few rows
print("Sample data:")
train_df.head()


# ==============================================================================
# CELL 5: Data Info and Visualization
# ==============================================================================

# Check data info
print("Dataset Info:")
print(train_df.info())
print()

# Check for missing values
print("Missing values:")
print(train_df.isnull().sum())
print()

# Check class distribution
print("Class distribution:")
print(train_df['label_category'].value_counts())
print()

# Visualize class distribution
plt.figure(figsize=(10, 6))
train_df['label_category'].value_counts().plot(kind='bar')
plt.title('Cookie Category Distribution')
plt.xlabel('Category')
plt.ylabel('Count')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()


# ==============================================================================
# CELL 6: Prepare Features and Labels
# ==============================================================================

# Define feature columns
feature_columns = [
    'expiry_days', 'secure', 'http_only', 'is_third_party',
    'cookie_name_len', 'is_ga_like', 'is_fb_like', 
    'has_prefix_utm', 'has_consent_kw', 'has_session_kw'
]

# Convert boolean columns to integers
bool_columns = ['secure', 'http_only', 'is_third_party', 'is_ga_like', 
                'is_fb_like', 'has_prefix_utm', 'has_consent_kw', 'has_session_kw']

for col in bool_columns:
    train_df[col] = train_df[col].astype(int)
    test_df[col] = test_df[col].astype(int)

# Extract features and labels
X_train = train_df[feature_columns].values
y_train = train_df['label_category'].values

X_test = test_df[feature_columns].values
y_test = test_df['label_category'].values

print(f"✅ Features prepared!")
print(f"Training features shape: {X_train.shape}")
print(f"Test features shape: {X_test.shape}")
print(f"Feature columns: {feature_columns}")


# ==============================================================================
# CELL 7: Encode Labels
# ==============================================================================

# Create label encoder
label_encoder = LabelEncoder()
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)

print("✅ Labels encoded!")
print(f"Categories: {list(label_encoder.classes_)}")
print(f"Number of classes: {len(label_encoder.classes_)}")


# ==============================================================================
# CELL 8: Create Validation Split
# ==============================================================================

# Split training data into train and validation
X_train_split, X_val, y_train_split, y_val = train_test_split(
    X_train, y_train_encoded,
    test_size=0.15,
    stratify=y_train_encoded,
    random_state=42
)

print("📊 Data Split:")
print(f"Training: {len(X_train_split):,} samples ({len(X_train_split)/(len(X_train_split)+len(X_val)+len(X_test))*100:.1f}%)")
print(f"Validation: {len(X_val):,} samples ({len(X_val)/(len(X_train_split)+len(X_val)+len(X_test))*100:.1f}%)")
print(f"Test: {len(X_test):,} samples ({len(X_test)/(len(X_train_split)+len(X_val)+len(X_test))*100:.1f}%)")


# ==============================================================================
# CELL 9: Balance Classes with SMOTE
# ==============================================================================

# Apply SMOTE to balance classes
print("⚖️  Balancing classes using SMOTE...")
smote = SMOTE(random_state=42)
X_train_balanced, y_train_balanced = smote.fit_resample(X_train_split, y_train_split)

print(f"✅ Balanced training set: {len(X_train_balanced):,} samples")
print(f"Original: {len(X_train_split):,} → Balanced: {len(X_train_balanced):,}")

# Show class distribution after SMOTE
unique, counts = np.unique(y_train_balanced, return_counts=True)
print("\nClass distribution after SMOTE:")
for label, count in zip(unique, counts):
    category = label_encoder.classes_[label]
    print(f"  {category}: {count:,}")


# ==============================================================================
# CELL 10: Train Random Forest Model
# ==============================================================================

print("="*70)
print("Training Random Forest (Baseline)")
print("="*70)

# Create Random Forest model
rf_model = RandomForestClassifier(
    n_estimators=100,
    max_depth=15,
    min_samples_split=15,
    min_samples_leaf=8,
    max_features='sqrt',
    max_samples=0.8,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1,
    verbose=1
)

# Train model
print("\nTraining Random Forest...")
rf_model.fit(X_train_balanced, y_train_balanced)

# Evaluate on validation set
y_val_pred_rf = rf_model.predict(X_val)
val_accuracy_rf = accuracy_score(y_val, y_val_pred_rf)

print(f"\n✅ Random Forest Training Complete!")
print(f"Validation Accuracy: {val_accuracy_rf:.4f}")


# ==============================================================================
# CELL 11: Train XGBoost Model
# ==============================================================================

print("="*70)
print("Training XGBoost (Production)")
print("="*70)

# Create XGBoost model
num_classes = len(label_encoder.classes_)
xgb_model = xgb.XGBClassifier(
    objective='multi:softprob',
    num_class=num_classes,
    max_depth=6,
    learning_rate=0.03,
    n_estimators=500,
    subsample=0.7,
    colsample_bytree=0.7,
    min_child_weight=5,
    gamma=0.2,
    reg_alpha=0.3,
    reg_lambda=2.0,
    random_state=42,
    tree_method='hist',
    eval_metric=['mlogloss', 'merror'],
    early_stopping_rounds=30
)

# Train with early stopping
print("\nTraining XGBoost with early stopping...")
xgb_model.fit(
    X_train_balanced, y_train_balanced,
    eval_set=[(X_train_balanced, y_train_balanced), (X_val, y_val)],
    verbose=True
)

# Evaluate on validation set
y_val_pred_xgb = xgb_model.predict(X_val)
val_accuracy_xgb = accuracy_score(y_val, y_val_pred_xgb)

print(f"\n✅ XGBoost Training Complete!")
print(f"Best iteration: {xgb_model.best_iteration}")
print(f"Validation Accuracy: {val_accuracy_xgb:.4f}")



# ==============================================================================
# CELL 12: Evaluate Both Models
# ==============================================================================

def evaluate_model(model, X_test, y_test, model_name):
    """Evaluate model and print metrics."""
    print("="*70)
    print(f"Evaluating {model_name}")
    print("="*70)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    
    # Overall metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    print(f"\nOverall Metrics:")
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1-Score:  {f1:.4f}")
    
    # Classification report
    print(f"\nPer-Class Metrics:")
    print(classification_report(y_test, y_pred, target_names=label_encoder.classes_, zero_division=0))
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=label_encoder.classes_, 
                yticklabels=label_encoder.classes_)
    plt.title(f'Confusion Matrix - {model_name}')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.show()
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1
    }

# Evaluate Random Forest
rf_metrics = evaluate_model(rf_model, y_test_encoded, y_test_encoded, "Random Forest")

# Evaluate XGBoost
xgb_metrics = evaluate_model(xgb_model, y_test_encoded, y_test_encoded, "XGBoost")


# ==============================================================================
# CELL 13: Compare Models
# ==============================================================================

print("="*70)
print("Model Comparison")
print("="*70)
print()

comparison_df = pd.DataFrame({
    'Model': ['Random Forest', 'XGBoost'],
    'Accuracy': [rf_metrics['accuracy'], xgb_metrics['accuracy']],
    'Precision': [rf_metrics['precision'], xgb_metrics['precision']],
    'Recall': [rf_metrics['recall'], xgb_metrics['recall']],
    'F1-Score': [rf_metrics['f1_score'], xgb_metrics['f1_score']]
})

print(comparison_df.to_string(index=False))
print()

# Select best model
if xgb_metrics['f1_score'] > rf_metrics['f1_score']:
    best_model = xgb_model
    best_model_name = 'XGBoost'
    best_model_type = 'xgboost'
    best_metrics = xgb_metrics
else:
    best_model = rf_model
    best_model_name = 'Random Forest'
    best_model_type = 'random_forest'
    best_metrics = rf_metrics

print(f"🏆 Best Model: {best_model_name}")
print(f"   F1-Score: {best_metrics['f1_score']:.4f}")

# Visualize comparison
comparison_df.set_index('Model').plot(kind='bar', figsize=(10, 6))
plt.title('Model Performance Comparison')
plt.ylabel('Score')
plt.ylim(0, 1)
plt.legend(loc='lower right')
plt.xticks(rotation=0)
plt.tight_layout()
plt.show()


# ==============================================================================
# CELL 14: Save Models
# ==============================================================================

# Create output directory
output_dir = Path('/content/trained_models')
output_dir.mkdir(exist_ok=True)

model_version = '2.0.0'
model_dir = output_dir / f'v{model_version}'
model_dir.mkdir(exist_ok=True)

print(f"💾 Saving models to {model_dir}...")

# Save best model
joblib.dump(best_model, model_dir / 'model.pkl')
print("  ✅ model.pkl saved")

# Save label encoder
joblib.dump(label_encoder, model_dir / 'label_encoder.pkl')
print("  ✅ label_encoder.pkl saved")

# Save feature names
with open(model_dir / 'features.json', 'w') as f:
    json.dump(feature_columns, f, indent=2)
print("  ✅ features.json saved")

# Save metadata
metadata = {
    'version': model_version,
    'model_type': best_model_type,
    'trained_at': datetime.now().isoformat(),
    'num_features': len(feature_columns),
    'categories': list(label_encoder.classes_),
    'training_samples': len(X_train),
    'test_samples': len(X_test),
    'metrics': best_metrics
}

with open(model_dir / 'metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("  ✅ metadata.json saved")

print(f"\n✅ All files saved to {model_dir}")


# ==============================================================================
# CELL 15: Download Trained Model
# ==============================================================================

# Create zip file
import shutil

zip_filename = f'trained_model_v{model_version}'
shutil.make_archive(f'/content/{zip_filename}', 'zip', output_dir)

print(f"📦 Created {zip_filename}.zip")

# Download the zip file
from google.colab import files
files.download(f'/content/{zip_filename}.zip')

print("\n✅ Download started! Check your browser's download folder.")
print("\nNext steps:")
print("1. Extract the zip file")
print("2. Copy the v2.0.0 folder to your project's models/ directory")
print("3. Test the model with your application")


# ==============================================================================
# CELL 16: Test Model with Sample Predictions
# ==============================================================================

# Test with a few random samples
n_samples = 5
random_indices = np.random.choice(len(X_test), n_samples, replace=False)

print("🧪 Testing model with random samples:")
print("="*70)

for idx in random_indices:
    sample = X_test[idx:idx+1]
    true_label = label_encoder.classes_[y_test_encoded[idx]]
    
    # Predict
    pred_label_idx = best_model.predict(sample)[0]
    pred_label = label_encoder.classes_[pred_label_idx]
    
    # Get probabilities
    proba = best_model.predict_proba(sample)[0]
    confidence = proba[pred_label_idx]
    
    # Get original cookie data
    cookie_data = test_df.iloc[idx]
    
    print(f"\nCookie: {cookie_data['cookie_name']}")
    print(f"  Domain: {cookie_data['cookie_domain']}")
    print(f"  True Category: {true_label}")
    print(f"  Predicted: {pred_label} (confidence: {confidence:.2%})")
    print(f"  ✅ Correct" if pred_label == true_label else f"  ❌ Incorrect")

print("\n" + "="*70)
print("\n🎉 Training Complete!")
print(f"Best Model: {best_model_name}")
print(f"Accuracy: {best_metrics['accuracy']:.2%}")
print(f"F1-Score: {best_metrics['f1_score']:.2%}")
