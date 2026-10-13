"""In-process contract tests for the Cookie Scanner API.

Run (inside the API Docker image, which has the right Python + deps):
    tests/run_api_tests.sh

Each test hits a real endpoint via TestClient and asserts status + shape.
"Working or not" == this suite green or red.

Endpoints that need the trained ML model depend on ML_MODEL_VERSION. The API test
runner validates the native v6.1 candidate by default while retaining explicit
legacy-version compatibility checks when the environment variable is overridden.
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
    assert r.status_code in {200, 503}
    if r.status_code == 503:
        assert "unavailable" in r.json()["detail"].lower()


def test_ml_metrics(client):
    r = client.get("/api/v1/ml/metrics")
    assert r.status_code == 200
    body = r.json()
    assert body["data_status"] == "unavailable"
    assert body["total_predictions"] == 0
    assert body["category_distribution"] == {
        "strictly_necessary": 0,
        "analytics": 0,
        "marketing": 0,
        "functional": 0,
        "unknown": 0,
    }


def test_ml_drift_status(client):
    r = client.get("/api/v1/ml/drift/status")
    assert r.status_code == 200


# --------------------------------------------------------------------------
# ML endpoints that DO require the trained model
# (green with a structurally valid configured artifact)
# --------------------------------------------------------------------------

def test_model_info(client):
    r = client.get("/api/v1/ml/model-info")
    assert r.status_code == 200, (
        "model-info 500s when the configured ML_MODEL_VERSION has no model.pkl"
    )
    body = r.json()
    allowed = {
        "Analytics", "Functional", "Marketing", "Strictly Necessary", "Unclassified"
    }
    assert set(body["categories"]).issubset(allowed)
    assert {"Analytics", "Functional", "Marketing", "Strictly Necessary"}.issubset(
        body["categories"]
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


def test_classification_threshold_creates_abstention(client):
    payload = {
        "cookies": [{"name": "_ga", "domain": ".example.com"}],
        "options": {
            "return_explanation": False,
            "find_similar": False,
            "confidence_threshold": 1.0,
            "auto_classify": False,
        },
    }
    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200
    classification = r.json()["classifications"][0]
    assert classification["classification_status"] == "abstained"
    assert classification["abstain_reason"] == "low_confidence"
    assert classification["suggested_category"]
    assert classification["auto_classified"] is False
    assert classification["requires_review"] is True


_UPDATE = {
    "cookie_name": "_ga",
    "cookie_domain": "example.com",
    "old_category": "Analytics",
    "new_category": "Marketing",
}


@pytest.mark.parametrize("scan_id", ["../x", "../../etc/passwd", "/etc/x", "a\\b"])
def test_category_update_rejects_path_like_scan_id(client, scan_id):
    r = client.post("/api/categories/update-category", json={**_UPDATE, "scan_id": scan_id})
    assert r.status_code == 422


def test_bulk_category_update_rejects_path_like_scan_id(client):
    r = client.post(
        "/api/categories/bulk-update-categories",
        json=[{**_UPDATE, "scan_id": "2026-10-11T20:20:08.737Z"}, {**_UPDATE, "scan_id": "../x"}],
    )
    assert r.status_code == 422


def test_category_update_accepts_iso_timestamp_scan_id(client, monkeypatch):
    class _Manager:
        async def update_category(self, **kwargs):
            return {"ok": True, "persisted": True, "feedback_recorded": True,
                    "file_fallback": False, "error": None}

    monkeypatch.setattr("backend.db.category_manager.get_category_manager", lambda: _Manager())
    r = client.post(
        "/api/categories/update-category",
        json={**_UPDATE, "scan_id": "2026-10-11T20:20:08.737Z"},
    )
    assert r.status_code == 200
    assert r.json()["knowledge_base_updated"] is True


def _stub_knowledge_base(monkeypatch, kb_result):
    class _Manager:
        async def get_category_with_fallback(self, **kwargs):
            return kb_result

    monkeypatch.setattr("backend.api.ml_routes.get_category_manager", lambda: _Manager())


_CLASSIFY_OPTIONS = {"return_explanation": False, "find_similar": False, "auto_classify": False}


def test_human_override_publishes_its_category(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, {"category": "Marketing", "confidence": 1.0, "source": "user_override"})

    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "xq7_zzkp", "domain": "example.com"}],
        "options": _CLASSIFY_OPTIONS,
    })

    assert r.status_code == 200
    c = r.json()["classifications"][0]
    assert c["source"] == "user_override"
    assert c["classification_status"] == "classified"
    assert c["predicted_category"] == "Marketing"
    assert c["requires_review"] is False
    assert c["auto_classified"] is False


def test_model_only_suggestion_never_publishes(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, None)

    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "_ga", "domain": "example.com"}],
        "options": {**_CLASSIFY_OPTIONS, "confidence_threshold": 0.0},
    })

    assert r.status_code == 200
    c = r.json()["classifications"][0]
    assert c["source"] == "ml_prediction"
    assert c["classification_status"] != "classified"


def test_pattern_match_is_not_a_human_decision(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, {"category": "Analytics", "confidence": 0.9, "source": "pattern_match"})

    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "_ga", "domain": "example.com"}],
        "options": _CLASSIFY_OPTIONS,
    })

    assert r.status_code == 200
    assert r.json()["classifications"][0]["classification_status"] != "classified"


def test_model_info_reports_served_model_metrics(client):
    r = client.get("/api/v1/ml/model-info")

    assert r.status_code == 200
    body = r.json()
    assert body["model_version"] == "6.1.0"
    assert body["trained_at"]
    assert body["samples"]["training"] > 0
    assert body["samples"]["test"] > 0
    holdout = body["metrics"]["internal_site_holdout"]
    assert 0 < holdout["accuracy"] <= 1
    assert "Marketing_Advertising" in holdout["per_class"]
    assert body["acceptance"]["promotion_eligible"] is False


def test_cookie_without_identity_evidence_abstains_even_at_zero_threshold(client):
    payload = {
        "cookies": [{
            "name": "xq7_zzkp",
            "domain": "unknown-cdn.io",
            "site_domain": "example-shop.com",
            "expiry_days": 365,
            "secure": True,
            "same_site": "none",
        }],
        "options": {
            "return_explanation": False,
            "find_similar": False,
            "confidence_threshold": 0.0,
            "auto_classify": False,
        },
    }

    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200
    classification = r.json()["classifications"][0]
    assert classification["classification_status"] == "abstained"
    assert classification["abstain_reason"] == "insufficient_evidence"
    assert classification["confidence_level"] == "Low"
    assert classification["suggested_category"]
    assert classification["requires_review"] is True


def test_auto_classification_is_opt_in(client):
    payload = {
        "cookies": [{"name": "sessionid", "domain": "example.com"}],
        "options": {
            "return_explanation": False,
            "find_similar": False,
            "confidence_threshold": 0.0,
            "auto_classify": False,
        },
    }

    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200
    classification = r.json()["classifications"][0]
    assert classification["classification_status"] == "suggested"
    assert classification["suggested_category"] == classification["predicted_category"]
    assert classification["auto_classified"] is False
    assert classification["requires_review"] is True


def test_unpromoted_model_cannot_auto_classify_even_when_requested(client):
    payload = {
        "cookies": [{"name": "_ga", "domain": "example.com", "site_domain": "example.com"}],
        "options": {
            "return_explanation": False,
            "find_similar": False,
            "confidence_threshold": 0.0,
            "auto_classify": True,
        },
    }

    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200
    classification = r.json()["classifications"][0]
    assert classification["auto_classified"] is False
    assert classification["classification_status"] == "suggested"
    assert classification["requires_review"] is True


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


def test_scan_failure_does_not_return_fabricated_cookies(client, monkeypatch):
    """A browser outage must be reported, never replaced with demo cookies."""
    from backend.scanner.browser import browser_manager

    async def fail_to_start():
        raise RuntimeError("browser unavailable")

    monkeypatch.setattr(browser_manager, "start", fail_to_start)
    r = client.post("/api/scan", json={"url": "https://example.com", "scanType": "quick"})

    assert r.status_code == 503
    assert "browser unavailable" in r.json()["detail"]
    assert "cookies" not in r.json()


def test_ml_inference_failure_is_not_returned_as_unknown_prediction(client, monkeypatch):
    """Operational errors and model abstention are distinct states."""
    from backend.api import ml_routes

    class FailingClassifier:
        def classify(self, _cookie):
            raise RuntimeError("inference unavailable")

    monkeypatch.setattr(ml_routes, "get_classifier", lambda: FailingClassifier())
    monkeypatch.setattr(ml_routes, "get_feature_extractor", lambda: object())

    payload = {
        "cookies": [{"name": "novel_cookie", "domain": "example.com"}],
        "options": {"return_explanation": False, "find_similar": False},
    }
    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 503
    assert "inference unavailable" in r.json()["detail"]


def test_missing_model_artifact_is_service_unavailable(client, monkeypatch):
    """A missing model is an availability failure, never a fabricated prediction."""
    from backend.api import ml_routes

    def missing_classifier():
        raise FileNotFoundError("model.pkl is missing")

    monkeypatch.setattr(ml_routes, "get_classifier", missing_classifier)
    payload = {
        "cookies": [{"name": "novel_cookie", "domain": "example.com"}],
        "options": {"return_explanation": False, "find_similar": False},
    }

    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 503
    assert "model.pkl is missing" in r.json()["detail"]


def test_generic_session_pattern_does_not_exempt_tracking_cookie():
    from backend.db.category_manager import CategoryManager

    manager = CategoryManager()
    pattern = {"pattern": "session", "match_type": "name"}

    assert manager._pattern_matches(pattern, "session_id", "example.com")
    assert not manager._pattern_matches(
        pattern, "marketing_session_tracker", "example.com"
    )


@pytest.mark.anyio
async def test_category_fallback_remains_unclassified():
    from backend.db.category_manager import CategoryManager

    result = await CategoryManager().get_category_with_fallback(
        "opaque_cookie", "example.com"
    )

    assert result["category"] == "Unclassified"
    assert result["confidence"] == 0.0
    assert result["source"] == "default"


# --------------------------------------------------------------------------
# Scan store (MongoDB): /api/store
# Runs against a real MongoDB (MONGODB_URL); the store is reset per test.
# --------------------------------------------------------------------------

@pytest.fixture
def store(client):
    import os
    if not os.environ.get("MONGODB_URL"):
        pytest.skip("MONGODB_URL not set: scan store tests need a real MongoDB")
    for path in ("/api/store/scans",):
        client.delete(path)
    from pymongo import MongoClient
    from backend.config import settings
    db = MongoClient(settings.MONGODB_URL)[settings.MONGODB_DB]
    for name in ("scans", "published", "schedules", "approvals"):
        db[name].delete_many({})
    return client


def _scan(scan_id, domain="shop.com", ts="2026-10-12T10:00:00.000Z", **extra):
    return {"id": scan_id, "domain": domain, "timestamp": ts, "totalCookies": 2,
            "fullResults": {"cookies": [{"name": "_ga", "domain": ".shop.com", "category": "Analytics"}]}, **extra}


def test_store_saves_and_lists_scans_newest_first(store):
    assert store.put("/api/store/scans/s1", json=_scan("s1", ts="2026-10-10T10:00:00.000Z")).status_code == 200
    assert store.put("/api/store/scans/s2", json=_scan("s2", ts="2026-10-12T10:00:00.000Z")).status_code == 200
    scans = store.get("/api/store/scans").json()["scans"]
    assert [s["id"] for s in scans] == ["s2", "s1"]
    assert scans[0]["fullResults"]["cookies"][0]["name"] == "_ga"  # nested results kept


def test_store_saving_the_same_scan_again_replaces_it(store):
    """The ML-corrected save of a scan must not create a second entry (ISSUE-004)."""
    store.put("/api/store/scans/s1", json=_scan("s1", totalCookies=2))
    store.put("/api/store/scans/s1", json=_scan("s1", totalCookies=5))
    scans = store.get("/api/store/scans").json()["scans"]
    assert len(scans) == 1 and scans[0]["totalCookies"] == 5


def test_store_filters_scans_by_domain_and_deletes(store):
    store.put("/api/store/scans/a", json=_scan("a", domain="a.com"))
    store.put("/api/store/scans/b", json=_scan("b", domain="b.com"))
    assert [s["id"] for s in store.get("/api/store/scans?domain=a.com").json()["scans"]] == ["a"]
    assert store.delete("/api/store/scans/a").json() == {"deleted": True}
    assert store.delete("/api/store/scans/a").status_code == 404
    assert store.delete("/api/store/scans").json() == {"deleted": 1}
    assert store.get("/api/store/scans").json()["scans"] == []


def test_store_rejects_bad_ids_and_mismatched_bodies(store):
    assert store.put("/api/store/scans/s1", json=_scan("other")).status_code == 400
    assert store.put("/api/store/scans/bad$id", json=_scan("bad$id")).status_code == 422
    assert store.put("/api/store/scans/s1", json={"id": "s1"}).status_code == 422  # domain/timestamp required


def test_store_publishes_one_version_per_domain(store):
    store.put("/api/store/published/shop.com", json={"id": "s1", "publishedAt": "2026-10-12T00:00:00Z"})
    store.put("/api/store/published/shop.com", json={"id": "s2", "publishedAt": "2026-10-13T00:00:00Z"})
    assert store.get("/api/store/published").json()["published"] == {"shop.com": {"id": "s2", "publishedAt": "2026-10-13T00:00:00Z"}}


def test_store_keeps_schedules_and_approvals(store):
    job = {"id": "j1", "url": "https://shop.com", "unit": "weekly", "scheduleTime": "02:00", "startDate": "2030-01-15", "createdAt": "2026-10-12"}
    assert store.put("/api/store/schedules/j1", json=job).status_code == 200
    assert store.get("/api/store/schedules").json()["schedules"] == [job]
    assert store.delete("/api/store/schedules/j1").json() == {"deleted": True}
    approval = {"cookieKey": "shop.com:_ga", "approvedCategory": "Analytics"}
    store.post("/api/store/approvals", json=approval)
    assert store.get("/api/store/approvals").json()["approvals"] == [approval]


def test_store_imports_a_browsers_saved_data_once_idempotently(store):
    payload = {
        "scans": [_scan("s1"), _scan("s2", ts="2026-10-13T10:00:00.000Z")],
        "published": {"shop.com": {"id": "s1", "publishedAt": "2026-10-12T00:00:00Z"}},
        "schedules": [{"id": "j1", "url": "https://shop.com", "unit": "daily"}],
        "approvals": [{"cookieKey": "shop.com:_ga", "approvedCategory": "Analytics"}],
    }
    assert store.post("/api/store/import", json=payload).json() == {"scans": 2, "published": 1, "schedules": 1, "approvals": 1}
    store.post("/api/store/import", json=payload)  # a repeat import does not duplicate
    assert len(store.get("/api/store/scans").json()["scans"]) == 2


def test_store_answers_503_when_mongodb_is_unreachable(client, monkeypatch):
    import backend.api.store_routes as routes
    monkeypatch.setattr(routes, "get_scan_store", lambda: None)
    async def unreachable():
        return None
    monkeypatch.setattr(routes, "initialize_scan_store", unreachable)
    monkeypatch.setattr(routes, "_last_attempt", 0.0)
    r = client.get("/api/store/scans")
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"]
