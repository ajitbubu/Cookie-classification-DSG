"""Known-cookie regression suite for a candidate model (plan Phase 5, decision D17).

Runs only when MODEL_UNDER_TEST names a model version under models/ (e.g.
``MODEL_UNDER_TEST=7.0.0``); a model is not promoted unless this passes.
"""

import os

import pytest

MODEL_UNDER_TEST = os.getenv("MODEL_UNDER_TEST")
pytestmark = pytest.mark.skipif(not MODEL_UNDER_TEST, reason="set MODEL_UNDER_TEST=<version> to run")


def cookie(name, domain, site="example.com", expiry_days=365, secure=True, http_only=False, same_site="Lax"):
    return {"name": name, "domain": domain, "site_domain": site, "expiry_days": expiry_days,
            "secure": secure, "http_only": http_only, "same_site": same_site}


KNOWN = [
    (cookie("_ga", ".example.com", expiry_days=400), "Analytics_Performance"),
    (cookie("_gid", ".example.com", expiry_days=1), "Analytics_Performance"),
    (cookie("_fbp", ".example.com", expiry_days=90), "Marketing_Advertising"),
    (cookie("_gcl_au", ".example.com", expiry_days=90), "Marketing_Advertising"),
    (cookie("IDE", ".doubleclick.net", expiry_days=390, same_site="None"), "Marketing_Advertising"),
    (cookie("PHPSESSID", "example.com", expiry_days=0, http_only=True), "Strictly_Necessary"),
    (cookie("csrftoken", "example.com", expiry_days=365, same_site="Strict"), "Strictly_Necessary"),
    (cookie("OptanonConsent", ".example.com", expiry_days=365, secure=False), "Strictly_Necessary"),
    (cookie("CookieConsent", "example.com", expiry_days=365), "Strictly_Necessary"),
    (cookie("__stripe_mid", ".example.com", expiry_days=365, same_site="Strict"), "Strictly_Necessary"),
    (cookie("lang", "example.com", expiry_days=0, secure=False), "Functional"),
]

NONSENSE = [
    cookie("zq9xk_vv", "unknown-vendor-1.example", site="unknown-vendor-1.example"),
    cookie("blorpt", "qqq.invalid", site="qqq.invalid", expiry_days=0),
    cookie("x7f3a", ".nowhere.test", site="nowhere.test", expiry_days=30, http_only=True),
]


@pytest.fixture(scope="module")
def classifier():
    from backend.api.ml_classifier.classifier import CookieClassifier

    return CookieClassifier(model_version=MODEL_UNDER_TEST)


@pytest.mark.parametrize("data, expected", KNOWN, ids=[c["name"] for c, _ in KNOWN])
def test_known_cookie_gets_expected_category(classifier, data, expected):
    result = classifier.classify(data)
    assert result.predicted_category == expected, result.probabilities


def test_load_balancer_cookie_is_never_auto_classified(classifier):
    result = classifier.classify(cookie("AWSALB", "example.com", expiry_days=7, secure=False))
    assert result.auto_classified is False


@pytest.mark.parametrize("data", NONSENSE, ids=[c["name"] for c in NONSENSE])
def test_nonsense_cookie_is_low_confidence_and_not_auto(classifier, data):
    result = classifier.classify(data)
    assert result.confidence_score <= 0.5
    assert result.auto_classified is False
