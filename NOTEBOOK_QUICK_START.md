# Cookie Model Training - Quick Start Guide

## 📦 File Ready: `Cookie_Model_Training.ipynb`

This is a complete, ready-to-use Google Colab notebook with direct file upload.

## 🚀 How to Use (3 Steps)

### Step 1: Upload to Google Colab

**Option A: Direct Upload**
1. Go to https://colab.research.google.com/
2. Click **File** → **Upload notebook**
3. Select `Cookie_Model_Training.ipynb`
4. Done! ✅

**Option B: From Google Drive**
1. Upload `Cookie_Model_Training.ipynb` to your Google Drive
2. Right-click the file → **Open with** → **Google Colaboratory**
3. Done! ✅

### Step 2: Enable GPU

1. In Colab, click **Runtime** → **Change runtime type**
2. Select **Hardware accelerator**: `T4 GPU`
3. Click **Save**

### Step 3: Run Everything

1. Click **Runtime** → **Run all**
2. When prompted (first cell), click **Choose Files**
3. Select BOTH CSV files:
   - `cookie_training_100k_train_80.csv`
   - `cookie_training_100k_test_20.csv`
4. Wait 10-15 minutes
5. Download your trained model automatically! 🎉

## 📋 What the Notebook Does

The notebook has **16 steps**:

1. **Upload Files** - Direct upload (no Google Drive needed)
2. **Install Dependencies** - All ML libraries
3. **Import Libraries** - Load packages
4. **Load Data** - Read your CSV files
5. **Explore Data** - Visualize distribution
6. **Prepare Features** - Extract 10 features
7. **Encode Labels** - Convert categories
8. **Validation Split** - Split data
9. **Balance Classes** - Use SMOTE
10. **Train Random Forest** - Baseline model
11. **Train XGBoost** - Production model
12. **Evaluate Models** - Test performance
13. **Select Best** - Pick winner
14. **Save Model** - Create files
15. **Download** - Get your model
16. **Test** - Sample predictions

## ⏱️ Timeline

| Step | Time | What Happens |
|------|------|--------------|
| Upload files | 1-2 min | Select and upload CSVs |
| Install packages | 30 sec | Install libraries |
| Load & prepare | 1 min | Load and process data |
| Train RF | 3-5 min | Train Random Forest |
| Train XGBoost | 5-8 min | Train XGBoost |
| Evaluate & save | 1 min | Test and save model |
| Download | 10 sec | Download zip file |

**Total: 10-15 minutes with GPU**

## 📊 Expected Results

With 100k samples:

| Metric | Expected |
|--------|----------|
| Accuracy | 92-96% |
| Precision | 90-95% |
| Recall | 90-95% |
| F1-Score | 91-95% |

XGBoost typically performs 2-4% better than Random Forest.

## 💾 What You'll Download

A zip file: `trained_model_v2.0.0.zip`

Contains:
```
v2.0.0/
├── model.pkl           # Trained model
├── label_encoder.pkl   # Label encoder
├── features.json       # Feature names
└── metadata.json       # Model info & metrics
```

## 🔧 After Training

### 1. Extract the Zip
```bash
unzip trained_model_v2.0.0.zip
```

### 2. Copy to Your Project
```bash
cp -r v2.0.0 /path/to/your/project/models/
```

### 3. Use the Model
```python
import joblib

# Load model
model = joblib.load('models/v2.0.0/model.pkl')
label_encoder = joblib.load('models/v2.0.0/label_encoder.pkl')

# Predict
prediction = model.predict(features)
category = label_encoder.inverse_transform(prediction)
```

## 🐛 Troubleshooting

### Issue: Notebook won't open in Colab
**Solution:** 
- Make sure file is named `Cookie_Model_Training.ipynb`
- Try uploading directly instead of from Drive
- Check file isn't corrupted (should be ~30KB)

### Issue: Upload button doesn't appear
**Solution:**
- Make sure you're running the first cell
- Press Shift+Enter to run the cell
- Check browser allows file uploads

### Issue: Out of memory
**Solution:**
- Enable GPU runtime (Runtime → Change runtime type → GPU)
- Restart runtime (Runtime → Restart runtime)
- Try again

### Issue: Training is slow
**Solution:**
- Verify GPU is enabled (should see "GPU" in top-right)
- Check GPU usage (click RAM/Disk indicator)
- CPU training takes 30-40 min vs 10-15 min with GPU

### Issue: Download doesn't start
**Solution:**
- Check browser's download settings
- Allow pop-ups for colab.research.google.com
- Look in Files panel (folder icon on left) and download manually

## ✅ Success Checklist

Before running:
- [ ] Notebook uploaded to Colab
- [ ] GPU runtime enabled
- [ ] Both CSV files ready on your computer

During execution:
- [ ] Files uploaded successfully (see ✅ confirmation)
- [ ] No red error messages
- [ ] Training progress bars visible
- [ ] Confusion matrices displayed

After completion:
- [ ] Model comparison shown
- [ ] Best model selected (usually XGBoost)
- [ ] Zip file downloaded
- [ ] Accuracy > 90%

## 🎯 Pro Tips

### Tip 1: Save Your Notebook
After first run:
- Click **File** → **Save a copy in Drive**
- Next time: **File** → **Open notebook** → **Recent**
- Just run all cells again!

### Tip 2: Monitor Progress
Watch for these key outputs:
- ✅ Files uploaded successfully
- ✅ RF Validation Accuracy: 0.92XX
- ✅ XGB Validation Accuracy: 0.94XX
- 🏆 Best Model: XGBoost

### Tip 3: Check GPU Usage
Click the **RAM/Disk** indicator in top-right:
- Should show GPU memory usage
- If not, GPU isn't enabled

### Tip 4: Run Cells Individually
Instead of "Run all", you can:
- Run cells one by one (Shift+Enter)
- See each step's output
- Debug issues easier

## 📱 Mobile Users

The notebook works on mobile too!
1. Open Colab app or browser
2. Upload notebook
3. Upload CSV files
4. Run all
5. Download model

Note: File upload on mobile can be slower.

## 🔄 Retraining

To retrain with new data:
1. Open the same notebook
2. Click **Runtime** → **Restart runtime**
3. Click **Runtime** → **Run all**
4. Upload new CSV files
5. Get new model!

## 📞 Need Help?

If something goes wrong:
1. Read the error message carefully
2. Check the Troubleshooting section above
3. Try restarting runtime
4. Re-run the failing cell
5. Verify files uploaded correctly

## 🎓 Understanding the Output

### Upload Confirmation:
```
✅ Files uploaded successfully!
✅ Training file: 15,234,567 bytes
✅ Test file: 3,808,642 bytes
🎉 Ready to train!
```

### Training Progress:
```
🌲 Training Random Forest...
[Parallel(n_jobs=-1)]: Done 100 out of 100
✅ RF Validation Accuracy: 0.9234
```

### Final Results:
```
🏆 Best Model: XGBoost
   Accuracy: 94.56%
   F1-Score: 94.56%

🎉 Training Complete!
```

## 🌟 Features

✅ **No Google Drive needed** - Direct upload
✅ **Auto-selects best model** - RF vs XGBoost comparison
✅ **Visualizations** - Confusion matrices & charts
✅ **Sample predictions** - Test with real data
✅ **One-click download** - Get your model instantly
✅ **Production-ready** - Includes all necessary files

## 📚 What's Included

The notebook includes:
- Data loading and exploration
- Feature engineering
- Class balancing (SMOTE)
- Two model types (RF + XGBoost)
- Cross-validation
- Performance metrics
- Confusion matrices
- Model comparison
- Automatic download

## 🎉 Ready to Start?

1. Open `Cookie_Model_Training.ipynb` in Google Colab
2. Enable GPU
3. Run all cells
4. Upload your CSV files
5. Wait 10-15 minutes
6. Download your trained model!

**That's it!** 🚀

---

**File:** `Cookie_Model_Training.ipynb`

**Size:** ~30KB

**Format:** Jupyter Notebook (.ipynb)

**Compatible with:** Google Colab, Jupyter, JupyterLab

**Training time:** 10-15 minutes (GPU) | 30-40 minutes (CPU)

**Expected accuracy:** 92-96%
