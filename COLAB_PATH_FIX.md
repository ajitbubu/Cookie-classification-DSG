# Fix: FileNotFoundError in Google Colab

## Quick Fix - Add This Cell Before Step 4

Add this new cell **right after mounting Google Drive** (after Cell 1) to find your files:

```python
# DIAGNOSTIC CELL - Find your CSV files
import os

print("🔍 Searching for your CSV files in Google Drive...")
print()

# List contents of MyDrive
print("Contents of /content/drive/MyDrive/:")
try:
    items = os.listdir('/content/drive/MyDrive/')
    for item in items[:20]:  # Show first 20 items
        print(f"  - {item}")
    if len(items) > 20:
        print(f"  ... and {len(items) - 20} more items")
except Exception as e:
    print(f"  Error: {e}")

print()

# Search for CSV files
print("Searching for your training CSV files...")
for root, dirs, files in os.walk('/content/drive/MyDrive/'):
    for file in files:
        if 'cookie_training_100k' in file.lower():
            full_path = os.path.join(root, file)
            print(f"  ✅ Found: {full_path}")

print()
print("Copy the directory path from above and update DATA_DIR in the next cell!")
```

## Solution Options

### Option 1: Update the DATA_DIR Path

After running the diagnostic cell above, you'll see where your files actually are. Then update Cell 1:

```python
from google.colab import drive
drive.mount('/content/drive')

# UPDATE THIS PATH based on what you found above
DATA_DIR = '/content/drive/MyDrive/YOUR_ACTUAL_FOLDER_NAME'

print(f"✅ Drive mounted! Data directory: {DATA_DIR}")
```

### Option 2: Use File Browser

1. In Colab, click the **folder icon** 📁 on the left sidebar
2. Navigate to `drive` → `MyDrive`
3. Find your CSV files
4. Right-click on the folder containing them
5. Select **Copy path**
6. Paste that path as your `DATA_DIR`

### Option 3: Upload Directly to Colab (Temporary)

If you want to skip Google Drive entirely:

**Replace Cell 1 with:**
```python
# Upload files directly to Colab (temporary - will be deleted after session)
from google.colab import files
import os

print("📤 Upload your CSV files...")
print("Select both files when prompted:")
print("  - cookie_training_100k_train_80.csv")
print("  - cookie_training_100k_test_20.csv")
print()

uploaded = files.upload()

# Files are now in /content/
DATA_DIR = '/content'

print(f"✅ Files uploaded! Data directory: {DATA_DIR}")
print(f"Uploaded files: {list(uploaded.keys())}")
```

**Note:** Files uploaded this way are temporary and will be deleted when your Colab session ends.

## Common Path Issues

### Issue 1: Folder Name Has Spaces

If your folder is named "Cookie Training Data" (with spaces):

```python
DATA_DIR = '/content/drive/MyDrive/Cookie Training Data'
```

### Issue 2: Files in Subdirectory

If your files are in `MyDrive/Projects/Cookie_Training_Data/`:

```python
DATA_DIR = '/content/drive/MyDrive/Projects/Cookie_Training_Data'
```

### Issue 3: Files in Root of MyDrive

If you uploaded files directly to MyDrive root:

```python
DATA_DIR = '/content/drive/MyDrive'
```

## Verify Files Exist

Add this cell after setting DATA_DIR to verify:

```python
import os

print(f"Checking DATA_DIR: {DATA_DIR}")
print()

# Check if directory exists
if os.path.exists(DATA_DIR):
    print("✅ Directory exists!")
    print()
    print("Contents:")
    for item in os.listdir(DATA_DIR):
        print(f"  - {item}")
else:
    print("❌ Directory does not exist!")
    print("Please update DATA_DIR to the correct path")

print()

# Check for specific files
train_file = f"{DATA_DIR}/cookie_training_100k_train_80.csv"
test_file = f"{DATA_DIR}/cookie_training_100k_test_20.csv"

if os.path.exists(train_file):
    print(f"✅ Training file found: {train_file}")
else:
    print(f"❌ Training file NOT found: {train_file}")

if os.path.exists(test_file):
    print(f"✅ Test file found: {test_file}")
else:
    print(f"❌ Test file NOT found: {test_file}")
```

## Step-by-Step Fix

1. **Run the diagnostic cell** (first code block above)
2. **Find the correct path** from the output
3. **Update DATA_DIR** in Cell 1
4. **Run the verification cell** (last code block above)
5. **Continue with the rest of the notebook**

## Still Having Issues?

Try this alternative approach - load files by browsing:

```python
from google.colab import drive
drive.mount('/content/drive')

# Manual file selection
print("📁 Browse to your files in the left sidebar")
print("Right-click on cookie_training_100k_train_80.csv")
print("Select 'Copy path' and paste below:")
print()

# Paste the full path here
train_file_path = '/content/drive/MyDrive/YOUR_PATH/cookie_training_100k_train_80.csv'
test_file_path = '/content/drive/MyDrive/YOUR_PATH/cookie_training_100k_test_20.csv'

# Load data
import pandas as pd
train_df = pd.read_csv(train_file_path)
test_df = pd.read_csv(test_file_path)

print(f"✅ Loaded {len(train_df):,} training samples")
print(f"✅ Loaded {len(test_df):,} test samples")
```

## Quick Test

Run this single cell to test everything:

```python
from google.colab import drive
import pandas as pd
import os

# Mount drive
drive.mount('/content/drive')

# Try common locations
possible_paths = [
    '/content/drive/MyDrive/Cookie_Training_Data',
    '/content/drive/MyDrive/Cookie Training Data',
    '/content/drive/MyDrive/models/training_data/Training-data-01162026',
    '/content/drive/MyDrive',
]

DATA_DIR = None

for path in possible_paths:
    train_file = f"{path}/cookie_training_100k_train_80.csv"
    if os.path.exists(train_file):
        DATA_DIR = path
        print(f"✅ Found files at: {DATA_DIR}")
        break

if DATA_DIR is None:
    print("❌ Could not find files automatically")
    print("Please check the file browser on the left and update the path manually")
else:
    # Try loading
    train_df = pd.read_csv(f"{DATA_DIR}/cookie_training_100k_train_80.csv")
    test_df = pd.read_csv(f"{DATA_DIR}/cookie_training_100k_test_20.csv")
    print(f"✅ Successfully loaded {len(train_df):,} training samples")
    print(f"✅ Successfully loaded {len(test_df):,} test samples")
```

This will automatically search common locations and load your files!
