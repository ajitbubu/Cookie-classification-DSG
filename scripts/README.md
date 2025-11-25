# Scripts

This directory contains utility scripts for the Cookie Scanner application.

## Available Scripts

### Development Scripts

- **`start-backend.sh`** - Start the backend API server
  ```bash
  ./scripts/start-backend.sh
  ```

- **`deploy.sh`** - Deploy the application
  ```bash
  ./scripts/deploy.sh
  ```

### Testing Scripts

- **`run_all_ml_tests.py`** - Run all ML-related tests
  ```bash
  python scripts/run_all_ml_tests.py
  ```

### Demo Scripts

- **`demo_drift_detection.py`** - Demonstrate drift detection functionality
  ```bash
  python scripts/demo_drift_detection.py
  ```

## Usage

Make sure scripts are executable:
```bash
chmod +x scripts/*.sh
```

Run from project root:
```bash
./scripts/start-backend.sh
```
