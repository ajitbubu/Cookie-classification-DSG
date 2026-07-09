#!/usr/bin/env bash
#
# Run the in-process API contract suite inside the API Docker image
# (which already has Python 3.10 + all backend deps). No live server needed.
#
#   tests/run_api_tests.sh                     # uses a complete model (v3.0.0)
#   ML_MODEL_VERSION=6.0.0 tests/run_api_tests.sh   # reproduce the v6 gap
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${API_IMAGE:-cookie-classification-dsg-api-gateway:latest}"

# The app defaults to ML_MODEL_VERSION=6.0.0, which ships without a model.pkl.
# Default the suite to 3.0.0 (a complete model) so a green run proves the API +
# ML pipeline are correct; override to 6.0.0 to see the missing-artifact failure.
MODEL_VERSION="${ML_MODEL_VERSION:-3.0.0}"

echo "Running API tests in $IMAGE  (ML_MODEL_VERSION=$MODEL_VERSION)"
docker run --rm \
  -e ML_MODEL_VERSION="$MODEL_VERSION" \
  -v "$REPO_ROOT":/app -w /app \
  "$IMAGE" \
  bash -c "pip install -q -r requirements-test.txt && python -m pytest tests/backend -v"
