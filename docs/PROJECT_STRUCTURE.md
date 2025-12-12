# Cookie Scanner - Project Structure

This document describes the organization of the Cookie Scanner project.

## Directory Structure

```
cookie-scanner/
├── backend/              # Backend API (Python/FastAPI)
│   ├── api/             # API routes and endpoints
│   │   ├── ml_classifier/  # ML classification system
│   │   ├── ml_routes.py    # ML API routes
│   │   └── routes.py       # Main API routes
│   ├── scanner/         # Cookie scanning logic
│   └── models/          # Data models
│
├── src/                 # Frontend source (React/Vite)
│   ├── components/      # React components
│   ├── lib/            # Utility libraries
│   └── App.jsx         # Main application
│
├── tests/              # All test files
│   ├── ml/            # ML system tests
│   └── backend/       # Backend API tests
│
├── docs/               # Documentation
│   ├── guides/        # Setup and feature guides
│   ├── specs/         # Feature specifications
│   └── task-completion/  # Task completion records
│
├── scripts/            # Utility scripts
│   ├── start-backend.sh    # Start backend server
│   ├── deploy.sh           # Deployment script
│   ├── run_all_ml_tests.py # Run all ML tests
│   └── demo_drift_detection.py  # Drift detection demo
│
├── models/             # ML model files
│   └── v1.0.0/        # Model version directory
│
├── training_data/      # Training datasets
│
├── deployment/         # Deployment configurations
│
├── nginx/             # Nginx configuration
│
├── public/            # Static assets
│
├── dist/              # Production build output
│
└── node_modules/      # Node.js dependencies

```

## Key Files

### Root Level
- `README.md` - Project overview and quick start
- `FEATURES.md` - Feature list and capabilities
- `package.json` - Node.js dependencies and scripts
- `requirements.txt` - Python dependencies
- `vite.config.js` - Vite configuration
- `docker-compose.yml` - Docker orchestration
- `.env` - Environment variables (not in git)
- `.gitignore` - Git ignore patterns

### Docker Files
- `Dockerfile.api` - Backend API container
- `Dockerfile.frontend` - Frontend container
- `Dockerfile.ml-api` - ML API container
- `Dockerfile.worker` - Background worker container

## Quick Navigation

### For Developers
- **Getting Started**: `docs/guides/SETUP.md`
- **Backend Setup**: `docs/guides/BACKEND_SETUP.md`
- **Docker Quick Start**: `docs/guides/QUICK_START_DOCKER.md`
- **Testing Guide**: `docs/TESTING_GUIDE.md`

### For ML Engineers
- **ML Deployment**: `docs/guides/ML_DEPLOYMENT_GUIDE.md`
- **ML System Status**: `docs/guides/ML_SYSTEM_STATUS.md`
- **Drift Detection**: `docs/guides/DRIFT_DETECTION.md`

### For DevOps
- **Docker Deployment**: `docs/DOCKER_DEPLOYMENT.md`
- **Deployment Script**: `scripts/deploy.sh`
- **Troubleshooting**: `docs/guides/TROUBLESHOOTING.md`

## Running the Application

### Development
```bash
# Frontend
npm run dev

# Backend
./scripts/start-backend.sh
# or
python -m uvicorn backend.main:app --reload --port 8001
```

### Testing
```bash
# All tests
python scripts/run_all_ml_tests.py

# ML tests only
pytest tests/ml/

# Backend tests only
pytest tests/backend/
```

### Production
```bash
# Docker
docker-compose up -d

# Or use deployment script
./scripts/deploy.sh
```

## Architecture

The application follows a modern full-stack architecture:

- **Frontend**: React + Vite (SPA)
- **Backend**: FastAPI (Python)
- **ML System**: XGBoost + scikit-learn
- **Database**: SQLite (development) / PostgreSQL (production)
- **Deployment**: Docker + Nginx

For detailed architecture documentation, see `docs/INDUSTRY_STANDARD_ARCHITECTURE.md`.
