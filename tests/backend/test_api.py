"""In-process contract tests for the Cookie Scanner API.

Run (inside the API Docker image, which has the right Python + deps):
    tests/run_api_tests.sh

Each test hits a real endpoint via TestClient and asserts status + shape.
"Working or not" == this suite green or red.

Endpoints that need the trained ML model (classify, model-info) depend on
the ML_MODEL_VERSION env var (default "6.0.0"). v6.0.0 ships without a
model.pkl, so those tests fail on the default and pass when pointed at a
complete version (e.g. ML_MODEL_VERSION=3.0.0).
"""
import pytest


# --------------------------------------------------------------------------
# Core service health + API meta
# --------------------------------------------------------------------------

def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert "version" in body


def test_openapi_schema_published(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    schema = r.json()
    # every endpoint the frontend proxies lives under /api
    assert any(p.startswith("/api") for p in schema["paths"])


def test_swagger_docs_served(client):
    assert client.get("/docs").status_code == 200


# --------------------------------------------------------------------------
# Category endpoints (no external state required)
# --------------------------------------------------------------------------

def test_available_categories(client):
    r = client.get("/api/categories/available-categories")
    assert r.status_code == 200
    assert r.json()  # non-empty payload


def test_patterns(client):
    r = client.get("/api/categories/patterns")
    assert r.status_code == 200


# --------------------------------------------------------------------------
# ML endpoints that do NOT require the trained model to be loaded
# --------------------------------------------------------------------------

def test_ml_health(client):
    r = client.get("/api/v1/ml/health")
    assert r.status_code == 200


def test_ml_metrics(client):
    r = client.get("/api/v1/ml/metrics")
    assert r.status_code == 200


def test_ml_drift_status(client):
    r = client.get("/api/v1/ml/drift/status")
    assert r.status_code == 200


# --------------------------------------------------------------------------
# ML endpoints that DO require the trained model
# (green with ML_MODEL_VERSION=3.0.0; red on the default v6.0.0)
# --------------------------------------------------------------------------

def test_model_info(client):
    r = client.get("/api/v1/ml/model-info")
    assert r.status_code == 200, (
        "model-info 500s when the configured ML_MODEL_VERSION has no model.pkl"
    )


def test_classify_single_cookie(client):
    payload = {
        "cookies": [
            {"name": "_ga", "domain": ".example.com", "value": "GA1.2.1", "path": "/"}
        ]
    }
    r = client.post("/api/v1/ml/classify", json=payload)
    assert r.status_code == 200, (
        "classify 500s when the configured ML_MODEL_VERSION has no model.pkl"
    )
    body = r.json()
    assert isinstance(body, (dict, list))


# --------------------------------------------------------------------------
# Request validation (proves schemas + FastAPI wiring, no model needed)
# --------------------------------------------------------------------------

def test_scan_rejects_invalid_scan_type(client):
    r = client.post("/api/scan", json={"url": "https://example.com", "scanType": "bogus"})
    assert r.status_code == 422


def test_scan_requires_url(client):
    r = client.post("/api/scan", json={"scanType": "quick"})
    assert r.status_code == 422


def test_classify_requires_cookies(client):
    r = client.post("/api/v1/ml/classify", json={})
    assert r.status_code == 422


# --------------------------------------------------------------------------
# Negative routing
# --------------------------------------------------------------------------

def test_unknown_api_route_404(client):
    assert client.get("/api/does-not-exist").status_code == 404


def test_wrong_method_405(client):
    # /api/scan is POST-only
    assert client.get("/api/scan").status_code == 405
