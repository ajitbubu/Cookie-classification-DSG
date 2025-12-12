# Google Colab Troubleshooting Guide

Quick fixes for common Google Colab training errors.

---

## Error: `ModuleNotFoundError: No module named 'numpy.rec'` or `'numpy.strings'`

### Symptoms
```python
ModuleNotFoundError: No module named 'numpy.rec'
# OR
ModuleNotFoundError: No module named 'numpy.strings'
# OR
ERROR: pip's dependency resolver does not currently take into account all the packages...
```

### Cause
Google Colab updated to Python 3.12 which requires:
- NumPy >= 2.0
- scikit-learn >= 1.6
- Latest versions of ML libraries

Downgrading causes conflicts with Colab's pre-installed packages (JAX, OpenCV, etc.)

### Solution ✅ (Updated for Python 3.12)

**Use the updated Cell 2 code:**

```python
# Use latest compatible versions for Python 3.12
# Don't downgrade numpy - Colab needs numpy 2.0+
!pip install -q --upgrade scikit-learn xgboost imbalanced-learn

print("\n✅ Dependencies installed!")
print("\nInstalled versions:")

import numpy
import sklearn
import xgboost
import imblearn
import pandas

print(f"  NumPy: {numpy.__version__}")
print(f"  Pandas: {pandas.__version__}")
print(f"  scikit-learn: {sklearn.__version__}")
print(f"  XGBoost: {xgboost.__version__}")
print(f"  imbalanced-learn: {imblearn.__version__}")

print("\n✅ All dependencies ready!")
```

### Why This Works
1. Keeps Colab's pre-installed NumPy 2.0+ (required by Python 3.12)
2. Upgrades scikit-learn to latest version (1.6+) compatible with NumPy 2.0
3. Upgrades other libraries to compatible versions
4. No dependency conflicts

### Alternative: Use Specific Versions

If you need specific versions for compatibility:

```python
# Install specific compatible versions
!pip install -q scikit-learn==1.6.0 xgboost==2.1.3 imbalanced-learn==0.12.4

print("\n✅ Dependencies installed!")
import numpy, sklearn, xgboost, imblearn
print(f"  NumPy: {numpy.__version__}")
print(f"  scikit-learn: {sklearn.__version__}")
print(f"  XGBoost: {xgboost.__version__}")
print(f"  imbalanced-learn: {imblearn.__version__}")
```

### Expected Versions (Python 3.12)
- NumPy: 2.0+ (pre-installed, don't change)
- Pandas: 2.0+ (pre-installed, don't change)
- scikit-learn: 1.6+
- XGBoost: 2.1+
- imbalanced-learn: 0.12+

---

## Error: "File not found" when extracting package

### Symptoms
```
FileNotFoundError: [Errno 2] No such file or directory:
'/content/drive/MyDrive/Cookie_ML_Training/colab_training_package.zip'
```

### Cause
Incorrect file path or folder name in Google Drive.

### Solution ✅

**Step 1: Verify Drive is mounted**
```python
# Check if Drive is mounted
!ls "/content/drive/MyDrive/"
```

**Step 2: Check folder exists**
```python
# List contents of Cookie_ML_Training folder
!ls -la "/content/drive/MyDrive/Cookie_ML_Training/"
```

**Step 3: Fix the path if needed**

If your folder has a different name, update Cell 3:
```python
# Update this path to match your folder name
!unzip -q "/content/drive/MyDrive/YOUR_FOLDER_NAME/colab_training_package.zip" -d /content/
```

**Common folder name issues:**
- Spaces in folder name: Use quotes
- Wrong capitalization: Must match exactly
- Folder doesn't exist: Create it in Google Drive first

---

## Error: "Out of memory" during training

### Symptoms
```
ResourceExhaustedError: OOM when allocating tensor
```

### Cause
Training on CPU without enough RAM, or dataset too large.

### Solution ✅

**Option 1: Enable GPU (Recommended)**
1. Click **Runtime** → **Change runtime type**
2. Select **Hardware accelerator**: `T4 GPU`
3. Click **Save**
4. Click **Runtime** → **Restart runtime**
5. Re-run all cells

**Option 2: Reduce model complexity**
Modify the training script to use smaller models:

```python
# In train_model.py, reduce these parameters
n_estimators = 50  # Instead of 100
max_depth = 10     # Instead of 20
```

**Option 3: Reduce dataset size**
Use fewer samples if dataset is very large:
```python
# In Cell 4, add sampling
features_df = features_df.sample(n=500, random_state=42)
labels_df = labels_df.iloc[features_df.index]
```

---

## Error: Training takes more than 15 minutes

### Symptoms
Training progress very slow, estimated time > 15 minutes.

### Cause
Running on CPU instead of GPU.

### Solution ✅

**Check if GPU is enabled:**
```python
# Add this to a new cell
import tensorflow as tf
print("GPU Available:", tf.config.list_physical_devices('GPU'))
```

**Enable GPU:**
1. **Runtime** → **Change runtime type**
2. **Hardware accelerator**: `T4 GPU`
3. **Save**
4. **Runtime** → **Restart runtime**
5. Re-run all cells

**Expected training times:**
- CPU: 10-15 minutes
- GPU: 4-6 minutes
- TPU: 2-3 minutes

---

## Error: Import errors after installation

### Symptoms
```python
ImportError: cannot import name 'FeatureExtractor'
ModuleNotFoundError: No module named 'ml_classifier'
```

### Cause
Package not extracted properly, or wrong working directory.

### Solution ✅

**Step 1: Verify extraction**
```python
# Check if ml_classifier exists
!ls -la /content/ml_classifier/
```

**Step 2: Check working directory**
```python
import os
print("Current directory:", os.getcwd())
# Should be: /content
```

**Step 3: Re-extract if needed**
```python
%cd /content
!rm -rf ml_classifier training_data
!unzip -q "/content/drive/MyDrive/Cookie_ML_Training/colab_training_package.zip" -d /content/
```

**Step 4: Add to Python path**
```python
import sys
sys.path.insert(0, '/content')
```

---

## Error: "Permission denied" when saving to Drive

### Symptoms
```
PermissionError: [Errno 13] Permission denied
```

### Cause
Drive not mounted, or insufficient permissions.

### Solution ✅

**Step 1: Re-mount Drive**
```python
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```

**Step 2: Verify write permissions**
```python
# Test write access
test_file = "/content/drive/MyDrive/Cookie_ML_Training/test.txt"
with open(test_file, 'w') as f:
    f.write("test")
print(f"✅ Write access confirmed")
!rm "{test_file}"
```

**Step 3: Create directory if missing**
```python
!mkdir -p "/content/drive/MyDrive/Cookie_ML_Training/models"
```

---

## Error: XGBoost training fails

### Symptoms
```
XGBoostError: Invalid parameter
```

### Cause
XGBoost version compatibility issue.

### Solution ✅

**Option 1: Use Random Forest only**
```python
# In Cell 5 (training cell)
!python3 train_model.py --model-type rf --version 2.0.0
```

**Option 2: Update XGBoost**
```python
!pip install --upgrade xgboost==2.0.3
```

**Option 3: Skip XGBoost**
Modify `train_model.py` to remove XGBoost training code.

---

## Error: Model file too large to download

### Symptoms
Browser times out when downloading `trained_model_v2.0.0.zip`.

### Solution ✅

**Option 1: Use Google Drive (Recommended)**
The model is already saved to Google Drive in Cell 8. Download from there:
1. Go to Google Drive
2. Navigate to `Cookie_ML_Training/models/v2.0.0/`
3. Download individual files (smaller)

**Option 2: Download individual files**
```python
from google.colab import files

# Download only the model file
files.download('/content/models/v2.0.0/model.pkl')
files.download('/content/models/v2.0.0/metadata.json')
files.download('/content/models/v2.0.0/feature_names.json')
```

**Option 3: Use Drive sync**
Files are automatically in your Drive, sync to desktop:
- Install Google Drive for Desktop
- Access `Cookie_ML_Training/models/v2.0.0/`

---

## Error: Runtime disconnected

### Symptoms
```
Your session crashed after using all available RAM.
Runtime disconnected
```

### Cause
Colab runtime timed out or ran out of resources.

### Solution ✅

**Step 1: Reconnect**
Click **Reconnect** button in Colab

**Step 2: Check saved progress**
Model might already be saved to Drive:
```python
!ls -la "/content/drive/MyDrive/Cookie_ML_Training/models/"
```

**Step 3: Resume if needed**
If training was interrupted, check if partial model exists:
```python
!ls -la /content/models/
```

**Prevention:**
- Enable GPU to train faster
- Keep browser tab active
- Use Colab Pro for longer runtimes

---

## Error: SMOTE balancing fails

### Symptoms
```
ValueError: Expected n_neighbors <= n_samples
```

### Cause
Not enough samples for SMOTE balancing in some categories.

### Solution ✅

**Option 1: Skip balancing**
```python
!python3 train_model.py --model-type both --version 2.0.0 --no-balance
```

**Option 2: Increase samples**
Rebuild dataset with more synthetic samples locally, then re-upload.

---

## Validation: Check Everything is Working

Run this diagnostic cell to verify your setup:

```python
print("="*70)
print("Colab Environment Diagnostic")
print("="*70)

# 1. Check Python version
import sys
print(f"\n✅ Python: {sys.version.split()[0]}")

# 2. Check dependencies
try:
    import numpy, sklearn, xgboost, imblearn
    print(f"✅ NumPy: {numpy.__version__}")
    print(f"✅ scikit-learn: {sklearn.__version__}")
    print(f"✅ XGBoost: {xgboost.__version__}")
    print(f"✅ imbalanced-learn: {imblearn.__version__}")
except ImportError as e:
    print(f"❌ Missing dependency: {e}")

# 3. Check GPU
try:
    import tensorflow as tf
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print(f"✅ GPU: {len(gpus)} device(s) available")
    else:
        print("⚠️  GPU: Not enabled (training will be slower)")
except:
    print("⚠️  GPU: Cannot detect")

# 4. Check Drive
import os
if os.path.exists('/content/drive/MyDrive'):
    print("✅ Google Drive: Mounted")
else:
    print("❌ Google Drive: Not mounted")

# 5. Check training package
if os.path.exists('/content/ml_classifier'):
    print("✅ Training package: Extracted")
else:
    print("❌ Training package: Not extracted")

# 6. Check dataset
import glob
datasets = glob.glob("/content/training_data/initial_training_*")
if datasets:
    print(f"✅ Dataset: Found ({len(datasets)} dataset(s))")
else:
    print("❌ Dataset: Not found")

print("\n" + "="*70)
print("Diagnostic Complete")
print("="*70)
```

---

## Still Having Issues?

### 1. **Check the full guide**
Read: [GOOGLE_COLAB_TRAINING_GUIDE.md](GOOGLE_COLAB_TRAINING_GUIDE.md)

### 2. **Restart from scratch**
```python
# Clear everything and start over
!rm -rf /content/ml_classifier /content/training_data /content/models
# Then re-run all cells from Cell 1
```

### 3. **Try Colab Pro**
Free tier limitations:
- Limited GPU time
- Session timeouts
- Resource limits

Colab Pro benefits:
- Longer runtimes
- Better GPUs
- Priority access

### 4. **Train locally instead**
If Colab continues to have issues, train locally:
```bash
cd /Users/ajitsahu/Project/UCM/DCS-redisgn/cookie-scanner
python3 -m backend.api.ml_classifier.training.train_model \
  --model-type both --version 2.0.0
```

---

**Quick Reference:**

| Error | Quick Fix |
|-------|-----------|
| NumPy error | Use numpy==1.24.3 |
| File not found | Check Drive path |
| Out of memory | Enable GPU |
| Slow training | Enable GPU |
| Import errors | Re-extract package |
| Permission denied | Re-mount Drive |
| Runtime disconnected | Check Drive for saved model |
| SMOTE fails | Use --no-balance |

---

**Last Updated:** 2025-11-27
