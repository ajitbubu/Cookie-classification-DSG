# Project Structure Guide

This document provides a comprehensive overview of the Cookie Scanner project structure after refactoring.

## Directory Overview

### `/backend` - Python Backend Services
Core API and scanning functionality built with FastAPI and Playwright.

```
backend/
├── api/              # REST API endpoints
├── db/               # Database models and migrations
├── scanner/          # Cookie scanning engine
├── worker/           # Background job workers
├── config.py         # Configuration management
├── main.py           # Application entry point
└── models.py         # Data models
```

### `/src` - React Frontend
Modern React application for the user interface.

```
src/
├── components/       # Reusable React components
├── lib/              # Utilities and core logic
├── test/             # Frontend unit tests
├── App.jsx           # Main application component
├── App.css           # Application styles
└── main.jsx          # Entry point
```

### `/tests` - Test Suite
Comprehensive testing infrastructure.

```
tests/
├── backend/          # Backend API tests
├── ml/               # ML model tests
├── scripts/          # Test execution scripts
│   ├── test_quick_scan.sh
│   ├── test_deep_scan.py
│   ├── test_ml_classification.py
│   └── ...
└── README.md
```

### `/docs` - Documentation
All project documentation organized by type.

```
docs/
├── guides/           # User and developer guides
├── specs/            # Technical specifications
├── task-completion/  # Task summaries
├── ARCHITECTURE_DIAGRAM.md
├── DEEP_SCAN_IMPLEMENTATION.md
├── GOOGLE_COLAB_TRAINING_GUIDE.md
├── TESTING_GUIDE.md
└── ...
```

### `/docker` - Docker Configuration
All Dockerfile configurations for containerized services.

```
docker/
├── Dockerfile.api          # Main API Gateway
├── Dockerfile.frontend     # React frontend
├── Dockerfile.ml-api       # ML Classification API
├── Dockerfile.worker       # Scanner workers
└── README.md
```

### `/scripts` - Utility Scripts
Helper scripts for development and deployment.

```
scripts/
├── add_vendor_patterns.py
├── load_vendor_patterns.py
├── package_for_colab.py
├── start-backend.sh
├── deploy.sh
└── README.md
```

### `/data` - Data Files
Application data and generated outputs.

```
data/
├── vendor_patterns.json
├── vendor_packages_all.json
└── output/                 # Generated files (gitignored)
    ├── *.xlsx
    ├── *.json
    ├── *.xml
    └── *.log
```

### `/models` - ML Models
Machine learning models for cookie classification.

```
models/
├── v1.0.0/           # Model version 1
├── v2.0.0/           # Model version 2
└── training_data/    # Training datasets
```

### `/deployment` - Deployment Configuration
Production deployment configurations.

```
deployment/
├── monitoring/       # Monitoring configs
└── nginx/            # Nginx configurations
```

### `/nginx` - Nginx Configuration
Load balancer and reverse proxy configuration.

```
nginx/
├── nginx.conf        # Main configuration
└── ssl/              # SSL certificates
```

## Root Level Files

### Configuration Files
- `docker-compose.yml` - Multi-container orchestration
- `package.json` - Node.js dependencies
- `requirements.txt` - Python dependencies
- `vite.config.js` - Vite build configuration
- `vitest.config.js` - Test configuration
- `.eslintrc.json` - ESLint rules
- `.env` - Environment variables (gitignored)

### Documentation Files
- `README.md` - Main project documentation
- `ACCESSIBILITY.md` - Accessibility guidelines
- `FEATURES.md` - Feature documentation

## Key Improvements from Refactoring

### Before
- 20+ markdown files in root
- 10+ test scripts scattered in root
- Data files mixed with code
- 4 Dockerfiles in root
- Duplicate venv folders

### After
- Clean root with only essential configs
- All docs organized in `/docs`
- All tests in `/tests/scripts`
- All Dockerfiles in `/docker`
- All output files in `/data/output`
- Single `.venv` directory

## Development Workflow

### Running Tests
```bash
# Backend tests
python -m pytest tests/backend/

# ML tests
python tests/scripts/test_ml_classification.py

# Quick scan test
./tests/scripts/test_quick_scan.sh
```

### Docker Development
```bash
# Build and start all services
docker-compose up --build

# Start specific service
docker-compose up api-gateway

# View logs
docker-compose logs -f ml-api
```

### Frontend Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test
```

## File Naming Conventions

- **Python files**: `snake_case.py`
- **JavaScript files**: `PascalCase.jsx` (components), `camelCase.js` (utilities)
- **Test files**: `test_*.py`, `test_*.sh`, `*.test.jsx`
- **Documentation**: `UPPERCASE.md` (major docs), `lowercase.md` (guides)
- **Configuration**: `lowercase.config.js`, `.lowercase`

## Gitignore Strategy

The following are excluded from version control:
- `node_modules/` and `.venv/` - Dependencies
- `data/output/*` - Generated files
- `*.log` - Log files
- `.env` - Environment variables
- `dist/` and `build/` - Build artifacts
- `.DS_Store` - OS files

## Best Practices

1. **Keep root clean** - Only essential config files in root
2. **Organize by function** - Group related files together
3. **Document changes** - Update relevant README files
4. **Test organization** - Keep tests near related code
5. **Clear naming** - Use descriptive, consistent names

## Migration Notes

If you have scripts or references to old paths, update them:

- `Dockerfile.api` → `docker/Dockerfile.api`
- `test_quick_scan.sh` → `tests/scripts/test_quick_scan.sh`
- `FIXES_SUMMARY.md` → `docs/FIXES_SUMMARY.md`
- `page-scan.json` → `data/output/page-scan.json`

## Questions?

See the README files in each directory for more specific information, or check the main project README.md.
