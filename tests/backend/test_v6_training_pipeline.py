"""Regression tests for the reproducible v6+ model training pipeline."""

import numpy as np
import pandas as pd
from pathlib import Path
from hypothesis import given, settings, strategies as st

from backend.scripts.train_cookie_model import (
    CANONICAL_LABELS,
    _load_train_only_inputs,
    add_train_only_rows,
    build_feature_matrix,
    cookie_name_family,
    deduplicate_observations,
    normalize_label,
    normalize_training_frame,
    parse_args,
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
    observed = {"expiry_days": 730, "secure": False, "http_only": False}
    frame = pd.DataFrame([
        {
            "site_domain": None,
            "cookie_name": "_ga",
            "cookie_domain": "example.com",
            "label_category": "Analytics",
            **observed,
        },
        {
            "site_domain": "example.com",
            "cookie_name": "_ga",
            "cookie_domain": "example.com",
            "label_category": "Analytics",
            **observed,
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


import pytest


@pytest.mark.parametrize("name,is_ga,prefix_ga,is_fb,prefix_fb", [
    ("_ga", 1, 1, 0, 0), ("_ga_S4EX53B760", 1, 1, 0, 0), ("_gat", 1, 1, 0, 0),
    ("_gat_UA-12345-1", 1, 1, 0, 0), ("_gac_UA-123", 1, 1, 0, 0),
    ("_gid", 1, 0, 0, 0), ("__utma", 1, 0, 0, 0),
    ("_fbp", 0, 0, 1, 1), ("_fbc", 0, 0, 1, 1), ("fr", 0, 0, 1, 0),
    # Made-up names that only start like a vendor cookie carry no vendor evidence.
    ("_gamer_tag", 0, 0, 0, 0), ("_gallery_view", 0, 0, 0, 0), ("_gateway_id", 0, 0, 0, 0),
    ("_fbcolor", 0, 0, 0, 0),
])
def test_vendor_name_features_need_the_real_cookie_name(name, is_ga, prefix_ga, is_fb, prefix_fb):
    from backend.api.ml_classifier.feature_extractor_v5 import FeatureExtractorV5

    extractor = FeatureExtractorV5()
    features = dict(zip(extractor.get_feature_names(), extractor.extract_features(
        {"name": name, "domain": "shop.example", "site_domain": "shop.example"})))
    assert (features["is_ga_like"], features["name_prefix_ga"]) == (is_ga, prefix_ga)
    assert (features["is_fb_like"], features["name_prefix_fb"]) == (is_fb, prefix_fb)


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


def test_trainer_uses_the_builder_label_table():
    import backend.scripts.train_cookie_model as trainer
    from backend.scripts.build_production_dataset import LABEL_ALIASES

    assert not hasattr(trainer, "_LABEL_ALIASES")
    assert all(normalize_label(raw) == label for raw, label in LABEL_ALIASES.items())
    assert normalize_label(float("nan")) is None


def test_rows_with_unobserved_attributes_are_dropped_and_counted():
    base = {"site_domain": "example.com", "cookie_domain": "example.com", "label_category": "Functional"}
    frame = pd.DataFrame([
        {**base, "cookie_name": "observed", "expiry_days": 0, "secure": False, "http_only": False},
        {**base, "cookie_name": "no_expiry", "expiry_days": None, "secure": True, "http_only": False},
        {**base, "cookie_name": "blank_secure", "expiry_days": 30, "secure": " ", "http_only": False},
        {**base, "cookie_name": "no_http_only", "expiry_days": 30, "secure": True, "http_only": None},
    ])

    normalized, audit = normalize_training_frame(frame, source="fixture.csv")

    assert normalized["cookie_name"].tolist() == ["observed"]
    assert audit["missing_attributes"] == 3


def test_rows_without_attribute_columns_are_all_dropped():
    frame = pd.DataFrame([{"site_domain": "a.com", "cookie_name": "x", "cookie_domain": "a.com", "label": "Functional"}])

    normalized, audit = normalize_training_frame(frame, source="declared_only.csv")

    assert normalized.empty
    assert audit["missing_attributes"] == 1


def _split_fixture():
    rows = []
    for site_index in range(10):
        for row_index, label in enumerate(CANONICAL_LABELS):
            rows.append({
                "site_domain": f"site-{site_index}.example",
                "cookie_name": f"cookie{site_index}x{row_index}",
                "cookie_domain": f"vendor-{row_index}.example",
                "expiry_days": row_index,
                "secure": False,
                "http_only": False,
                "same_site": "Lax",
                "label": label,
            })
    return split_by_site_domain(pd.DataFrame(rows), test_fraction=0.2, calibration_fraction=0.2, seed=7)


def _train_only_row(site, name, label="Functional"):
    return {"site_domain": site, "cookie_name": name, "cookie_domain": site, "expiry_days": 1,
            "secure": False, "http_only": False, "same_site": "Lax", "label": label}


def test_train_only_rows_never_change_calibration_or_test_rows():
    train, calibration, test, _ = _split_fixture()
    test_site = test["site_domain"].iloc[0]
    test_family = test["cookie_name"].iloc[0]
    train_only = pd.DataFrame([
        _train_only_row("elsewhere.example", "fresh_cookie"),
        _train_only_row("www." + test_site, "leaky_cookie"),
        _train_only_row("other.example", test_family),
    ])

    combined, unseen_test, audit = add_train_only_rows(train, calibration, test, train_only)

    assert len(combined) == len(train) + 2
    assert "leaky_cookie" not in set(combined["cookie_name"])
    assert audit["rows_dropped_on_held_out_sites"] == 1
    # The family is still scored in test (D27), but not in the unseen-by-all-sources set (D31).
    assert test_family in set(test["cookie_name"])
    assert not unseen_test[test["cookie_name"].eq(test_family)].any()
    assert unseen_test.sum() == len(test) - 1


def test_ablation_arms_share_the_same_test_rows():
    train, calibration, test, _ = _split_fixture()
    without, _, _ = add_train_only_rows(train, calibration, test, train.iloc[0:0])
    with_rows, _, _ = add_train_only_rows(
        train, calibration, test, pd.DataFrame([_train_only_row("extra.example", "x")])
    )
    _, _, test_again, _ = _split_fixture()

    pd.testing.assert_frame_equal(test, test_again)
    assert len(with_rows) == len(without) + 1


def test_split_seed_is_separate_from_model_seed():
    args = parse_args(["--input", "a.csv", "--seed", "43"])
    assert (args.seed, args.split_seed, args.train_only_input) == (43, 42, None)
    args = parse_args(["--input", "a.csv", "--train-only-input", "cb.csv", "--train-only-input", "legacy.csv"])
    assert args.train_only_input == ["cb.csv", "legacy.csv"]


def test_train_only_sources_are_deduplicated_within_each_source(tmp_path):
    row = {"site_domain": "a.com", "cookie_name": "x", "cookie_domain": "a.com", "expiry_days": 1,
           "secure": False, "http_only": False, "same_site": "Lax", "label_category": "Functional"}
    first = tmp_path / "first.csv"
    pd.DataFrame([row, row, {**row, "cookie_name": "y"}, {**row, "cookie_name": "y", "label_category": "Marketing"}]
                 ).to_csv(first, index=False)
    second = tmp_path / "second.csv"
    pd.DataFrame([row]).to_csv(second, index=False)

    frame, audits = _load_train_only_inputs([first, second])

    assert frame["cookie_name"].tolist() == ["x", "x"]
    assert audits[0]["deduplication"]["duplicate_rows_removed"] == 1
    assert audits[0]["deduplication"]["conflicting_observations_removed"] == 2


def test_wilson_lower_bound_needs_evidence_not_just_a_high_rate():
    from backend.scripts.train_cookie_model import wilson_lower_bound

    assert wilson_lower_bound(0, 0) == 0.0
    assert round(wilson_lower_bound(95, 100), 3) == 0.888
    assert wilson_lower_bound(60, 60) < 0.95 < wilson_lower_bound(990, 1000)


def _confident(rows, class_index, confidence=0.99, classes=5):
    probabilities = np.full((rows, classes), (1 - confidence) / (classes - 1))
    probabilities[:, class_index] = confidence
    return probabilities


def test_thresholds_require_a_wilson_bound_and_skip_guarded_rows():
    from backend.scripts.train_cookie_model import choose_class_thresholds

    classes = ["Analytics_Performance", "Functional", "Marketing_Advertising", "Strictly_Necessary", "Unclassified"]
    small = _confident(60, 0)
    small_labels = np.zeros(60, dtype=int)
    thresholds = choose_class_thresholds(small, small_labels, classes, target_precision=0.95, minimum_predictions=50)
    assert thresholds["Analytics_Performance"]["enabled"] is False  # 60/60 correct, but the bound is 0.94

    large = _confident(1000, 0)
    large_labels = np.zeros(1000, dtype=int)
    large_labels[:5] = 1
    thresholds = choose_class_thresholds(large, large_labels, classes, target_precision=0.95, minimum_predictions=50)
    policy = thresholds["Analytics_Performance"]
    assert policy["enabled"] is True and policy["precision_wilson_lower_bound"] >= 0.95

    guarded = np.zeros(1000, dtype=bool)
    guarded[:60] = True
    thresholds = choose_class_thresholds(large, large_labels, classes, target_precision=0.95,
                                         minimum_predictions=50, eligible=guarded)
    assert thresholds["Analytics_Performance"]["enabled"] is False


GATE = {"target_precision": 0.95, "minimum_predictions": 100, "minimum_sites": 20,
        "bootstrap_samples": 1000, "seed": 7}


def test_auto_gate_passes_precise_predictions_spread_over_many_sites():
    from backend.scripts.train_cookie_model import auto_policy_gate

    sites = np.repeat([f"s{i}.com" for i in range(40)], 50)
    correct = np.ones(len(sites), dtype=bool)
    correct[::100] = False
    result = auto_policy_gate(correct, sites, **GATE)
    assert result["passed"] is True
    assert result["distinct_sites"] == 40 and result["eligible_predictions"] == 2000


def test_auto_gate_fails_on_too_few_sites_or_predictions():
    from backend.scripts.train_cookie_model import auto_policy_gate

    few_sites = auto_policy_gate(np.ones(1000, dtype=bool), np.repeat([f"s{i}" for i in range(10)], 100), **GATE)
    few_rows = auto_policy_gate(np.ones(99, dtype=bool), np.array([f"s{i}" for i in range(99)]), **GATE)
    assert few_sites["passed"] is False and few_sites["wilson_lower_bound"] > 0.99
    assert few_rows["passed"] is False


def test_auto_gate_site_bootstrap_catches_errors_concentrated_on_one_site():
    from backend.scripts.train_cookie_model import auto_policy_gate

    sites = np.repeat([f"s{i}.com" for i in range(25)], 1000)
    correct = sites != "s0.com"
    result = auto_policy_gate(correct, sites, **GATE)
    assert result["wilson_lower_bound"] >= 0.95
    assert result["site_bootstrap_lower_bound"] < 0.95
    assert result["passed"] is False


def test_auto_policy_never_includes_rows_the_evidence_guard_flags():
    from backend.scripts.train_cookie_model import auto_policy_mask

    classes = ["Analytics_Performance", "Functional", "Marketing_Advertising", "Strictly_Necessary", "Unclassified"]
    thresholds = {name: {"threshold": 0.9, "enabled": name != "Unclassified"} for name in classes}
    probabilities = _confident(4, 0)
    probabilities[3] = _confident(1, 4)[0]
    eligible = np.array([True, False, True, True])
    assert auto_policy_mask(probabilities, classes, thresholds, eligible).tolist() == [True, False, True, False]


def test_shared_evidence_guard_caps_only_rows_without_evidence():
    from backend.api.ml_classifier.config import NO_EVIDENCE_CONFIDENCE_CAP
    from backend.api.ml_classifier.evidence_guard import apply_evidence_guard

    features = np.array([[0.0, 0.0, 3.0], [1.0, 0.0, 3.0]])
    probabilities = _confident(2, 2, confidence=0.9)
    guarded, lacks = apply_evidence_guard(features, probabilities, [0, 1])
    assert lacks.tolist() == [True, False]
    assert np.isclose(guarded[0].max(), NO_EVIDENCE_CONFIDENCE_CAP) and guarded[0].argmax() == 2
    assert np.isclose(guarded[0].sum(), 1.0)
    assert np.array_equal(guarded[1], probabilities[1])


def test_per_cmp_gate_judges_only_well_sampled_cmps():
    from backend.scripts.train_cookie_model import per_cmp_gate

    labels = np.tile([0, 1, 2, 3], 200)
    predictions = labels.copy()
    cmps = np.array(["onetrust"] * 400 + ["cookiebot"] * 350 + ["termly"] * 40 + [""] * 10)
    sites = np.array([f"s{i % 30}" for i in range(800)])
    predictions[400:750:2] = 0  # cookiebot rows are often wrong
    result = per_cmp_gate(labels, predictions, cmps, sites, minimum_rows=300, minimum_sites=20, maximum_gap=0.05)

    assert result["per_cmp"]["onetrust"]["passed"] is True
    assert result["per_cmp"]["cookiebot"]["passed"] is False
    assert result["per_cmp"]["termly"]["passed"] is None
    assert result["rows_without_cmp"] == 10 and result["cmps_judged"] == 2
    assert result["passed"] is False

    unjudged = per_cmp_gate(labels[:40], predictions[:40], cmps[790:] .repeat(4), sites[:40],
                            minimum_rows=300, minimum_sites=20, maximum_gap=0.05)
    assert unjudged["cmps_judged"] == 0 and unjudged["passed"] is True


def test_evidence_sidecars_map_observations_to_cmp(tmp_path):
    from backend.scripts.train_cookie_model import _load_evidence_sidecars

    sidecar = tmp_path / "sidecar.csv"
    sidecar.write_text("observation_id,cmp,raw_label\nobs_1, OneTrust ,x\nobs_2,cookiebot,y\n")
    assert _load_evidence_sidecars([sidecar]) == {"obs_1": "onetrust", "obs_2": "cookiebot"}


def test_target_auto_precision_defaults_to_the_wilson_target():
    args = parse_args(["--input", "x.csv"])
    assert args.target_auto_precision == 0.95
    assert (args.minimum_auto_predictions, args.minimum_auto_sites) == (100, 20)


def test_training_refuses_a_purpose_class_with_no_rows():
    import pytest
    from backend.scripts.train_cookie_model import TRAINED_LABELS, require_every_class

    assert TRAINED_LABELS == ["Analytics_Performance", "Functional", "Marketing_Advertising", "Strictly_Necessary"]
    require_every_class(pd.DataFrame({"label": TRAINED_LABELS}))
    with pytest.raises(ValueError, match="Functional"):
        require_every_class(pd.DataFrame({"label": ["Analytics_Performance", "Marketing_Advertising",
                                                    "Strictly_Necessary"]}))


def test_unclassified_rows_are_abstentions_not_training_labels():
    observed = {"site_domain": "a.com", "cookie_domain": "a.com", "expiry_days": 1, "secure": False, "http_only": False}
    frame = pd.DataFrame([
        {**observed, "cookie_name": "x", "label_category": "Unclassified"},
        {**observed, "cookie_name": "y", "label_category": "uncategorized"},
        {**observed, "cookie_name": "z", "label_category": "Functional"},
    ])
    normalized, audit = normalize_training_frame(frame, source="fixture.csv")

    assert normalized["cookie_name"].tolist() == ["z"]
    assert audit["unclassified_label_dropped"] == 2
    assert "unclassified_precision" not in parse_args(["--input", "x.csv"])


def test_samesite_none_survives_csv_loading_and_blank_attributes_still_drop(tmp_path):
    """pandas reads the text "None" as NaN by default; SameSite=None is a real value."""
    from backend.scripts.train_cookie_model import _load_inputs

    path = tmp_path / "cookieblock_like.csv"
    path.write_text(
        "site_domain,cookie_name,cookie_domain,expiry_days,secure,http_only,same_site,label_category\n"
        "a.example,IDE,doubleclick.net,390,true,true,None,Marketing_Advertising\n"
        "a.example,lang,a.example,30,true,false,Lax,Functional\n"
        "a.example,no_expiry,a.example,,true,false,Strict,Functional\n"
    )

    frame, audits = _load_inputs([path])

    assert frame.set_index("cookie_name")["same_site"].to_dict() == {"IDE": "None", "lang": "Lax"}
    assert audits[0]["missing_attributes"] == 1
    features = build_feature_matrix(frame)
    none_index = __import__(
        "backend.api.ml_classifier.feature_extractor_v5", fromlist=["FeatureExtractorV5"]
    ).FeatureExtractorV5().get_feature_names().index("same_site_none")
    assert features[frame.cookie_name.tolist().index("IDE"), none_index] == 1.0


def test_all_cookies_sets_keep_familiar_names_on_held_out_sites():
    from backend.scripts.train_cookie_model import all_rows_on_sites

    rows = []
    for index in range(10):
        site = f"site{index}.com"
        for name in ("_ga", f"own_{index}"):
            rows.append({"site_domain": site, "cookie_name": name, "cookie_domain": site,
                         "expiry_days": 30, "secure": True, "http_only": False, "same_site": "Lax",
                         "label": "Analytics_Performance"})
    frame = pd.DataFrame(rows)
    train, _, test, audit = split_by_site_domain(frame, test_fraction=0.2, calibration_fraction=0.2, seed=1)

    every = all_rows_on_sites(frame, audit["test_sites"])

    assert "_ga" not in set(test.cookie_name)  # strict test drops names seen in training
    assert set(every.site_domain) == set(audit["test_sites"])
    assert (every.cookie_name == "_ga").sum() == len(audit["test_sites"])
    assert set(every.site_domain).isdisjoint(train.site_domain)



@pytest.mark.parametrize("version", ["5.0.0", "6.5.0", "7.0.0"])
def test_v5_feature_extractor_serves_v5_through_v7_models(version):
    from backend.api.ml_classifier.feature_extractor_v5 import FeatureExtractorV5, get_feature_extractor_for_model

    assert isinstance(get_feature_extractor_for_model(version), FeatureExtractorV5)


def _declared(name, labels):
    return [{"site_domain": f"s{i}.com", "cookie_name": name, "label": label} for i, label in enumerate(labels)]


def test_consensus_accepts_labels_a_real_share_of_sites_gave():
    from backend.scripts.train_cookie_model import TRAINED_LABELS, acceptable_label_matrix

    classes = sorted(TRAINED_LABELS)
    reference = pd.DataFrame(
        _declared("__stripe_mid", ["Strictly_Necessary"] * 2 + ["Functional"] * 2)
        + _declared("_ga", ["Analytics_Performance"] * 9 + ["Marketing_Advertising"])
        + _declared("lang", ["Functional", "Strictly_Necessary"])  # two sites: too few to agree on anything
    )
    acceptable = acceptable_label_matrix(reference, reference, classes)
    allowed = [{classes[i] for i in np.flatnonzero(row)} for row in acceptable]

    assert allowed[0] == allowed[3] == {"Strictly_Necessary", "Functional"}
    assert allowed[4] == {"Analytics_Performance"}  # 1 of 10 sites saying Marketing is not consensus
    assert allowed[13] == {"Marketing_Advertising", "Analytics_Performance"}  # the site's own label always counts
    assert allowed[14] == {"Functional"} and allowed[15] == {"Strictly_Necessary"}


def test_consensus_scores_count_any_acceptable_prediction_as_correct():
    from backend.scripts.train_cookie_model import _consensus_scores

    classes = ["A", "B", "C", "D"]
    labels = np.array([0, 1, 2, 3])
    predictions = np.array([1, 1, 0, 3])
    acceptable = np.eye(4, dtype=bool)
    acceptable[0, 1] = True  # row 0 may be A or B: predicting B is right
    scores = _consensus_scores(predictions, labels, acceptable, classes)

    assert scores["accuracy"] == 0.75  # only row 2 (C predicted as A) is wrong
    assert scores["rows_with_several_acceptable_labels"] == 1


def test_gate_details_separate_unjudged_gates_from_failures():
    from argparse import Namespace
    from backend.scripts.train_cookie_model import gate_details

    def policy(predictions, sites, wilson, bootstrap):
        return {"eligible_predictions": predictions, "distinct_sites": sites, "accuracy": 0.94,
                "wilson_lower_bound": wilson, "site_bootstrap_lower_bound": bootstrap,
                "requirements": {"target_precision": 0.95, "minimum_predictions": 100, "minimum_sites": 20}}

    test = {"consensus": {"macro_f1": 0.44}, "per_class": {"Marketing_Advertising": {"recall": 0.49}},
            "auto_policy": policy(8, 8, 0.67, 1.0)}
    all_cookies = {"auto_policy": policy(887, 99, 0.925, 0.900)}
    cmp = {"requirements": {"maximum_gap": 0.05}, "per_cmp": {
        "onetrust": {"passed": True, "gap": -0.01}, "ketch": {"passed": None}}}
    split = {"site_domain_overlap": {"a": 0}, "cookie_name_family_overlap": {"a": 0}}
    internal = {"macro_f1": False, "marketing_recall": False, "auto_precision": False,
                "auto_precision_all_cookies": False, "per_cmp_macro_f1": True,
                "site_holdout_is_disjoint": True, "name_holdout_is_disjoint": True}
    gates = gate_details(internal, test, all_cookies, cmp, split, None, False,
                         Namespace(minimum_macro_f1=0.75, minimum_marketing_recall=0.70))

    assert gates["auto_precision"]["status"] == "not_enough_data"
    # Both lower bounds must reach the target, so the smaller one is reported.
    assert (gates["auto_precision_all_cookies"]["status"], gates["auto_precision_all_cookies"]["measured"]) == ("fail", 0.900)
    assert gates["per_cmp_macro_f1"]["detail"] == {"judged": ["onetrust"], "too_small": ["ketch"]}
    assert gates["external_holdout"]["status"] == "not_run"
    assert (gates["macro_f1"]["measured"], gates["macro_f1"]["required"], gates["macro_f1"]["test"]) == (0.44, 0.75, "unseen")
