"""Regression tests for the reproducible v6+ model training pipeline."""

import numpy as np
import pandas as pd
from pathlib import Path
from hypothesis import given, settings, strategies as st

from backend.scripts.train_cookie_model import (
    CANONICAL_LABELS,
    build_feature_matrix,
    cookie_name_family,
    deduplicate_observations,
    normalize_label,
    normalize_training_frame,
    split_by_site_domain,
)


def test_label_normalization_covers_legacy_taxonomies():
    expected = {
        "Analytics": "Analytics_Performance",
        "Measure performance": "Analytics_Performance",
        "Personalization": "Functional",
        "Advertising": "Marketing_Advertising",
        "Social Media Tracking": "Marketing_Advertising",
        "Necessary": "Strictly_Necessary",
        "unclassified": "Unclassified",
    }

    assert {raw: normalize_label(raw) for raw in expected} == expected
    assert normalize_label("unsupported label") is None


def test_normalization_rejects_rows_without_group_provenance():
    frame = pd.DataFrame([
        {
            "site_domain": None,
            "cookie_name": "_ga",
            "cookie_domain": "example.com",
            "label_category": "Analytics",
        },
        {
            "site_domain": "example.com",
            "cookie_name": "_ga",
            "cookie_domain": "example.com",
            "label_category": "Analytics",
        },
    ])

    normalized, audit = normalize_training_frame(frame, source="fixture.csv")

    assert len(normalized) == 1
    assert normalized.iloc[0]["label"] == "Analytics_Performance"
    assert audit["missing_site_domain"] == 1


def test_deduplication_removes_repeats_and_conflicting_labels():
    base = {
        "site_domain": "example.com",
        "cookie_name": "cookie_a",
        "cookie_domain": "example.com",
        "expiry_days": 30,
        "secure": True,
        "http_only": False,
        "same_site": "Lax",
    }
    frame = pd.DataFrame([
        {**base, "label": "Functional"},
        {**base, "label": "Functional"},
        {**base, "label": "Marketing_Advertising"},
        {**base, "cookie_name": "cookie_b", "label": "Unclassified"},
    ])

    cleaned, audit = deduplicate_observations(frame)

    assert cleaned["cookie_name"].tolist() == ["cookie_b"]
    assert audit["duplicate_rows_removed"] == 1
    assert audit["conflicting_observations_removed"] == 2


def test_group_split_has_no_site_domain_overlap():
    rows = []
    for site_index in range(10):
        for row_index, label in enumerate(CANONICAL_LABELS):
            rows.append({
                "site_domain": f"site-{site_index}.example",
                "cookie_name": f"cookie-{site_index}-{row_index}",
                "cookie_domain": f"vendor-{row_index}.example",
                "expiry_days": row_index,
                "secure": False,
                "http_only": False,
                "same_site": "Lax",
                "label": label,
            })
    frame = pd.DataFrame(rows)

    train, calibration, test, audit = split_by_site_domain(
        frame, test_fraction=0.2, calibration_fraction=0.2, seed=7
    )

    train_sites = set(train["site_domain"])
    calibration_sites = set(calibration["site_domain"])
    test_sites = set(test["site_domain"])
    assert train_sites.isdisjoint(calibration_sites)
    assert train_sites.isdisjoint(test_sites)
    assert calibration_sites.isdisjoint(test_sites)
    assert audit["site_domain_overlap"] == {
        "train_calibration": 0,
        "train_test": 0,
        "calibration_test": 0,
    }


def test_cookie_name_family_strips_per_site_identifier_suffixes():
    assert cookie_name_family("AWSALB_e0xu") == "awsalb"
    assert cookie_name_family("AWSALB") == "awsalb"
    assert cookie_name_family("_ga_ABC123XYZ") == "_ga"
    assert cookie_name_family("_hjSessionUser_123") == "_hjsessionuser"
    assert cookie_name_family("wp-settings-time-1") == "wp-settings-time"
    assert cookie_name_family("bm_sv_6xve") == "bm_sv"
    # Segments without digits are part of the name, not an identifier.
    assert cookie_name_family("ajs_anonymous_id") == "ajs_anonymous_id"
    assert cookie_name_family("XSRF-TOKEN") == "xsrf-token"


def test_group_split_has_no_cookie_name_family_overlap():
    rows = []
    for site_index in range(10):
        for row_index, label in enumerate(CANONICAL_LABELS):
            # Every site sets the same five cookie families with a per-site suffix,
            # mirroring how one vendor's cookie appears across many sites.
            rows.append({
                "site_domain": f"site-{site_index}.example",
                "cookie_name": f"vendor{row_index}_cookie_{site_index}x{row_index}",
                "cookie_domain": f"site-{site_index}.example",
                "expiry_days": row_index,
                "secure": False,
                "http_only": False,
                "same_site": "Lax",
                "label": label,
            })
        rows.append({
            "site_domain": f"site-{site_index}.example",
            "cookie_name": f"only_on_site_{chr(97 + site_index)}",
            "cookie_domain": f"site-{site_index}.example",
            "expiry_days": 1,
            "secure": False,
            "http_only": False,
            "same_site": "Lax",
            "label": "Functional",
        })
    frame = pd.DataFrame(rows)

    train, calibration, test, audit = split_by_site_domain(
        frame, test_fraction=0.2, calibration_fraction=0.2, seed=7
    )

    def families(partition):
        return set(partition["cookie_name"].map(cookie_name_family))

    assert families(train).isdisjoint(families(calibration))
    assert families(train).isdisjoint(families(test))
    assert families(calibration).isdisjoint(families(test))
    assert len(test) > 0 and len(calibration) > 0
    assert audit["cookie_name_family_overlap"] == {
        "train_calibration": 0,
        "train_test": 0,
        "calibration_test": 0,
    }
    assert audit["rows_removed_for_name_overlap"]["test"] > 0
    assert audit["rows_removed_for_name_overlap"]["calibration"] > 0


def test_feature_generation_uses_production_52_feature_extractor():
    frame = pd.DataFrame([
        {
            "site_domain": "example.com",
            "cookie_name": "_ga",
            "cookie_domain": "example.com",
            "expiry_days": 365,
            "secure": True,
            "http_only": False,
            "same_site": "Lax",
            "label": "Analytics_Performance",
        }
    ])

    matrix = build_feature_matrix(frame)

    assert matrix.shape == (1, 52)
    assert matrix.dtype == np.float32


def test_v61_candidate_uses_native_verified_artifacts_and_stays_review_only():
    from backend.api.ml_classifier.classifier import CookieClassifier

    candidate = Path("models/v6.1.0")
    assert (candidate / "model.ubj").is_file()
    assert (candidate / "manifest.json").is_file()

    classifier = CookieClassifier("6.1.0")
    result = classifier.classify({
        "name": "opaque_7f91c2",
        "domain": "example.com",
        "site_domain": "example.com",
        "expiry_days": 30,
    })

    assert classifier.serialization_format == "xgboost_native"
    assert classifier.metadata["acceptance"]["promotion_eligible"] is False
    assert classifier.metadata["acceptance"]["auto_classification_enabled"] is False
    assert result.auto_classified is False
    assert result.requires_review is True


def _v61_classifier():
    from backend.api.ml_classifier.classifier import CookieClassifier

    if not hasattr(_v61_classifier, "instance"):
        _v61_classifier.instance = CookieClassifier("6.1.0")
    return _v61_classifier.instance


def test_cookie_without_identity_evidence_is_capped_not_hallucinated():
    from backend.api.ml_classifier.config import NO_EVIDENCE_CONFIDENCE_CAP

    classifier = _v61_classifier()
    # Before the guard these scored 0.93-1.00: gibberish, empty and 1-char names.
    for name in ("xq7_zzkp", "", "a", "foo"):
        cookie = {
            "name": name,
            "domain": "unknown-cdn.io",
            "site_domain": "example-shop.com",
            "expiry_days": 365,
            "secure": True,
            "same_site": "none",
        }
        single = classifier.classify(cookie)
        batch = classifier.classify_batch([cookie])[0]

        for result in (single, batch):
            assert result.insufficient_evidence is True
            assert result.confidence_score <= NO_EVIDENCE_CONFIDENCE_CAP + 1e-6
            assert result.confidence_level == "Low"
            assert abs(sum(result.probabilities.values()) - 1.0) < 1e-5
        assert single.predicted_category == batch.predicted_category


def test_cookie_with_identity_evidence_keeps_model_confidence():
    from backend.api.ml_classifier.config import NO_EVIDENCE_CONFIDENCE_CAP

    classifier = _v61_classifier()
    result = classifier.classify({
        "name": "_ga",
        "domain": "example.com",
        "site_domain": "example.com",
        "expiry_days": 730,
        "same_site": "lax",
    })

    assert result.insufficient_evidence is False
    assert result.predicted_category == "Analytics_Performance"
    assert result.confidence_score > NO_EVIDENCE_CONFIDENCE_CAP


def test_cookie_without_identity_evidence_is_never_auto_classified(monkeypatch):
    from backend.api.ml_classifier.classifier import CookieClassifier

    classifier = CookieClassifier("6.1.0")
    # Simulate a future promoted model; Analytics/Marketing thresholds are 0.50,
    # which a capped 0.50 confidence would otherwise meet.
    monkeypatch.setitem(classifier.metadata, "acceptance", {
        "promotion_eligible": True,
        "auto_classification_enabled": True,
    })
    cookie = {"name": "foo", "domain": "x.y", "site_domain": "x.y", "expiry_days": 99999}

    for result in (classifier.classify(cookie), classifier.classify_batch([cookie])[0]):
        assert result.insufficient_evidence is True
        assert result.auto_classified is False
        assert result.requires_review is True


@settings(max_examples=60, deadline=None)
@given(
    name=st.text(alphabet="bcfjkmnpqrvwxz0123456789", max_size=12),
    expiry_days=st.sampled_from([0, 1, 7, 30, 90, 365, 390, 730, 99999]),
    secure=st.booleans(),
    http_only=st.booleans(),
    same_site=st.sampled_from(["lax", "strict", "none", ""]),
    third_party=st.booleans(),
)
def test_no_attribute_combination_makes_an_unknown_name_confident(
    name, expiry_days, secure, http_only, same_site, third_party
):
    from backend.api.ml_classifier.config import NO_EVIDENCE_CONFIDENCE_CAP

    # The alphabet avoids every keyword the extractor looks for, so the name
    # carries no identity signal and only generic attributes vary.
    result = _v61_classifier().classify({
        "name": name,
        "domain": "zzqk.io" if third_party else "site.com",
        "site_domain": "site.com",
        "expiry_days": expiry_days,
        "secure": secure,
        "http_only": http_only,
        "same_site": same_site,
    })

    assert result.insufficient_evidence is True
    assert result.confidence_score <= NO_EVIDENCE_CONFIDENCE_CAP + 1e-6
