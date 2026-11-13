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


# Regression: ISSUE-002 — a fractional expiry_days rejected the whole batch with 422
# Found by /qa on 2026-11-11
# Report: .gstack/qa-reports/run-20261111T170950Z/qa-report-localhost-2026-11-11.md
def test_classify_accepts_fractional_expiry_days(client):
    payload = {"cookies": [
        {"name": "_ga", "domain": ".example.com", "expiry_days": 395.83},
        {"name": "sessionid", "domain": "example.com", "expiry_days": 0},
    ]}
    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200, r.text
    assert len(r.json()["classifications"]) == 2


def test_classification_threshold_creates_abstention(client, monkeypatch):
    monkeypatch.setattr("backend.api.ml_routes.get_known_cookies", lambda: None)  # threshold applies to model predictions
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
    monkeypatch.setattr("backend.api.ml_routes.get_known_cookies", lambda: None)  # model path only

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


def test_known_cookie_category_replaces_the_model_but_still_needs_review(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, None)
    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "_fbp", "domain": ".facebook.com", "site_domain": "shop.com"}],
        "options": _CLASSIFY_OPTIONS,
    })
    assert r.status_code == 200
    c = r.json()["classifications"][0]
    assert c["source"] == "known_cookie"
    assert c["predicted_category"] == "Marketing"
    assert c["known_cookie"]["source"] == "website_declarations"
    assert c["known_cookie"]["sites"] >= 3 and c["known_cookie"]["total_sites"] >= c["known_cookie"]["sites"]
    assert c["classification_status"] == "suggested" and c["requires_review"] is True
    assert 0 < c["confidence_score"] <= 1


def test_reviewer_decision_beats_a_known_cookie(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, {"category": "Functional", "confidence": 1.0, "source": "user_override"})
    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "_fbp", "domain": ".facebook.com"}], "options": _CLASSIFY_OPTIONS,
    })
    c = r.json()["classifications"][0]
    assert (c["source"], c["predicted_category"], c["known_cookie"]) == ("user_override", "Functional", None)


def test_unknown_cookie_falls_back_to_the_model(client, monkeypatch):
    _stub_knowledge_base(monkeypatch, None)
    r = client.post("/api/v1/ml/classify", json={
        "cookies": [{"name": "xq7_zzkp_unlisted", "domain": "example.com"}], "options": _CLASSIFY_OPTIONS,
    })
    c = r.json()["classifications"][0]
    assert c["source"] == "ml_prediction" and c["known_cookie"] is None


def test_model_info_reports_served_model_metrics(client):
    r = client.get("/api/v1/ml/model-info")

    assert r.status_code == 200
    body = r.json()
    assert body["model_version"] == "7.1.0"
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


def test_cookie_sites_label_differently_reports_the_split(client):
    payload = {
        "cookies": [
            {"name": "__stripe_mid", "domain": "example-shop.com", "site_domain": "example-shop.com", "expiry_days": 365},
            {"name": "_fbp", "domain": "example-shop.com", "site_domain": "example-shop.com", "expiry_days": 90},
        ],
        "options": {"return_explanation": False, "find_similar": False, "auto_classify": False},
    }

    r = client.post("/api/v1/ml/classify", json=payload)

    assert r.status_code == 200
    stripe, fbp = r.json()["classifications"]
    split = stripe["site_label_split"]
    assert set(split) >= {"Strictly Necessary", "Functional"}  # display names, not model labels
    assert all(sites >= 1 for sites in split.values())
    assert fbp["site_label_split"] is None


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
    _resolve_to(monkeypatch, "93.184.215.14")
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


@pytest.mark.parametrize("pattern,cookie_name,matches", [
    # Vendor cookie names match exactly or with an ID suffix.
    ("_ga", "_ga", True),
    ("_ga", "_ga_S4EX53B760", True),
    ("_gat", "_gat_UA-12345-1", True),
    ("IDE", "ide", True),
    # ...but not as fragments of unrelated names (these used to match at 0.99).
    ("_ga", "_gamer_tag", False),
    ("_ga", "cart_gauge", False),
    ("_ga", "__gads", False),
    ("_gid", "t_gid", False),
    ("IDE", "ide_theme", False),
    ("IDE", "guide_seen", False),
    ("NID", "liveRampSesssionID", False),
    ("NID", "ASP.NET_SessionId", False),
    # Keyword patterns still match anywhere in the name.
    ("csrf", "csrftoken", True),
    ("csrf", "CRAFT_CSRF_TOKEN", True),
    ("CONSENT", "CookieConsent", True),
    ("CONSENT", "cookiebot-consent--necessary", True),
])
def test_name_patterns_do_not_match_unrelated_fragments(pattern, cookie_name, matches):
    from backend.db.category_manager import CategoryManager

    rule = {"pattern": pattern, "match_type": "name"}
    assert CategoryManager()._pattern_matches(rule, cookie_name, "example.com") is matches


@pytest.mark.anyio
async def test_category_fallback_remains_unclassified():
    from backend.db.category_manager import CategoryManager

    result = await CategoryManager().get_category_with_fallback(
        "opaque_cookie", "example.com"
    )

    assert result["category"] == "Unclassified"
    assert result["confidence"] == 0.0
    assert result["source"] == "default"


@pytest.mark.anyio
async def test_stale_stored_pattern_match_is_rechecked_against_current_patterns():
    from backend.db.category_manager import CategoryManager

    manager = CategoryManager()
    manager.patterns_loaded = True
    manager.patterns_cache = [{"pattern": "_ga", "match_type": "name", "category": "Analytics",
                               "confidence": 0.99, "vendor": "Google", "priority": 100}]

    async def stale_row(name, domain):  # stored by the old substring matcher
        return {"category": "Analytics", "confidence": 0.99, "source": "pattern_match", "metadata": {}}

    manager.query_knowledge_base = stale_row
    result = await manager.get_category_with_fallback(
        "cart_gauge", "shop.example", ml_prediction={"category": "Functional", "confidence": 0.4}
    )

    assert result["source"] == "ml_prediction" and result["category"] == "Functional"


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


# --------------------------------------------------------------------------
# Security: SSRF guard on scan targets, SPA path containment, ML JWT key
# --------------------------------------------------------------------------

def _resolve_to(monkeypatch, *addresses):
    """Stub DNS for the scan-target guard so tests never touch the network."""
    from backend.scanner import url_guard

    async def resolve(_host):
        return list(addresses)

    monkeypatch.setattr(url_guard, "_resolve", resolve)


@pytest.mark.parametrize("endpoint", ["/api/scan", "/api/scan-stream"])
@pytest.mark.parametrize("url", [
    "file:///etc/passwd",
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:6379/",
    "http://[::1]/",
])
def test_scan_rejects_non_public_url_literals(client, endpoint, url):
    r = client.post(endpoint, json={"url": url, "scanType": "quick"})
    assert r.status_code == 422


@pytest.mark.parametrize("endpoint", ["/api/scan", "/api/scan-stream"])
def test_scan_rejects_hostname_resolving_to_internal_address(client, monkeypatch, endpoint):
    from backend.scanner.browser import browser_manager

    async def must_not_start():
        raise AssertionError("browser started for a blocked target")

    monkeypatch.setattr(browser_manager, "start", must_not_start)
    _resolve_to(monkeypatch, "10.0.0.7")
    r = client.post(endpoint, json={"url": "http://postgres:5432/", "scanType": "quick"})
    assert r.status_code == 400
    assert "not allowed" in r.json()["detail"]


def test_spa_fallback_does_not_serve_files_outside_static_dir(tmp_path, monkeypatch):
    import importlib

    from fastapi.testclient import TestClient

    import backend.main

    static = tmp_path / "build"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>spa</html>")
    secret = tmp_path / "secret.txt"
    secret.write_text("do-not-serve")

    monkeypatch.setenv("STATIC_DIR", str(static))
    try:
        app = importlib.reload(backend.main).app
        spa = TestClient(app)  # no context manager: skip startup hooks
        for path in (f"/%2F{str(secret).lstrip('/').replace('/', '%2F')}", "/..%2Fsecret.txt"):
            r = spa.get(path)
            assert r.status_code == 200
            assert "do-not-serve" not in r.text
            assert "spa" in r.text
        assert spa.get("/index.html").text == "<html>spa</html>"
    finally:
        monkeypatch.delenv("STATIC_DIR")
        importlib.reload(backend.main)


def test_ml_jwt_key_is_not_the_old_hardcoded_value():
    import jwt
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    from backend.api.ml_classifier import auth

    assert auth.SECRET_KEY != "your-secret-key-here"
    forged = jwt.encode({"sub": "attacker"}, "your-secret-key-here", algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        auth.verify_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged))
    assert exc.value.status_code == 401
    assert "Could not validate credentials" in exc.value.detail


def test_cors_does_not_trust_arbitrary_origins(client):
    """A random website must not be able to read the API through a visitor's browser."""
    evil = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers

    dev = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert dev.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_store_never_keeps_cookie_values(store):
    """Cookie values can be session tokens or personal data; the store drops them."""
    scan = _scan("v1")
    scan["fullResults"]["cookies"][0]["value"] = "GA1.2.123456.789"
    scan["fullResults"]["pageResults"] = [{"url": "https://shop.com/", "cookies": [{"name": "sid", "value": "secret-session"}]}]
    assert store.put("/api/store/scans/v1", json=scan).status_code == 200
    saved = store.get("/api/store/scans").json()["scans"][0]["fullResults"]
    assert "value" not in saved["cookies"][0] and saved["cookies"][0]["name"] == "_ga"
    assert saved["pageResults"][0]["cookies"] == [{"name": "sid"}]


def test_strip_cookie_values_handles_partial_scans():
    from backend.db.scan_store import strip_cookie_values
    assert strip_cookie_values({"id": "x"}) is False
    assert strip_cookie_values({"fullResults": {"cookies": None, "pageResults": [{"url": "u"}]}}) is False
    scan = {"fullResults": {"cookies": [{"name": "a", "value": "1"}, {"name": "b"}]}}
    assert strip_cookie_values(scan) is True and scan["fullResults"]["cookies"] == [{"name": "a"}, {"name": "b"}]

