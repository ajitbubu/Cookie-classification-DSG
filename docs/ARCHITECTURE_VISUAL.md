# Visual Architecture Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Browser    │  │   Mobile     │  │     API      │              │
│  │   (React)    │  │     App      │  │   Clients    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LOAD BALANCER LAYER                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Nginx Load Balancer                       │   │
│  │  • SSL Termination                                           │   │
│  │  • Rate Limiting (10 req/s API, 1 req/s scans)              │   │
│  │  • Caching                                                   │   │
│  │  • Health Checks                                             │   │
│  │  • Least-Connection Algorithm                                │   │
│  └────────────────────┬────────────────────────────────────────┘   │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│   Frontend       │        │   API Gateway    │
│   (React/Vite)   │        │   (FastAPI)      │
│                  │        │                  │
│  • UI/UX         │        │  • REST API      │
│  • Real-time     │        │  • WebSocket/SSE │
│  • Progress      │        │  • Job Queue     │
│  • History       │        │  • Auth          │
└──────────────────┘        └────────┬─────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                  │
                    ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKER LAYER                                 │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Worker 1   │  │   Worker 2   │  │   Worker N   │             │
│  │  (Chromium)  │  │  (Firefox)   │  │  (Chromium)  │             │
│  │              │  │              │  │              │             │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │             │
│  │ │ Browser  │ │  │ │ Browser  │ │  │ │ Browser  │ │             │
│  │ │  Pool    │ │  │ │  Pool    │ │  │ │  Pool    │ │             │
│  │ │ (10 inst)│ │  │ │ (10 inst)│ │  │ │ (10 inst)│ │             │
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │             │
│  │      │       │  │      │       │  │      │       │             │
│  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │             │
│  │ │ Context  │ │  │ │ Context  │ │  │ │ Context  │ │             │
│  │ │  Pool    │ │  │ │  Pool    │ │  │ │  Pool    │ │             │
│  │ │(100 ctx) │ │  │ │(100 ctx) │ │  │ │(100 ctx) │ │             │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │             │
│  │              │  │              │  │              │             │
│  │ Concurrency: │  │ Concurrency: │  │ Concurrency: │             │
│  │ 100 pages    │  │ 100 pages    │  │ 100 pages    │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      QUEUE & CACHE LAYER                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         Redis                                │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │  Job Queue   │  │    Cache     │  │   Pub/Sub    │     │   │
│  │  │              │  │              │  │              │     │   │
│  │  │ • Pending    │  │ • Results    │  │ • Progress   │     │   │
│  │  │ • Processing │  │ • URLs       │  │ • Events     │     │   │
│  │  │ • Failed     │  │ • Sessions   │  │ • Alerts     │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  │                                                              │   │
│  │  Max Memory: 2GB | Policy: allkeys-lru | TTL: 1 hour       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL                              │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │  scan_jobs   │  │   cookies    │  │ page_results │     │   │
│  │  │              │  │              │  │              │     │   │
│  │  │ • ID         │  │ • Name       │  │ • URL        │     │   │
│  │  │ • Status     │  │ • Domain     │  │ • Duration   │     │   │
│  │  │ • Worker     │  │ • Category   │  │ • Cookies    │     │   │
│  │  │ • Created    │  │ • Type       │  │ • Error      │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  │                                                              │   │
│  │  Indexes: scan_id, domain, created_at                       │   │
│  │  Cleanup: Auto-delete after 7 days                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Scan Request Flow
```
User → Frontend → Nginx → API Gateway → Redis Queue
                                            │
                                            ▼
                                    Worker picks job
                                            │
                                            ▼
                                    Browser Pool
                                            │
                                            ▼
                                    Scan Pages (parallel)
                                            │
                                            ▼
                                    Store in Redis
                                            │
                                            ▼
                                    Save to PostgreSQL
                                            │
                                            ▼
                                    Return to User
```

### 2. Progress Update Flow
```
Worker → Redis Pub/Sub → API Gateway → SSE → Frontend
         (real-time)      (streaming)   (live)  (display)
```

### 3. Caching Flow
```
Request → Check Redis Cache
            │
            ├─ Hit → Return cached result (instant)
            │
            └─ Miss → Scan website → Cache result → Return
```

## Scaling Patterns

### Horizontal Scaling (Add Workers)
```
Before:                    After:
┌─────────┐               ┌─────────┐ ┌─────────┐ ┌─────────┐
│Worker 1 │               │Worker 1 │ │Worker 2 │ │Worker 3 │
│100 pages│               │100 pages│ │100 pages│ │100 pages│
└─────────┘               └─────────┘ └─────────┘ └─────────┘
Capacity: 100             Capacity: 300 pages
```

### Vertical Scaling (Increase Concurrency)
```
Before:                    After:
┌─────────┐               ┌─────────┐
│Worker 1 │               │Worker 1 │
│100 pages│               │200 pages│
└─────────┘               └─────────┘
Capacity: 100             Capacity: 200 pages
```

### Browser Pool Scaling
```
1 Worker = 10 Browsers × 10 Contexts = 100 Concurrent Pages

┌──────────────────────────────────────────┐
│              Worker 1                     │
│                                           │
│  Browser 1 ─┬─ Context 1 (Page 1)       │
│             ├─ Context 2 (Page 2)       │
│             └─ ... (10 contexts)         │
│                                           │
│  Browser 2 ─┬─ Context 1 (Page 11)      │
│             └─ ... (10 contexts)         │
│                                           │
│  ...                                      │
│                                           │
│  Browser 10 ─┬─ Context 1 (Page 91)     │
│              └─ Context 10 (Page 100)    │
└──────────────────────────────────────────┘
```

## Performance Metrics

### Throughput Calculation
```
Single Worker:
- Concurrency: 100 pages
- Time per page: 1 second
- Throughput: 100 pages/second (theoretical)
- Actual: 60-120 pages/minute (network overhead)

3 Workers:
- Concurrency: 300 pages
- Throughput: 180-360 pages/minute

10 Workers:
- Concurrency: 1,000 pages
- Throughput: 600-1,200 pages/minute

50 Workers:
- Concurrency: 5,000 pages
- Throughput: 3,000-6,000 pages/minute
```

### Latency Breakdown
```
Total Scan Time = Queue Time + Scan Time + Processing Time

Queue Time:     0-5 seconds (depends on worker availability)
Scan Time:      0.5-1 second per page (parallel)
Processing Time: 0.1-0.2 seconds (cookie classification)

Example for 100 pages:
- Queue: 2 seconds
- Scan: 60 seconds (100 pages / 100 concurrency × 60s)
- Processing: 10 seconds
- Total: ~72 seconds
```

## Resource Usage

### Per Worker
```
CPU:    2 cores (recommended)
Memory: 4GB (with 10 browsers)
Disk:   10GB (logs, cache)
Network: 100 Mbps (scanning)
```

### Total System (3 Workers)
```
CPU:    8 cores (2 per worker + 2 for services)
Memory: 16GB (12GB workers + 4GB services)
Disk:   50GB (30GB workers + 20GB database)
Network: 1 Gbps (recommended)
```

## Deployment Topologies

### Single Server
```
┌─────────────────────────────────┐
│         Single Server            │
│                                  │
│  ┌────────┐  ┌────────┐         │
│  │Frontend│  │  API   │         │
│  └────────┘  └────────┘         │
│                                  │
│  ┌────────┐  ┌────────┐         │
│  │Worker 1│  │Worker 2│         │
│  └────────┘  └────────┘         │
│                                  │
│  ┌────────┐  ┌────────┐         │
│  │ Redis  │  │Postgres│         │
│  └────────┘  └────────┘         │
└─────────────────────────────────┘
```

### Multi-Server
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Server 1 │  │ Server 2 │  │ Server 3 │
│          │  │          │  │          │
│ Frontend │  │   API    │  │ Workers  │
│  Nginx   │  │ Gateway  │  │  (1-10)  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └─────────────┴─────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────▼────┐          ┌─────▼────┐
   │  Redis  │          │PostgreSQL│
   │ Cluster │          │  Master  │
   └─────────┘          └──────────┘
```

### Kubernetes
```
┌─────────────────────────────────────────┐
│         Kubernetes Cluster               │
│                                          │
│  ┌────────────────────────────────┐    │
│  │      Ingress Controller         │    │
│  └──────────┬─────────────────────┘    │
│             │                            │
│  ┌──────────▼──────────┐                │
│  │   Frontend Service   │                │
│  │   (3 replicas)       │                │
│  └──────────────────────┘                │
│                                          │
│  ┌──────────────────────┐                │
│  │    API Service       │                │
│  │   (5 replicas)       │                │
│  └──────────────────────┘                │
│                                          │
│  ┌──────────────────────┐                │
│  │   Worker Deployment  │                │
│  │   (Auto-scaling)     │                │
│  │   Min: 3, Max: 100   │                │
│  └──────────────────────┘                │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │  Redis   │  │PostgreSQL│            │
│  │StatefulSet│ │StatefulSet│            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

## Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────┐
│                  Cookie Scanner Dashboard                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Active Scans: 5        Queue Size: 23                  │
│  Workers: 10/10         Success Rate: 98.5%             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Throughput (pages/min)                          │  │
│  │  ▁▂▃▅▇█████████████▇▅▃▂▁                        │  │
│  │  Current: 850 pages/min                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Worker Status                                    │  │
│  │  Worker 1: ████████░░ 80% (80/100 pages)        │  │
│  │  Worker 2: ██████████ 100% (100/100 pages)      │  │
│  │  Worker 3: ██████░░░░ 60% (60/100 pages)        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Resource Usage                                   │  │
│  │  CPU: 65%    Memory: 12GB/16GB    Network: 45Mbps│  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

This visual guide provides a comprehensive overview of the system architecture, data flows, scaling patterns, and deployment topologies.
