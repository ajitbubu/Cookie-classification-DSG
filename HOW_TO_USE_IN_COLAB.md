# How to Use the Training Script in Google Colab

## 🚀 Quick Start (2 Methods)

### Method 1: Copy-Paste (Easiest - Recommended)

1. **Open Google Colab**
   - Go to https://colab.research.google.com/
   - Click **File** → **New notebook**

2. **Enable GPU**
   - Click **Runtime** → **Change runtime type**
   - Select **Hardware accelerator**: `T4 GPU`
   - Click **Save**

3. **Copy the Script**
   - Open `colab_training_script.py` in your editor
   - You'll see sections marked as "CELL 1", "CELL 2", etc.

4. **Create Cells in Colab**
   - For each "CELL" section in the script:
     - Create a new cell in Colab (click **+ Code**)
     - Copy the code from that CELL section
     - Paste it into the Colab cell
   - You should have 16 cells total

5. **Run All**
   - Click **Runtime** → **Run all**
   - When prompted (Cell 1), select both CSV files
   - Wait 10-15 minutes
   - Download your model!

### Method 2: Import from GitHub (If you have the script online)

1. Open Google Colab
2. Click **File** → **Open notebook**
3. Click **GitHub** tab
4. Paste your repository URL
5. Select the notebook file

---

## 📋 Cell-by-Cell Breakdown

### CELL 1: Upload Files
```python
from google.colab import files
uploaded = files.upload()
DATA_DIR = '/content'
```
**What it does:** Prompts you to upload both CSV files

### CELL 2: Install Dependencies
```python
!pip install -q scikit-learn xgboost imbalanced-learn pandas numpy matplotlib seaborn
```
**What it does:** Installs all required libraries

### CELL 3-9: Data Preparation
- Load data
- Explore and visualize
- Prepare features
- Encode labels
- Split data
- Balance classes with SMOTE

### CELL 10-11: Model Training
- Train Random Forest
- Train XGBoost

### CELL 12-13: Evaluation
- Evaluate both models
- Compare performance
- Select best model

### CELL 14-15: Save and Download
- Save model files
- Create zip file
- Download to your computer

### CELL 16: Test
- Test with sample predictions

---

## 🎯 Step-by-Step Instructions

### Step 1: Create New Notebook in Colab

1. Go to https://colab.research.google.com/
2. Click **File** → **New notebook**
3. Rename it: "Cookie Model Training"

### Step 2: Enable GPU

1. Click **Runtime** → **Change runtime type**
2. Hardware accelerator: **T4 GPU**
3. Click **Save**

### Step 3: Add First Cell (Upload Files)

1. In the first cell, paste:

```python
from google.colab import files
import os

print("📤 Upload your CSV files")
print("Select BOTH files when prompted:")
print("  - cookie_training_100k_train_80.csv")
print("  - cookie_training_100k_test_20.csv")
print()

uploaded = files.upload()

if 'cookie_training_100k_train_80.csv' in uploaded and 'cookie_training_100k_test_20.csv' in uploaded:
    DATA_DIR = '/content'
    print(f"\n✅ Files uploaded successfully!")
    print(f"✅ Training file: {len(uploaded['cookie_training_100k_train_80.csv']):,} bytes")
    print(f"✅ Test file: {len(uploaded['cookie_training_100k_test_20.csv']):,} bytes")
    print("\n🎉 Ready to train!")
else:
    print("\n❌ Missing files! Please upload both CSV files.")
```

2. Run this cell (Shift+Enter)
3. Click "Choose Files" and select both CSV files
4. Wait for upload to complete

### Step 4: Add Remaining Cells

Continue adding cells by copying from `colab_training_script.py`:
- CELL 2: Install dependencies
- CELL 3: Import libraries
- CELL 4: Load data
- ... and so on

### Step 5: Run All Cells

1. Click **Runtime** → **Run all**
2. Wait for training to complete (~10-15 minutes)
3. Download will start automatically

---

## 💡 Pro Tips

### Tip 1: Run Cells Individually First
Instead of "Run all", run each cell one by one to:
- Verify each step works
- See intermediate results
- Debug any issues

### Tip 2: Save Your Notebook
After creating all cells:
1. Click **File** → **Save**
2. It saves to your Google Drive
3. Reuse it next time!

### Tip 3: Monitor Training
Watch the output for:
- Upload confirmation
- Training progress bars
- Validation accuracy
- Model comparison results

### Tip 4: Check GPU Usage
Click the **RAM/Disk** indicator in top-right to see:
- GPU memory usage
- RAM usage
- Make sure GPU is being used

---

## 🐛 Troubleshooting

### Issue: "Choose Files" button doesn't appear
**Solution:** Make sure you're running the cell (Shift+Enter)

### Issue: Upload fails or times out
**Solution:** 
- Check your internet connection
- Try uploading one file at a time
- Verify file sizes (should be < 100MB each)

### Issue: "Out of memory" error
**Solution:**
- Make sure GPU is enabled
- Restart runtime: **Runtime** → **Restart runtime**
- Try again

### Issue: Training is very slow
**Solution:**
- Verify GPU is enabled (Runtime → Change runtime type)
- Check GPU usage (click RAM/Disk indicator)
- If using CPU, expect 30-40 minutes instead of 10-15

### Issue: Download doesn't start
**Solution:**
- Check browser's download settings
- Allow pop-ups for colab.research.google.com
- Manually download from Files panel (folder icon on left)

---

## ✅ Success Checklist

Before running:
- [ ] New Colab notebook created
- [ ] GPU runtime enabled
- [ ] All 16 cells added
- [ ] Both CSV files ready

During execution:
- [ ] Files uploaded successfully
- [ ] No errors in any cell
- [ ] Training progress visible
- [ ] Confusion matrices displayed

After completion:
- [ ] Model comparison shown
- [ ] Zip file downloaded
- [ ] Accuracy > 90%
- [ ] Ready to deploy!

---

## 📊 Expected Output

### Upload Confirmation:
```
✅ Files uploaded successfully!
✅ Training file: 15,234,567 bytes
✅ Test file: 3,808,642 bytes
🎉 Ready to train!
```

### Training Progress:
```
Training Random Forest...
[Parallel(n_jobs=-1)]: Done 100 out of 100 | elapsed: 2.3min finished
✅ Random Forest Training Complete!
Validation Accuracy: 0.9234
```

### Final Results:
```
🏆 Best Model: XGBoost
   F1-Score: 0.9456

🎉 Training Complete!
Best Model: XGBoost
Accuracy: 94.56%
F1-Score: 94.56%
```

---

## 🎓 What Each Cell Does (Quick Reference)

| Cell | Purpose | Time |
|------|---------|------|
| 1 | Upload files | 1-2 min |
| 2 | Install packages | 30 sec |
| 3 | Import libraries | 5 sec |
| 4 | Load data | 10 sec |
| 5 | Explore data | 5 sec |
| 6 | Prepare features | 5 sec |
| 7 | Encode labels | 1 sec |
| 8 | Split data | 1 sec |
| 9 | Balance with SMOTE | 30 sec |
| 10 | Train Random Forest | 3-5 min |
| 11 | Train XGBoost | 5-8 min |
| 12 | Evaluate models | 30 sec |
| 13 | Compare models | 10 sec |
| 14 | Save models | 5 sec |
| 15 | Download | 10 sec |
| 16 | Test predictions | 5 sec |

**Total Time:** ~10-15 minutes with GPU

---

## 🔄 Reusing the Notebook

Once you've created the notebook:

1. **Save it:** File → Save (saves to Google Drive)
2. **Next time:** File → Open notebook → Recent
3. **Just run:** Runtime → Run all
4. **Upload new files** when prompted

No need to recreate cells!

---

## 📞 Need Help?

If you get stuck:
1. Check the error message carefully
2. Look at the Troubleshooting section above
3. Try restarting the runtime
4. Re-run the failing cell
5. Check that files uploaded correctly

---

**Ready to start?** Open Colab and start copying cells! 🚀

**Estimated time:** 15-20 minutes (first time setup)

**Next time:** 10-15 minutes (just run all)
