# ML Model Training

## Overview

This directory contains scripts and utilities for training the cookie classification ML model.

## Files

### Dataset Building
- **`dataset_builder.py`** - DatasetBuilder class for creating training datasets
- **`build_dataset.py`** - Script to build initial training dataset
- **`label_cookies.py`** - Interactive tool for manually labeling cookies

### Model Training (Task 5)
- **`train_model.py`** - Script to train ML models (coming next)
- **`model_evaluator.py`** - Model evaluation utilities (coming next)

## Usage

### 1. Build Training Dataset

```bash
cd cookie-scanner
python3 -m backend.api.ml_classifier.training.build_dataset
```

This will:
- Export labeled cookies from database (if any)
- Load common cookies dataset (31 pre-labeled cookies)
- Create synthetic variations for data augmentation
- Extract features using FeatureExtractor
- Save dataset to `models/training_data/`

**Output:**
- `features.csv` - Feature matrix
- `labels.csv` - Labels and metadata
- `features.parquet` - Efficient binary format
- `labels.parquet` - Efficient binary format
- `metadata.json` - Dataset information

### 2. Manual Labeling (Optional)

To add more labeled data:

```bash
python3 -m backend.api.ml_classifier.training.label_cookies
```

This interactive tool will:
- Fetch unlabeled cookies from database
- Present them one by one
- Allow you to assign categories
- Save labels to `manual_labels.json`
- Export to dataset format

### 3. Train Model (Task 5)

```bash
python3 -m backend.api.ml_classifier.training.train_model
```

## Dataset Structure

### Features (33 total)

**Name Features (5)**
- name_length, name_has_underscore, name_has_uuid, name_has_digits, name_special_char_count

**Domain Features (5)**
- domain_is_first_party, domain_is_subdomain, domain_length, domain_has_hyphen, domain_level_count

**Expiry Features (3)**
- expiry_days, expiry_is_session, expiry_category_encoded

**Security Features (3)**
- http_only, secure, same_site_encoded

**Path Features (2)**
- path_is_root, path_length

**Value Features (3)**
- value_length, value_has_uuid, value_has_base64

**Vendor Features (3)**
- vendor_detected, vendor_confidence, vendor_category_encoded

**Script Features (2)**
- script_is_third_party, script_domain_length

**Pattern Features (5)**
- pattern_google_analytics, pattern_facebook, pattern_advertising, pattern_tracking, pattern_functional

**Historical Features (2)**
- has_historical_data, historical_correction_count

### Labels

Categories:
- **Strictly Necessary** - Essential for website functionality
- **Analytics** - Used for analytics and performance tracking
- **Marketing** - Used for advertising and marketing
- **Functional** - Enable enhanced functionality
- **Unknown** - Cannot be classified

## Initial Dataset Stats

**Current Dataset (initial_training_20251124_182830):**
- Total samples: 331
- Features: 33
- Categories: 4

**Distribution:**
- Analytics: 132 samples (40%)
- Marketing: 107 samples (32%)
- Strictly Necessary: 52 samples (16%)
- Functional: 40 samples (12%)

**Note:** Some categories have fewer than 100 samples. Consider:
1. Running manual labeling tool to add more samples
2. Creating more synthetic variations
3. Importing from external cookie databases

## Data Augmentation

The dataset builder creates synthetic variations by:
- Adding random suffixes to cookie names
- Varying expiry times (±20%)
- Randomizing security flags
- Randomizing SameSite values

This helps the model generalize better and prevents overfitting.

## Next Steps

1. ✅ Build initial dataset (Task 4)
2. ⏭️ Train baseline model (Task 5)
3. ⏭️ Train production model (Task 5)
4. ⏭️ Evaluate and compare models (Task 5)
5. ⏭️ Deploy best model (Task 5)
