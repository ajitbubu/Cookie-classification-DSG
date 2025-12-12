# Migration Guide - Project Refactoring

This guide helps you update any scripts, references, or workflows after the project structure refactoring.

## What Changed?

The project was reorganized to improve maintainability and clarity. Files were moved from the root directory into organized subdirectories.

## Path Changes

### Docker Files
```bash
# Old paths
Dockerfile.api
Dockerfile.frontend
Dockerfile.ml-api
Dockerfile.worker

# New paths
docker/Dockerfile.api
docker/Dockerfile.frontend
docker/Dockerfile.ml-api
docker/Dockerfile.worker
```

**Action Required:** `docker-compose.yml` has been updated automatically. If you have custom Docker scripts, update the paths.

### Test Scripts
```bash
# Old paths (root directory)
test_quick_scan.sh
test_deep_scan.py
test_deep_scan_simple.sh
test_deep_scan_simple2.sh
test_deep_scan_fix.sh
test_deep_scan_with_cookies.py
test_ml_classification.py
test_model_v2.py
test_scan_pages.sh
test_streaming_scan.py
test_xfinity_scan.sh

# New paths
tests/scripts/test_quick_scan.sh
tests/scripts/test_deep_scan.py
tests/scripts/test_deep_scan_simple.sh
tests/scripts/test_deep_scan_simple2.sh
tests/scripts/test_deep_scan_fix.sh
tests/scripts/test_deep_scan_with_cookies.py
tests/scripts/test_ml_classification.py
tests/scripts/test_model_v2.py
tests/scripts/test_scan_pages.sh
tests/scripts/test_streaming_scan.py
tests/scripts/test_xfinity_scan.sh
```

**Action Required:** Update any CI/CD pipelines or scripts that reference these test files.

### Documentation Files
```bash
# Old paths (root directory)
ACCESSIBILITY.md
APPLICATION_STATUS.md
BROWSER_CACHE_FIX.md
COLAB_FIX_UPDATED.md
FEATURES.md
FIXES_SUMMARY.md
ISSUE_RESOLUTION_SUMMARY.md
LARGE_SCAN_LIMITATIONS.md
ML_UNCLASSIFIED_FIX.md
PLAYWRIGHT_FIX.md
PROJECT_STRUCTURE.md
QUICK_FIX_REFERENCE.md
QUICK_START_COLAB.md
SCHEDULE_SCAN_FIX.md
TASK_8_COMPLETION_SUMMARY.md
TESTING_COMPLETE.md
TEST_EXECUTION_PLAN.md
TEST_RESULTS.md

# New paths
docs/ACCESSIBILITY.md
docs/APPLICATION_STATUS.md
docs/BROWSER_CACHE_FIX.md
docs/COLAB_FIX_UPDATED.md
docs/FEATURES.md
docs/FIXES_SUMMARY.md
docs/ISSUE_RESOLUTION_SUMMARY.md
docs/LARGE_SCAN_LIMITATIONS.md
docs/ML_UNCLASSIFIED_FIX.md
docs/PLAYWRIGHT_FIX.md
docs/PROJECT_STRUCTURE.md
docs/QUICK_FIX_REFERENCE.md
docs/QUICK_START_COLAB.md
docs/SCHEDULE_SCAN_FIX.md
docs/TASK_8_COMPLETION_SUMMARY.md
docs/TESTING_COMPLETE.md
docs/TEST_EXECUTION_PLAN.md
docs/TEST_RESULTS.md
```

**Action Required:** Update any documentation links in your code or external references.

### Utility Scripts
```bash
# Old paths (root directory)
extract_urls.py
extract_urls_from_json.py
fix_label_encoder.py

# New paths
scripts/extract_urls.py
scripts/extract_urls_from_json.py
scripts/fix_label_encoder.py
```

**Action Required:** Update import paths if these scripts are referenced elsewhere.

### Data & Output Files
```bash
# Old paths (root directory)
page-scan.json
page_scan_urls.xlsx
sitemap.xml
sitemap_urls.xlsx
backend.log

# New paths
data/output/page-scan.json
data/output/page_scan_urls.xlsx
data/output/sitemap.xml
data/output/sitemap_urls.xlsx
data/output/backend.log
```

**Action Required:** Update any scripts that read/write these files.

### Removed
```bash
# Deleted (duplicate of .venv)
venv/
```

**Action Required:** If you were using `venv/`, switch to `.venv/` instead.

## Quick Update Commands

### Update Test Script Calls
If you have scripts that call test files:

```bash
# Old
./test_quick_scan.sh

# New
./tests/scripts/test_quick_scan.sh
```

### Update Python Imports
If you import utility scripts:

```python
# Old
from extract_urls import extract_urls

# New
from scripts.extract_urls import extract_urls
```

### Update Docker Commands
Docker Compose has been updated automatically, but if you have custom build commands:

```bash
# Old
docker build -f Dockerfile.api -t cookie-scanner-api .

# New
docker build -f docker/Dockerfile.api -t cookie-scanner-api .
```

### Update File Paths in Code
Search your codebase for hardcoded paths:

```bash
# Find references to old paths
grep -r "test_quick_scan.sh" .
grep -r "Dockerfile.api" .
grep -r "page-scan.json" .
```

## CI/CD Updates

If you have CI/CD pipelines (GitHub Actions, GitLab CI, etc.), update:

1. **Test commands:**
   ```yaml
   # Old
   - run: ./test_quick_scan.sh
   
   # New
   - run: ./tests/scripts/test_quick_scan.sh
   ```

2. **Docker build contexts:**
   ```yaml
   # Old
   dockerfile: Dockerfile.api
   
   # New
   dockerfile: docker/Dockerfile.api
   ```

3. **Artifact paths:**
   ```yaml
   # Old
   path: page-scan.json
   
   # New
   path: data/output/page-scan.json
   ```

## Verification Checklist

After updating your references, verify:

- [ ] All test scripts run successfully
- [ ] Docker Compose builds and starts all services
- [ ] Documentation links work correctly
- [ ] CI/CD pipelines pass
- [ ] Output files are generated in correct locations
- [ ] No broken imports in Python/JavaScript code

## Need Help?

If you encounter issues after the refactoring:

1. Check the [Project Structure Guide](./PROJECT_STRUCTURE_GUIDE.md)
2. Review the README files in each directory
3. Search for old paths in your codebase: `grep -r "old_path" .`
4. Open an issue if you find broken references

## Benefits of New Structure

- **Cleaner root directory** - Only 14 files instead of 40+
- **Better organization** - Related files grouped together
- **Easier navigation** - Clear directory purposes
- **Improved maintainability** - Logical file locations
- **Better gitignore** - Organized exclusion patterns
