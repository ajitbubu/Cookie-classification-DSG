# Quick Start: Train Model in Google Colab

Complete setup in **5 minutes**, train in **4-6 minutes** with GPU!

## What You Have

✅ **Training package ready**: [colab_training_package.zip](colab_training_package.zip) (0.07 MB)
✅ **Colab notebook ready**: [Cookie_Model_Training.ipynb](Cookie_Model_Training.ipynb)
✅ **Dataset ready**: 331 samples, 33 features
✅ **Documentation**: Full guide available

---

## 5-Step Quick Start

### Step 1: Upload Files to Google Drive (2 minutes)

1. Go to [Google Drive](https://drive.google.com)
2. Create new folder: `Cookie_ML_Training`
3. Upload these 2 files to that folder:
   - `colab_training_package.zip`
   - `Cookie_Model_Training.ipynb`

### Step 2: Open in Colab (1 minute)

1. In Google Drive, right-click `Cookie_Model_Training.ipynb`
2. Select **Open with** → **Google Colaboratory**
3. If Colab isn't listed, click **Connect more apps** and search "Colaboratory"

### Step 3: Enable GPU (1 minute)

1. In Colab: **Runtime** → **Change runtime type**
2. Select **Hardware accelerator**: `T4 GPU`
3. Click **Save**

### Step 4: Run Training (30 seconds)

Click **Runtime** → **Run all**

The notebook will:
- Mount Google Drive (authorize access)
- Install dependencies (~1 min)
- Extract training package
- Train both Random Forest & XGBoost (~4-6 min)
- Compare models and select best
- Save to Google Drive

### Step 5: Download Model (1 minute)

After training completes:
- Model automatically downloads as `trained_model_v2.0.0.zip`
- Also saved to Google Drive at `Cookie_ML_Training/models/v2.0.0/`

**Extract and use:**
```bash
unzip trained_model_v2.0.0.zip
cp -r models/v2.0.0 /Users/ajitsahu/Project/UCM/DCS-redisgn/cookie-scanner/models/
```

---

## What Happens During Training

### Phase 1: Setup (1-2 min)
```
✅ Google Drive mounted
✅ Dependencies installed (scikit-learn, xgboost, etc.)
✅ Training package extracted
✅ Dataset loaded: 331 samples
```

### Phase 2: Data Preparation (30 sec)
```
📊 Split: 231 train / 50 validation / 50 test
⚖️ SMOTE balancing: 528 samples
✅ Ready for training
```

### Phase 3: Random Forest (2-3 min)
```
🌲 Training Random Forest...
   100 estimators, max_depth=20
   Cross-validation: ~94%
✅ Model trained
```

### Phase 4: XGBoost (2-3 min)
```
🚀 Training XGBoost...
   Max_depth=6, learning_rate=0.1
   Cross-validation: ~95%
✅ Model trained
```

### Phase 5: Evaluation & Save (30 sec)
```
🏆 Best Model: XGBoost
📊 Accuracy: 96%
💾 Saved to models/v2.0.0/
⬇️ Downloaded: trained_model_v2.0.0.zip
```

---

## Expected Results

| Metric | Expected | Actual (Your Model) |
|--------|----------|---------------------|
| Accuracy | 90-96% | _(will show after training)_ |
| Precision | 88-95% | _(will show after training)_ |
| Recall | 85-95% | _(will show after training)_ |
| F1-Score | 87-95% | _(will show after training)_ |

### Per-Category Performance

Expected breakdown:

- **Analytics**: 95%+ accuracy (best)
- **Marketing**: 90-95% accuracy
- **Functional**: 85-90% accuracy (fewer samples)
- **Strictly Necessary**: 85-90% accuracy (fewer samples)

---

## Troubleshooting

### "File not found" error
**Fix:** Check file path in Colab notebook Cell 3:
```python
# Should match your Drive folder
"/content/drive/MyDrive/Cookie_ML_Training/colab_training_package.zip"
```

### "Out of memory" error
**Fix:**
1. Verify GPU is enabled (Runtime → Change runtime type)
2. Restart runtime (Runtime → Restart runtime)

### Training takes > 15 minutes
**Fix:** Enable GPU! (Runtime → Change runtime type → T4 GPU)

---

## Alternative: Train Locally

If you prefer to train locally instead of Colab:

```bash
cd /Users/ajitsahu/Project/UCM/DCS-redisgn/cookie-scanner

# Train both models
python3 -m backend.api.ml_classifier.training.train_model \
  --model-type both \
  --version 2.0.0

# Expected time: 10-15 minutes (CPU)
# Output: models/v2.0.0/
```

---

## Files You'll Get

After training, you'll have:

### 1. `model.pkl` (trained model)
Pickled scikit-learn or XGBoost model ready to use

### 2. `metadata.json` (performance metrics)
```json
{
  "version": "2.0.0",
  "model_type": "xgboost",
  "accuracy": 0.96,
  "precision": 0.9634,
  "recall": 0.96,
  "f1_score": 0.9595,
  "category_metrics": {...},
  "feature_importance": {...}
}
```

### 3. `feature_names.json` (feature list)
33 feature names used by the model

---

## Next Steps After Training

### 1. Test Model
```python
# In Colab or locally
from ml_classifier.classifier import CookieClassifier

classifier = CookieClassifier(model_path="models/v2.0.0")
result = classifier.classify_cookie({
    'name': '_ga',
    'domain': '.google-analytics.com',
    'value': 'GA1.2.123456789.1234567890',
    ...
})

print(result.category)      # 'Analytics'
print(result.confidence)    # 0.98
```

### 2. Integrate into App
Update your application to use the new model:

```python
# In your backend
ACTIVE_MODEL_VERSION = "v2.0.0"  # Update from v1.0.0
```

### 3. Monitor Performance
Track real-world classification accuracy:
- Collect user feedback
- Monitor confidence scores
- Identify misclassifications

### 4. Improve & Retrain
When to retrain:
- Collected 500+ new labeled cookies
- Performance drops below 90%
- New cookie patterns emerge
- Quarterly (recommended)

---

## Documentation

📖 **Detailed Guide**: [docs/GOOGLE_COLAB_TRAINING_GUIDE.md](docs/GOOGLE_COLAB_TRAINING_GUIDE.md)

Topics covered:
- Advanced training options
- Hyperparameter tuning
- Performance optimization
- Troubleshooting
- Feature engineering
- Data collection strategies

---

## Summary

| Step | Time | What Happens |
|------|------|--------------|
| 1. Upload to Drive | 2 min | Upload 2 files |
| 2. Open in Colab | 1 min | Open notebook |
| 3. Enable GPU | 1 min | Configure hardware |
| 4. Run training | 4-6 min | Train & compare models |
| 5. Download model | 1 min | Get trained model |
| **TOTAL** | **9-11 min** | **Ready to deploy!** |

---

**Ready to start?**

1. ✅ Upload files to Google Drive
2. ✅ Open notebook in Colab
3. ✅ Click "Run all"
4. ✅ Wait 4-6 minutes
5. ✅ Download and deploy!

Good luck with your training! 🚀
