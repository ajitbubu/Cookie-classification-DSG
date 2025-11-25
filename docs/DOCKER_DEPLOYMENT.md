# Docker Deployment Guide - Industry-Standard Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx Load Balancer                  │
│                    (Rate Limiting, SSL, Caching)             │
└────────────────┬────────────────────────────┬────────────────┘
                 │                            │
        ┌────────▼────────┐          ┌───────▼────────┐
        │    Frontend     │          │  API Gateway   │
        │   (React/Vite)  │          │   (FastAPI)    │
        └─────────────────┘          └────────┬───────┘
                                              │
                    ┌─────────────────────────┼─────────────────┐
                    │                         │                 │
            ┌───────▼────────┐       ┌───────▼────────┐  ┌────▼──────┐
            │ Scanner Worker 1│       │ Scanner Worker 2│  │  Worker 3 │
            │   (Chromium)    │       │   (Firefox)     │  │(Chromium) │
            └────────┬────────┘       └────────┬────────┘  └─────┬─────┘
                     │                         │                  │
                     └─────────────┬───────────┴──────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Redis (Queue/Cache)    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   PostgreSQL (Persistence)  │
                    └─────────────────────────────┘
```

## Key Features

### 1. **Browser Instance Pooling**
- Reuses browser instances across scans
- 10 browser instances per worker
- 10 contexts per browser = 100 concurrent pages per worker
- **Total capacity: 300 concurrent pages** (3 workers)

### 2. **Distributed Queue System**
- Redis-based job queue
- Horizontal scaling support
- Automatic job distribution
- Progress tracking across workers

### 3. **Caching Layer**
- Redis caching for visited URLs
- Prevents duplicate scanning
- 1-hour TTL for scan results
- Distributed deduplication

### 4. **Load Balancing**
- Nginx reverse proxy
- Least-connection algorithm
- Rate limiting (10 req/s API, 1 req/s scans)
- SSL termination ready

### 5. **Persistence**
- PostgreSQL for long-term storage
- Scan history and analytics
- Cookie database
- Automatic cleanup (7 days)

## Performance Metrics

### Single Worker Performance
- **Concurrency**: 100 pages simultaneously
- **Speed**: ~0.5-1 second per page
- **Throughput**: 60-120 pages/minute
- **Memory**: ~4GB per worker

### Multi-Worker Performance (3 Workers)
- **Concurrency**: 300 pages simultaneously
- **Speed**: ~0.5-1 second per page
- **Throughput**: 180-360 pages/minute
- **Capacity**: 10,000+ pages in 30-60 minutes

### Scaling Potential
- **10 Workers**: 1,000 concurrent pages, 600-1,200 pages/minute
- **50 Workers**: 5,000 concurrent pages, 3,000-6,000 pages/minute
- **100 Workers**: 10,000 concurrent pages, 6,000-12,000 pages/minute

## Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 8GB RAM minimum (16GB recommended)
- 4 CPU cores minimum (8+ recommended)

### 1. Environment Setup

Create `.env` file:
```bash
# Database
DB_PASSWORD=your_secure_password_here

# Redis
REDIS_URL=redis://redis:6379

# Workers
BROWSER_POOL_SIZE=10
MAX_CONCURRENT_PAGES=100

# API
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 2. Build and Start

```bash
# Build all containers
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access Services

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Nginx**: http://localhost:80

### 4. Scale Workers

```bash
# Scale to 5 workers
docker-compose up -d --scale scanner-worker-1=5

# Or add more worker services in docker-compose.yml
```

## Production Deployment

### 1. SSL Configuration

Add SSL certificates to `nginx/ssl/`:
```bash
nginx/ssl/
├── cert.pem
└── key.pem
```

Update `nginx.conf`:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... rest of config
}
```

### 2. Resource Limits

Adjust in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'      # Increase for better performance
      memory: 8G     # Increase for more concurrent scans
    reservations:
      cpus: '2'
      memory: 4G
```

### 3. Monitoring

Add monitoring stack:
```bash
# Prometheus + Grafana
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### 4. Backup Strategy

```bash
# Backup PostgreSQL
docker exec cookie-scanner-db pg_dump -U scanner cookie_scanner > backup.sql

# Backup Redis (if needed)
docker exec cookie-scanner-redis redis-cli SAVE
docker cp cookie-scanner-redis:/data/dump.rdb ./redis-backup.rdb
```

## Performance Tuning

### 1. Browser Pool Size

Increase for more concurrency:
```yaml
environment:
  - BROWSER_POOL_SIZE=20  # Default: 10
  - MAX_CONCURRENT_PAGES=200
```

### 2. Worker Count

Add more workers:
```bash
# Quick scaling
docker-compose up -d --scale scanner-worker-1=10

# Or define in docker-compose.yml
```

### 3. Redis Memory

Increase Redis memory:
```yaml
redis:
  command: redis-server --maxmemory 4gb --maxmemory-policy allkeys-lru
```

### 4. PostgreSQL Tuning

Update `postgresql.conf`:
```
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
max_connections = 200
```

## Monitoring & Debugging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f scanner-worker-1

# Last 100 lines
docker-compose logs --tail=100 api-gateway
```

### Check Resource Usage

```bash
# Container stats
docker stats

# Detailed info
docker-compose top
```

### Redis Monitoring

```bash
# Connect to Redis CLI
docker exec -it cookie-scanner-redis redis-cli

# Check queue size
LLEN scanner:queue:pending

# Check active scans
KEYS scanner:progress:*

# Monitor commands
MONITOR
```

### Database Queries

```bash
# Connect to PostgreSQL
docker exec -it cookie-scanner-db psql -U scanner -d cookie_scanner

# Check scan jobs
SELECT scan_id, status, created_at FROM scan_jobs ORDER BY created_at DESC LIMIT 10;

# Check worker performance
SELECT worker_id, COUNT(*) as jobs, AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
FROM scan_jobs 
WHERE status = 'complete'
GROUP BY worker_id;
```

## Troubleshooting

### Workers Not Processing Jobs

```bash
# Check Redis connection
docker exec scanner-worker-1 redis-cli -h redis ping

# Check queue
docker exec cookie-scanner-redis redis-cli LLEN scanner:queue:pending

# Restart workers
docker-compose restart scanner-worker-1 scanner-worker-2 scanner-worker-3
```

### High Memory Usage

```bash
# Check browser instances
docker exec scanner-worker-1 ps aux | grep chromium

# Reduce pool size
# Update BROWSER_POOL_SIZE in docker-compose.yml
docker-compose up -d
```

### Slow Scanning

```bash
# Check worker stats
docker-compose logs scanner-worker-1 | grep "success rate"

# Increase concurrency
# Update MAX_CONCURRENT_PAGES in docker-compose.yml

# Add more workers
docker-compose up -d --scale scanner-worker-1=5
```

## Cost Estimation

### AWS EC2 Deployment

**Small Setup (1-3 workers)**
- Instance: t3.xlarge (4 vCPU, 16GB RAM)
- Cost: ~$150/month
- Capacity: 300 concurrent pages

**Medium Setup (5-10 workers)**
- Instance: c5.4xlarge (16 vCPU, 32GB RAM)
- Cost: ~$500/month
- Capacity: 1,000 concurrent pages

**Large Setup (20-50 workers)**
- Instance: c5.9xlarge (36 vCPU, 72GB RAM)
- Cost: ~$1,200/month
- Capacity: 5,000 concurrent pages

### Kubernetes Deployment

For massive scale (100+ workers):
- Use Kubernetes for orchestration
- Auto-scaling based on queue size
- Spot instances for cost savings
- Estimated: $2,000-5,000/month for 10,000+ concurrent pages

## Security Best Practices

1. **Change default passwords** in `.env`
2. **Enable SSL** in production
3. **Use secrets management** (AWS Secrets Manager, Vault)
4. **Restrict network access** (VPC, security groups)
5. **Regular updates** (docker images, dependencies)
6. **Rate limiting** (already configured in Nginx)
7. **Input validation** (already implemented in API)

## Maintenance

### Regular Tasks

```bash
# Update images
docker-compose pull
docker-compose up -d

# Clean up old data
docker exec cookie-scanner-db psql -U scanner -d cookie_scanner -c "SELECT cleanup_old_scans();"

# Prune unused resources
docker system prune -a
```

### Backup Schedule

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec cookie-scanner-db pg_dump -U scanner cookie_scanner > backup_$DATE.sql
# Upload to S3 or backup storage
```

---

## Summary

This Docker deployment provides:
- ✅ **10-100x faster** than single-threaded scanning
- ✅ **Horizontal scaling** - add workers as needed
- ✅ **Production-ready** - monitoring, logging, backups
- ✅ **Cost-effective** - efficient resource usage
- ✅ **Industry-standard** - Redis, PostgreSQL, Nginx
- ✅ **Fault-tolerant** - automatic retries, health checks

**Expected Performance**: 
- 100 pages in 1-2 minutes
- 1,000 pages in 5-10 minutes  
- 10,000 pages in 30-60 minutes
- 100,000 pages in 5-8 hours (with 50+ workers)
