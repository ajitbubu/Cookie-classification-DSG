# Google Colab Training - Direct Upload Method

## 🚀 Quick Start (3 Steps)

### 1. Open the Notebook
- Upload `Cookie_Training_Direct_Upload.ipynb` to Google Colab
- Or create a new notebook and copy the cells

### 2. Enable GPU (Optional but Recommended)
- Click **Runtime** → **Change runtime type**
- Select **Hardware accelerator**: `T4 GPU`
- Click **Save**

### 3. Run All Cells
- Click **Runtime** → **Run all**
- When prompted, select BOTH CSV files:
  - `cookie_training_100k_train_80.csv`
  - `cookie_training_100k_test_20.csv`
- Wait 10-15 minutes for training to complete
- Download your trained model automatically!

## 📋 What This Notebook Does

### Step-by-Step Process:

1. **Upload Files** - Direct upload (no Google Drive needed)
2. **Install Dependencies** - scikit-learn, XGBoost, etc.
3. **Import Libraries** - All ML libraries
4. **Load Data** - Read your 100k CSV files
5. **Explore Data** - Visualize class distribution
6. **Prepare Features** - Extract 10 features
7. **Encode Labels** - Convert categories to numbers
8. **Create Validation Split** - 68% train, 12% val, 20% test
9. **Balance Classes** - Use SMOTE to handle imbalance
10. **Train Random Forest** - Baseline model
11. **Train XGBoost** - Production model
12. **Evaluate Models** - Test set performance
13. **Compare Models** - Pick the best one
14. **Save Models** - Create model files
15. **Download** - Get your trained model
16. **Test** - Sample predictions

## 📊 Expected Results

With 100k samples, you should see:

| Metric | Expected Range |
|--------|---------------|
| Accuracy | 92-96% |
| Precision | 90-95% |
| Recall | 90-95% |
| F1-Score | 91-95% |

XGBoost typically performs 2-4% better than Random Forest.

## 🎯 Key Differences from Original Notebook

### Original (Google Drive):
```python
from google.colab import drive
drive.mount('/content/drive')
DATA_DIR = '/content/drive/MyDrive/Cookie_Training_Data'
```

### New (Direct Upload):
```python
from google.colab import files
uploaded = files.upload()  # Select both CSV files
DATA_DIR = '/content'
```

## ⏱️ Training Time

| Hardware | Time |
|----------|------|
| CPU | 30-40 minutes |
| GPU (T4) | 10-15 minutes |
| TPU | 5-8 minutes |

## 💾 What You'll Download

A zip file containing:
```
trained_model_v2.0.0.zip
└── v2.0.0/
    ├── model.pkl           # Trained model
    ├── label_encoder.pkl   # Label encoder
    ├── features.json       # Feature names
    └── metadata.json       # Model info & metrics
```

## 🔧 After Training

### 1. Extract the Zip File
```bash
unzip trained_model_v2.0.0.zip
```

### 2. Copy to Your Project
```bash
cp -r v2.0.0 /path/to/your/project/models/
```

### 3. Test the Model
```python
import joblib

# Load model
model = joblib.load('models/v2.0.0/model.pkl')
label_encoder = joblib.load('models/v2.0.0/label_encoder.pkl')

# Make prediction
prediction = model.predict(features)
category = label_encoder.inverse_transform(prediction)
```

## 🐛 Troubleshooting

### Issue: Upload Fails
**Solution:** Files might be too large. Try:
1. Check file sizes (should be < 100MB each)
2. Use Google Drive method instead
3. Split into smaller batches

### Issue: Out of Memory
**Solution:**
1. Enable GPU runtime
2. Restart runtime and try again
3. Reduce SMOTE balancing

### Issue: Training Takes Too Long
**Solution:**
1. Enable GPU (Runtime → Change runtime type → GPU)
2. Reduce `n_estimators` in models
3. Skip Random Forest, train only XGBoost

## 📝 Notes

### File Upload Behavior:
- Files are uploaded to `/content/` (temporary)
- Files are deleted when session ends
- No Google Drive needed
- Faster for one-time training

### When to Use This Method:
- ✅ Quick one-time training
- ✅ Don't want to use Google Drive
- ✅ Files are < 100MB each
- ✅ Don't need to save files long-term

### When to Use Google Drive Method:
- ✅ Files are very large (> 100MB)
- ✅ Want to save files permanently
- ✅ Need to retrain multiple times
- ✅ Want to share files across sessions

## 🎓 Tips for Better Results

### 1. Monitor Training
Watch for:
- Overfitting warnings
- Train-test gap
- Early stopping iteration

### 2. Check Confusion Matrix
Look for:
- High diagonal values (good)
- Off-diagonal patterns (misclassifications)
- Problem categories

### 3. Review Per-Class Metrics
- Which categories perform well?
- Which need more training data?
- Are there systematic errors?

## ✅ Success Checklist

Before training:
- [ ] Notebook uploaded to Colab
- [ ] GPU runtime enabled
- [ ] Both CSV files ready

During training:
- [ ] Files uploaded successfully
- [ ] No errors in data loading
- [ ] Training progressing normally

After training:
- [ ] Model downloaded
- [ ] Metrics look good (>90% accuracy)
- [ ] Zip file extracted
- [ ] Model copied to project

## 🔄 Retraining

To retrain with new data:
1. Open the same notebook
2. Upload new CSV files
3. Run all cells again
4. Download new model

## 📚 Additional Resources

- [Google Colab Documentation](https://colab.research.google.com/)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [Scikit-learn User Guide](https://scikit-learn.org/stable/)

## 🆘 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify file names match exactly
3. Try restarting the runtime
4. Re-run the failing cell
5. Check the troubleshooting section above

---

**Ready to train?** Upload the notebook to Colab and click "Run all"! 🚀

**Training Time:** ~10-15 minutes with GPU

**Model Size:** ~50-100 MB

**Expected Accuracy:** 92-96%
