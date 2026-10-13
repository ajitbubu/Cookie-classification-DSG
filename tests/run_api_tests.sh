#!/usr/bin/env bash
#
# Run the in-process API contract suite inside the API Docker image
# (which already has Python 3.10 + all backend deps). No live server needed.
#
#   tests/run_api_tests.sh                     # validates the v6.1 candidate
#   ML_MODEL_VERSION=2.0.0 tests/run_api_tests.sh   # legacy compatibility
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${API_IMAGE:-cookie-classification-dsg-api-gateway:latest}"

# Exercise the native, checksummed candidate by default. Promotion eligibility is
# a separate policy gate and does not prevent runtime contract testing.
MODEL_VERSION="${ML_MODEL_VERSION:-6.1.0}"

echo "Running API tests in $IMAGE  (ML_MODEL_VERSION=$MODEL_VERSION)"
docker run --rm \
  -e ML_MODEL_VERSION="$MODEL_VERSION" \
  -v "$REPO_ROOT":/app -w /app \
  "$IMAGE" \
  bash -c "pip install -q -r requirements-test.txt && python -m pytest tests/backend -v"
