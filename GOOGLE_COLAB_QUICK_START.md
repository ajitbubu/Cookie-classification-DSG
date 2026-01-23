# Google Colab Training - Quick Start Guide

Train your cookie classification model using Google Colab with your 100k dataset in just 15 minutes!

## 📋 What You Need

1. Google account (for Colab access)
2. Your training data files:
   - `cookie_training_100k_train_80.csv` (80,000 samples)
   - `cookie_training_100k_test_20.csv` (20,000 samples)
3. The Jupyter notebook: `Cookie_Model_Training_100k.ipynb`

## 🚀 Step-by-Step Instructions

### Step 1: Upload Files to Google Drive

1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder called `Cookie_Training_Data`
3. Upload these files to that folder:
   - `cookie_training_100k_train_80.csv`
   - `cookie_training_100k_test_20.csv`

### Step 2: Upload Notebook to Google Drive

1. Upload `Cookie_Model_Training_100k.ipynb` to the same folder
2. Right-click on the notebook file
3. Select **Open with** → **Google Colaboratory**
4. If you don't see Colaboratory, click **Connect more apps** and search for it

### Step 3: Enable GPU (Recommended)

1. In Colab, click **Runtime** → **Change runtime type**
2. Select **Hardware accelerator**: `T4 GPU` or `GPU`
3. Click **Save**

### Step 4: Run the Notebook

1. Click **Runtime** → **Run all**
2. When prompted, authorize Google Drive access
3. Wait for training to complete (~10-15 minutes with GPU)

### Step 5: Download Your Trained Model

The notebook will automatically download a zip file containing:
- `model.pkl` - The trained model
- `label_encoder.pkl` - Label encoder
- `features.json` - Feature names
- `metadata.json` - Model metadata and metrics

## 📊 What to Expect

### Training Progress

You'll see:
- Dataset loading and exploration
- Class distribution visualization
- Random Forest training progress
- XGBoost training with early stopping
- Model comparison and evaluation
- Confusion matrices
- Performance metrics

### Expected Performance

With 100k samples, you should see:
- **Accuracy**: 92-96%
- **Precision**: 90-95%
- **Recall**: 90-95%
- **F1-Score**: 91-95%

XGBoost typically performs 2-4% better than Random Forest.

## 🔧 After Training

### Step 1: Extract the Downloaded Zip

```bash
unzip trained_model_v2.0.0.zip
```

### Step 2: Copy to Your Project

```bash
# From your project root
cp -r v2.0.0 models/
```

### Step 3: Test the Model

```bash
# Test with your application
python3 -m backend.api.ml_classifier.demo_classifier
```

## 💡 Tips for Better Results

### 1. Use GPU Runtime
- Training time: CPU (30-40 min) vs GPU (10-15 min)
- Better for large datasets

### 2. Monitor Training
- Watch for overfitting warnings
- Check train-test gap in metrics
- Review confusion matrix for problem categories

### 3. Adjust Hyperparameters
If you want to experiment, modify these in the notebook:

**Random Forest:**
```python
n_estimators=100      # Number of trees
max_depth=15          # Tree depth
min_samples_split=15  # Min samples to split
```

**XGBoost:**
```python
max_depth=6           # Tree depth
learning_rate=0.03    # Learning rate
n_estimators=500      # Number of boosting rounds
```

## 🐛 Troubleshooting

### Issue: "No such file or directory"

**Solution:** Check your Google Drive path in Cell 1:
```python
DATA_DIR = '/content/drive/MyDrive/Cookie_Training_Data'
```

Make sure this matches where you uploaded your CSV files.

### Issue: "Out of memory"

**Solutions:**
1. Enable GPU runtime (Runtime → Change runtime type → GPU)
2. Reduce SMOTE balancing (comment out the SMOTE cell)
3. Use a smaller validation split

### Issue: Training is slow

**Solutions:**
1. Enable GPU runtime
2. Reduce `n_estimators` for both models
3. Skip Random Forest and train only XGBoost

### Issue: Low accuracy

**Possible causes:**
1. Data quality issues - check for missing values
2. Class imbalance - SMOTE should help
3. Feature engineering needed - add more features

## 📈 Understanding the Results

### Confusion Matrix
Shows where the model makes mistakes. Look for:
- High diagonal values (correct predictions)
- Off-diagonal patterns (common misclassifications)

### Per-Class Metrics
- **Precision**: How many predicted cookies are correct?
- **Recall**: How many actual cookies did we find?
- **F1-Score**: Balance between precision and recall

### Model Comparison
The notebook trains both models and picks the best one based on F1-score.

## 🔄 Retraining

When to retrain:
1. You collect more labeled data
2. Model performance degrades
3. You add new cookie categories
4. You improve feature engineering

Just upload new CSV files and run the notebook again!

## 📚 Additional Resources

- [Google Colab Documentation](https://colab.research.google.com/)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [Scikit-learn User Guide](https://scikit-learn.org/stable/user_guide.html)

## ✅ Checklist

Before you start:
- [ ] CSV files uploaded to Google Drive
- [ ] Notebook uploaded to Google Drive
- [ ] GPU runtime enabled
- [ ] Google Drive path verified

After training:
- [ ] Model downloaded successfully
- [ ] Model copied to project
- [ ] Model tested with sample data
- [ ] Performance metrics reviewed

## 🎯 Next Steps

1. ✅ Train your model in Colab
2. 📥 Download the trained model
3. 🔧 Integrate into your application
4. 🧪 Test with real cookie data
5. 📊 Monitor performance
6. 🔄 Retrain as needed

---

**Need help?** Check the troubleshooting section or review the existing training guide at `docs/GOOGLE_COLAB_TRAINING_GUIDE.md`

**Training Time:** ~10-15 minutes with GPU, ~30-40 minutes with CPU

**Model Size:** ~50-100 MB (depending on model complexity)

**Ready to train?** Open the notebook in Colab and click "Run all"! 🚀
