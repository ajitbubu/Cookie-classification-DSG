"""Scanned cookies leave the scanner without their value (backend/scanner/cookie_values.py)."""
from hypothesis import given, strategies as st

from backend.api.ml_classifier.feature_extractor import FeatureExtractor
from backend.scanner.classifier import CookieClassifier
from backend.scanner.cookie_values import value_features, without_value

EXTRACTOR = FeatureExtractor()
SESSION = "llxYuYorvI92TFcrKe%2BY1gGXKTd7g0fHm98EK9U9VZvg%2FnQm91T1NTKfXtfOeTqdRaWW"


def _model_features(value):
    """What the model computes from the value_sample older clients sent (first 50 chars)."""
    return EXTRACTOR._extract_value_features(value[:50], None)


@given(st.text(max_size=120) | st.uuids().map(str) | st.binary(max_size=60).map(lambda b: __import__("base64").b64encode(b).decode()))
def test_features_match_the_model_extractor(value):
    f = value_features(value)
    assert [float(f["value_length"]), float(f["value_is_uuid"]), float(f["value_is_base64"])] == _model_features(value)


def test_features_for_known_shapes():
    assert value_features("") == {"value_length": 0, "value_is_uuid": False, "value_is_base64": False}
    assert value_features(None)["value_length"] == 0
    assert value_features("x" * 80)["value_length"] == 50  # same 50-char cap the model was trained on
    assert value_features("A1B2C3D4-0000-4000-8000-123456789ABC")["value_is_uuid"]
    assert value_features("dGVzdA==")["value_is_base64"]


def test_without_value_drops_the_value_and_keeps_everything_else():
    cookie = {"name": "_gh_sess", "domain": "github.com", "value": SESSION, "httpOnly": True, "expires": -1}
    out = without_value(cookie)
    assert "value" not in out and SESSION not in repr(out)
    assert out["size"] == len(SESSION) and out["value_length"] == 50
    assert out["name"] == "_gh_sess" and out["httpOnly"] is True
    assert cookie["value"] == SESSION  # caller's dict untouched


def test_scanner_classifier_output_has_no_value():
    cookies = [{"name": f"c{i}", "domain": ".example.com", "value": f"secret-{i}", "expires": -1} for i in range(6)]
    for out in CookieClassifier.classify_parallel(cookies, "example.com"):  # 6 -> thread-pool path
        assert "value" not in out
        assert out["size"] == len("secret-0") and out["value_length"] == len("secret-0")
        assert out["category"] and out["type"] == "Session"
