#!/bin/bash

# Cookie Scanner - Deployment Script
# Industry-standard deployment with Docker

set -e

echo "🚀 Cookie Scanner - Docker Deployment"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Check .env file
if [ ! -f .env ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# Database
DB_PASSWORD=$(openssl rand -base64 32)

# Redis
REDIS_URL=redis://redis:6379

# Workers
BROWSER_POOL_SIZE=10
MAX_CONCURRENT_PAGES=100
BROWSER_TYPE=chromium

# API
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:80
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Frontend
VITE_API_URL=http://localhost:8000
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Parse arguments
MODE=${1:-dev}
WORKERS=${2:-3}

echo -e "\n${YELLOW}Deployment Mode: ${MODE}${NC}"
echo -e "${YELLOW}Worker Count: ${WORKERS}${NC}"

# Build images
echo -e "\n${YELLOW}Building Docker images...${NC}"
docker-compose build

# Start services
echo -e "\n${YELLOW}Starting services...${NC}"

if [ "$MODE" == "prod" ]; then
    # Production mode
    docker-compose up -d
    
    # Scale workers
    if [ "$WORKERS" -gt 3 ]; then
        echo -e "\n${YELLOW}Scaling workers to ${WORKERS}...${NC}"
        docker-compose up -d --scale scanner-worker-1=$WORKERS --no-recreate
    fi
else
    # Development mode
    docker-compose up -d redis postgres
    echo -e "${GREEN}✅ Redis and PostgreSQL started${NC}"
    echo -e "${YELLOW}Run 'docker-compose up api-gateway scanner-worker-1 frontend' to start other services${NC}"
fi

# Wait for services to be healthy
echo -e "\n${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
echo -e "\n${YELLOW}Checking service health...${NC}"

if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Services are running${NC}"
else
    echo -e "${RED}❌ Some services failed to start${NC}"
    docker-compose ps
    exit 1
fi

# Display status
echo -e "\n${GREEN}======================================"
echo "✅ Deployment Complete!"
echo "======================================${NC}"

echo -e "\n${YELLOW}Access Points:${NC}"
echo "  Frontend:  http://localhost:5173"
echo "  API:       http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Nginx:     http://localhost:80"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo "  View logs:        docker-compose logs -f"
echo "  Check status:     docker-compose ps"
echo "  Stop services:    docker-compose down"
echo "  Scale workers:    docker-compose up -d --scale scanner-worker-1=10"
echo "  View stats:       docker stats"

echo -e "\n${YELLOW}Monitoring:${NC}"
echo "  Redis queue:      docker exec cookie-scanner-redis redis-cli LLEN scanner:queue:pending"
echo "  Database:         docker exec -it cookie-scanner-db psql -U scanner -d cookie_scanner"

echo -e "\n${GREEN}Happy scanning! 🍪${NC}\n"
