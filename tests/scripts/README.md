# Test Scripts

This directory contains all test scripts for the Cookie Scanner application.

## Available Scripts

### Quick Scan Tests
- `test_quick_scan.sh` - Basic quick scan functionality test
- `test_scan_pages.sh` - Multi-page scanning test

### Deep Scan Tests
- `test_deep_scan.py` - Python-based deep scan test
- `test_deep_scan_simple.sh` - Simple deep scan test
- `test_deep_scan_simple2.sh` - Alternative deep scan test
- `test_deep_scan_fix.sh` - Deep scan with fixes
- `test_deep_scan_with_cookies.py` - Deep scan with cookie handling

### ML Tests
- `test_ml_classification.py` - ML classification functionality test
- `test_model_v2.py` - ML model v2 testing

### Streaming Tests
- `test_streaming_scan.py` - Streaming scan functionality test

### Domain-Specific Tests
- `test_xfinity_scan.sh` - Xfinity domain scan test

## Usage

```bash
# Run from project root
./tests/scripts/test_quick_scan.sh

# Or run Python tests
python tests/scripts/test_ml_classification.py
```
