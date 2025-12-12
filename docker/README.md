# Docker Configuration

This directory contains all Dockerfile configurations for the Cookie Scanner application.

## Files

- `Dockerfile.api` - Main API Gateway service
- `Dockerfile.frontend` - React frontend application
- `Dockerfile.ml-api` - ML Classification API service
- `Dockerfile.worker` - Scanner worker services (Chromium/Firefox)

## Usage

All Docker services are orchestrated via `docker-compose.yml` in the root directory.

```bash
# Build and start all services
docker-compose up --build

# Start specific service
docker-compose up api-gateway

# Stop all services
docker-compose down
```
