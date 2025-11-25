# ML Classification System - Deployment Guide

**Version:** 1.0.0  
**Last Updated:** November 24, 2025

## Overview

This guide provides complete instructions for deploying the ML Cookie Classification System to production.

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **CPU**: 4+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 10GB free space
- **Docker**: 20.10+ (if using containers)
- **Python**: 3.10+
- **PostgreSQL**: 15+
- **Redis**: 7+ (optional, for distributed rate limiting)

### Required Software

```bash
# Install Python 3.10+
sudo apt-get update
sudo apt-get install python3.10 python3.10-venv python3-pip

# Install PostgreSQL
sudo apt-get install postgresql-15 postgresql-contrib

# Install Redis (optional)
sudo apt-get install redis-server

# Install Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cookie_scanner
DB_USER=scanner
DB_PASSWORD=your-secure-password-here

# ML API Configuration
ML_SECRET_KEY=your-secret-key-min-32-characters-long
ML_MODEL_VERSION=1.0.0
ML_CONFIDENCE_HIGH=0.85
ML_CONFIDENCE_MEDIUM=0.65

# Rate Limiting
ML_RATE_LIMIT_REQUESTS=100
ML_RATE_LIMIT_WINDOW=60

# Caching (optional)
ML_CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379

# Logging
ML_LOG_LEVEL=INFO
ML_LOG_ALL_CLASSIFICATIONS=true
```

**Security Notes:**
- Generate `ML_SECRET_KEY` with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- Use strong database passwords
- Never commit `.env` to version control

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### Step 1: Build Images

```bash
# Build ML API image
docker-compose build ml-api

# Verify image
docker images | grep ml-api
```

#### Step 2: Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f ml-api
```

#### Step 3: Verify Deployment

```bash
# Health check
curl http://localhost:8001/api/v1/ml/health

# Model info
curl http://localhost:8001/api/v1/ml/model-info

# Test classification
curl -X POST http://localhost:8001/api/v1/ml/classify \
  -H "Content-Type: application/json" \
  -d '{"cookies":[{"name":"_ga","domain":"example.com"}]}'
```

#### Step 4: Run Migrations

```bash
# Run database migrations
docker-compose exec postgres psql -U scanner -d cookie_scanner \
  -f /docker-entrypoint-initdb.d/001_ml_classification_schema.sql
```

### Method 2: Manual Deployment

#### Step 1: Setup Database

```bash
# Create database
sudo -u postgres createdb cookie_scanner
sudo -u postgres createuser scanner

# Set password
sudo -u postgres psql -c "ALTER USER scanner WITH PASSWORD 'your-password';"

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cookie_scanner TO scanner;"

# Run migrations
psql -U scanner -d cookie_scanner -f backend/db/migrations/001_ml_classification_schema.sql
```

#### Step 2: Install Dependencies

```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Step 3: Deploy Model Files

```bash
# Ensure model directory exists
mkdir -p models/v1.0.0

# Copy model files
cp path/to/trained/model.pkl models/v1.0.0/
cp path/to/features.json models/v1.0.0/
cp path/to/metadata.json models/v1.0.0/

# Verify
ls -la models/v1.0.0/
```

#### Step 4: Start Service

```bash
# Development
python -m backend.main

# Production with Gunicorn
gunicorn backend.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log
```

#### Step 5: Setup Systemd Service (Linux)

Create `/etc/systemd/system/ml-api.service`:

```ini
[Unit]
Description=ML Classification API
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/cookie-scanner
Environment="PATH=/opt/cookie-scanner/venv/bin"
EnvironmentFile=/opt/cookie-scanner/.env
ExecStart=/opt/cookie-scanner/venv/bin/gunicorn backend.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ml-api
sudo systemctl start ml-api
sudo systemctl status ml-api
```

## Configuration

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/ml-api`:

```nginx
upstream ml_api {
    server localhost:8000;
}

server {
    listen 80;
    server_name ml-api.yourdomain.com;

    location / {
        proxy_pass http://ml_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;
    }
}

# Rate limit zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/ml-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL/TLS (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d ml-api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring

### Health Checks

```bash
# Service health
curl http://localhost:8000/api/v1/ml/health

# Expected response:
# {"status":"healthy","model_loaded":true,"model_version":"1.0.0"}
```

### Logs

```bash
# Docker
docker-compose logs -f ml-api

# Systemd
sudo journalctl -u ml-api -f

# Application logs
tail -f logs/ml-api.log
```

### Metrics

```bash
# Get metrics
curl http://localhost:8000/api/v1/ml/metrics

# Monitor key metrics:
# - total_predictions
# - auto_classified
# - avg_confidence
# - correction_rate
# - avg_latency_ms
```

## Scaling

### Horizontal Scaling

#### Docker Compose

```bash
# Scale ML API service
docker-compose up -d --scale ml-api=3

# Verify
docker-compose ps ml-api
```

#### Load Balancer

Update `nginx.conf`:

```nginx
upstream ml_api {
    least_conn;
    server ml-api-1:8000;
    server ml-api-2:8000;
    server ml-api-3:8000;
}
```

### Vertical Scaling

Update resource limits in `docker-compose.yml`:

```yaml
ml-api:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 4G
```

## Backup & Recovery

### Database Backup

```bash
# Backup
pg_dump -U scanner cookie_scanner > backup_$(date +%Y%m%d).sql

# Restore
psql -U scanner cookie_scanner < backup_20251124.sql
```

### Model Backup

```bash
# Backup models
tar -czf models_backup_$(date +%Y%m%d).tar.gz models/

# Restore
tar -xzf models_backup_20251124.tar.gz
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs ml-api

# Common issues:
# 1. Database not ready - wait for postgres health check
# 2. Model files missing - verify models/v1.0.0/ exists
# 3. Port conflict - check if port 8000 is in use
```

### High Latency

```bash
# Check metrics
curl http://localhost:8000/api/v1/ml/metrics

# Solutions:
# 1. Enable Redis caching
# 2. Increase worker count
# 3. Scale horizontally
# 4. Optimize database queries
```

### Rate Limiting Issues

```bash
# Check rate limit headers
curl -I http://localhost:8000/api/v1/ml/health

# Adjust limits in .env:
ML_RATE_LIMIT_REQUESTS=200
ML_RATE_LIMIT_WINDOW=60
```

### Model Loading Failures

```bash
# Verify model files
ls -la models/v1.0.0/

# Required files:
# - model.pkl
# - features.json
# - metadata.json

# Check permissions
chmod 644 models/v1.0.0/*
```

## Security Checklist

- [ ] Change default `ML_SECRET_KEY`
- [ ] Use strong database passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring/alerting
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Access logging enabled
- [ ] Environment variables secured

## Rollback Procedure

### Docker

```bash
# Stop current version
docker-compose down ml-api

# Restore previous image
docker tag ml-api:previous ml-api:latest

# Restart
docker-compose up -d ml-api
```

### Manual

```bash
# Stop service
sudo systemctl stop ml-api

# Restore previous code
git checkout previous-version

# Restore previous model
cp models_backup/v1.0.0/* models/v1.0.0/

# Restart
sudo systemctl start ml-api
```

## Performance Tuning

### Database

```sql
-- Add indexes
CREATE INDEX CONCURRENTLY idx_cookies_name ON cookies(name);
CREATE INDEX CONCURRENTLY idx_cookies_domain ON cookies(domain);

-- Vacuum
VACUUM ANALYZE cookies;
VACUUM ANALYZE ml_classifications;
```

### Application

```python
# Increase worker count
gunicorn --workers 8 backend.main:app

# Enable caching
ML_CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
```

## Maintenance

### Regular Tasks

**Daily:**
- Check service health
- Monitor error logs
- Review metrics

**Weekly:**
- Database backup
- Log rotation
- Security updates

**Monthly:**
- Model retraining
- Performance review
- Capacity planning

## Support

### Getting Help

- Documentation: `/docs/specs/`
- Status: `ML_SYSTEM_STATUS.md`
- Issues: Check logs first
- Contact: Your DevOps team

### Useful Commands

```bash
# Service status
docker-compose ps
systemctl status ml-api

# Resource usage
docker stats ml-api
htop

# Network
netstat -tulpn | grep 8000
ss -tulpn | grep 8000

# Database
psql -U scanner -d cookie_scanner -c "SELECT COUNT(*) FROM ml_classifications;"
```

---

**Deployment Complete!** 🚀

Your ML Classification System is now running in production.
