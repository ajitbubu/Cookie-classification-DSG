# Google Colab Training Guide for Cookie Classification Model

Complete step-by-step guide to train your cookie classification ML model on Google Colab with free GPU/TPU access.

## Prerequisites

- Google account (for Colab access)
- Training dataset (already built locally)
- Basic familiarity with Jupyter notebooks

## Why Use Google Colab?

- **Free GPU/TPU**: Faster training than local CPU
- **No Setup**: Pre-installed ML libraries
- **Cloud Storage**: Easy to share and download models
- **Persistence**: Can run even if you close your browser

---

## Step-by-Step Instructions

### Step 1: Prepare Files for Upload

First, create a zip file with all necessary training files:

```bash
cd /Users/ajitsahu/Project/UCM/DCS-redisgn/cookie-scanner

# Create a training package
python3 scripts/package_for_colab.py
```

This will create `colab_training_package.zip` containing:
- Training dataset (latest)
- Feature extractor
- Model trainer
- Configuration files
- Training script

**Alternative Manual Packaging:**
```bash
# Create package directory
mkdir -p colab_package
cd colab_package

# Copy training code
cp -r ../backend/api/ml_classifier .

# Copy latest dataset
cp -r ../models/training_data/initial_training_* dataset/

# Create zip
cd ..
zip -r colab_training_package.zip colab_package/
```

### Step 2: Upload to Google Drive

1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder: `Cookie_ML_Training`
3. Upload `colab_training_package.zip` to this folder
4. Upload the Colab notebook: `Cookie_Model_Training.ipynb`

### Step 3: Open Notebook in Colab

1. In Google Drive, right-click on `Cookie_Model_Training.ipynb`
2. Select **Open with** > **Google Colaboratory**
3. If you don't see Colab, click **Connect more apps** and search for "Colaboratory"

### Step 4: Enable GPU (Optional but Recommended)

1. In Colab, click **Runtime** > **Change runtime type**
2. Select **Hardware accelerator**: `GPU` or `T4 GPU`
3. Click **Save**
4. Click **Runtime** > **Run all** to start training

### Step 5: Run Training Cells

The notebook has the following sections:

#### Cell 1: Mount Google Drive
```python
from google.colab import drive
drive.mount('/content/drive')
```
- Click the link and authorize access
- Copy the authorization code

#### Cell 2: Install Dependencies
```python
!pip install scikit-learn xgboost imbalanced-learn pandas numpy
```

#### Cell 3: Extract Training Package
```python
!unzip /content/drive/MyDrive/Cookie_ML_Training/colab_training_package.zip
```

#### Cell 4: Train Model
```python
!python3 train_model.py --model-type both --version 2.0.0
```

#### Cell 5: Download Trained Model
```python
from google.colab import files
!zip -r trained_model_v2.0.0.zip models/v2.0.0/
files.download('trained_model_v2.0.0.zip')
```

### Step 6: Monitor Training Progress

Watch for these outputs:

**Dataset Loading:**
```
📂 Using latest dataset: initial_training_20251127_125314
✅ Loaded dataset: 331 samples, 33 features
```

**Data Preparation:**
```
📊 Dataset split:
  Training: 231 samples (70%)
  Validation: 50 samples (15%)
  Test: 50 samples (15%)

⚖️ Applying SMOTE to balance classes...
✅ Balanced dataset: 528 training samples
```

**Random Forest Training:**
```
🌲 Training Random Forest...
  Estimators: 100
  Max depth: 20
  Cross-validation accuracy: 0.9456 ± 0.0234
✅ Random Forest trained
```

**XGBoost Training:**
```
🚀 Training XGBoost...
  Max depth: 6
  Learning rate: 0.1
  Cross-validation accuracy: 0.9512 ± 0.0198
✅ XGBoost trained
```

**Model Comparison:**
```
======================================================================
Model Comparison
======================================================================

Random Forest:
  Accuracy:  0.9400
  Precision: 0.9423
  Recall:    0.9400
  F1-Score:  0.9389

XGBoost:
  Accuracy:  0.9600
  Precision: 0.9634
  Recall:    0.9600
  F1-Score:  0.9595

🏆 Best Model: XGBoost
```

### Step 7: Download Trained Model

After training completes, the model will be automatically downloaded as `trained_model_v2.0.0.zip`.

Extract it locally:
```bash
unzip trained_model_v2.0.0.zip
cp -r models/v2.0.0 /Users/ajitsahu/Project/UCM/DCS-redisgn/cookie-scanner/models/
```

---

## Advanced Options

### Use Specific Dataset

If you want to use a specific dataset instead of the latest:

```python
!python3 train_model.py \
  --dataset dataset/initial_training_20251127_125314 \
  --model-type both \
  --version 2.0.0
```

### Train Only Random Forest

```python
!python3 train_model.py --model-type rf --version 2.0.0
```

### Train Only XGBoost

```python
!python3 train_model.py --model-type xgboost --version 2.0.0
```

### Skip Probability Calibration

```python
!python3 train_model.py \
  --model-type both \
  --version 2.0.0 \
  --no-calibration
```

### Skip Class Balancing (SMOTE)

```python
!python3 train_model.py \
  --model-type both \
  --version 2.0.0 \
  --no-balance
```

---

## Troubleshooting

### Issue: "No such file or directory"

**Solution:** Verify the path to your zip file in Google Drive
```python
# List Drive contents
!ls "/content/drive/MyDrive/Cookie_ML_Training/"
```

### Issue: "Out of memory" Error

**Solutions:**
1. Use GPU runtime (Runtime > Change runtime type > GPU)
2. Reduce synthetic_count in dataset builder
3. Use smaller max_depth for models

### Issue: "Module not found" Error

**Solution:** Reinstall dependencies
```python
!pip install --upgrade scikit-learn xgboost imbalanced-learn pandas numpy
```

### Issue: Training Takes Too Long

**Solutions:**
1. Enable GPU acceleration
2. Reduce number of trees: modify `n_estimators=50` in model_trainer.py
3. Reduce cross-validation folds

---

## Expected Training Time

| Hardware | Random Forest | XGBoost | Total |
|----------|--------------|---------|-------|
| CPU      | 3-5 min      | 5-8 min | 10-15 min |
| GPU (T4) | 1-2 min      | 2-3 min | 4-6 min |
| TPU      | 1 min        | 1-2 min | 2-3 min |

---

## Model Performance Expectations

Based on the current dataset (331 samples, 33 features):

| Metric | Expected Range | Good Performance |
|--------|---------------|------------------|
| Accuracy | 85-96% | > 90% |
| Precision | 85-95% | > 88% |
| Recall | 80-95% | > 85% |
| F1-Score | 83-95% | > 87% |

**Note:** XGBoost typically performs 2-5% better than Random Forest for this task.

---

## Post-Training Steps

1. **Review Metrics:** Check confusion matrix and per-category performance
2. **Test Model:** Use test_model.py to classify sample cookies
3. **Integrate:** Replace old model in your application
4. **Monitor:** Track real-world performance and collect feedback
5. **Retrain:** When you collect more labeled cookies (recommended: 1000+ samples)

---

## Tips for Better Results

### 1. Collect More Data
- Current: 331 samples
- Recommended: 1000+ samples for production
- Target: 200+ samples per category

### 2. Add Real Cookies
- Scan popular websites
- Label cookies manually or via vendor database
- Export to training dataset

### 3. Feature Engineering
- Enable vendor database connection for 3 additional features
- Add domain reputation features
- Include temporal patterns

### 4. Hyperparameter Tuning
```python
# In model_trainer.py, modify these parameters:

# Random Forest
n_estimators: 100 → 200
max_depth: 20 → 30
min_samples_split: 2 → 5

# XGBoost
n_estimators: 100 → 150
max_depth: 6 → 8
learning_rate: 0.1 → 0.05
```

### 5. Ensemble Methods
- Train multiple models with different random seeds
- Use voting classifier
- Combine Random Forest + XGBoost predictions

---

## Backup and Version Control

### Save to Google Drive
```python
# In Colab, after training
!cp -r models/v2.0.0 /content/drive/MyDrive/Cookie_ML_Training/models/
```

### Download Model Metadata
```python
from google.colab import files
files.download('models/v2.0.0/metadata.json')
```

### Save Training Logs
```python
# Redirect output to file
!python3 train_model.py --model-type both --version 2.0.0 > training_log.txt 2>&1
files.download('training_log.txt')
```

---

## Next Steps

1. ✅ Train model in Colab
2. ⬇️ Download trained model
3. 🔧 Integrate into your application
4. 🧪 Test with real cookie data
5. 📊 Monitor performance metrics
6. 🔄 Retrain with new data as needed

---

## Resources

- [Google Colab Documentation](https://colab.research.google.com/)
- [Scikit-learn User Guide](https://scikit-learn.org/stable/user_guide.html)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- Cookie Scanner ML Classifier: `docs/specs/ml-cookie-classification-design.md`

---

## Need Help?

- Check training logs for errors
- Review model metadata: `models/v2.0.0/metadata.json`
- Test feature extraction: `python3 -m backend.api.ml_classifier.demo_feature_extraction`
- Consult the main ML classification design doc

---

**Last Updated:** 2025-11-27
**Model Version:** 2.0.0
**Dataset:** 331 samples, 33 features
