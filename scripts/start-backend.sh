#!/bin/bash

# Cookie Scanner Backend Startup Script

echo "🚀 Starting Cookie Scanner Backend..."

# Activate virtual environment
source .venv/bin/activate

# Start the FastAPI server
echo "📡 Starting FastAPI server on http://localhost:8000"
python -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
