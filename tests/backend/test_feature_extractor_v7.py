"""FeatureExtractorV7: learned name-pattern and cookie-domain features (model v7.1.0+)."""

import json

import numpy as np
import pandas as pd
import pytest
from hypothesis import given, settings, strategies as st

from backend.api.ml_classifier.feature_extractor_v5 import FeatureExtractorV5, get_feature_extractor_for_model
from backend.api.ml_classifier.feature_extractor_v7 import (
    LOOKUP_FILE,
    FeatureExtractorV7,
    normalize_cookie_name,
    registrable_domain,
)
from backend.scripts.train_cookie_model import (
    TRAINED_LABELS,
    fit_feature_lookups,
    out_of_fold_feature_matrix,
    parse_args,
    train,
)

CLASSES = sorted(TRAINED_LABELS)
# (name stem, cookie domain or None for the site itself, label)
KINDS = [
    ("sesstok", None, "Strictly_Necessary"),
    ("csrfguard", None, "Strictly_Necessary"),
    ("pxltrack", "adnet.com", "Marketing_Advertising"),
    ("adclick", "adnet.com", "Marketing_Advertising"),
    ("statsview", "metrics.io", "Analytics_Performance"),
    ("visitstat", "metrics.io", "Analytics_Performance"),
    ("prefui", None, "Functional"),
    ("langpick", None, "Functional"),
]


def site_rows(sites=30):
    rows = []
    for i in range(sites):
        site = f"site{i}.com"
        tag = chr(97 + i % 26) + chr(97 + i // 26)  # unique letters: a new name family per site
        for stem, domain, label in KINDS:
            for name in (stem, f"{stem}{tag}"):
                rows.append({"site_domain": site, "cookie_name": name, "cookie_domain": domain or site,
                             "expiry_days": 30, "secure": True, "http_only": False, "same_site": "Lax",
                             "label": label})
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def lookups():
    return fit_feature_lookups(site_rows(), CLASSES)


def sklearn_probabilities(frame, names):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True,
                                 lowercase=False)
    x = vectorizer.fit_transform(frame.cookie_name.map(normalize_cookie_name))
    y = frame.label.map({label: i for i, label in enumerate(CLASSES)})
    model = LogisticRegression(C=2.0, max_iter=2000, class_weight="balanced").fit(x, y)
    return model.predict_proba(vectorizer.transform([normalize_cookie_name(n) for n in names]))


NAMES = ["sesstok", "pxltrack_99", "Stats View 2024", "x", "", "  ", "statsviewzz", "zzz-unknown", "a b  c",
         "PrefUI_ABC123"]


def test_name_patterns_reproduce_scikit_learn_without_it(lookups):
    extractor = FeatureExtractorV7(lookups)
    ours = np.vstack([extractor.name_pattern_probabilities(name) for name in NAMES])
    np.testing.assert_allclose(ours, sklearn_probabilities(site_rows(), NAMES), atol=1e-9)


@settings(max_examples=150, deadline=None)
@given(st.text(alphabet=st.characters(min_codepoint=32, max_codepoint=0x24F), max_size=40))
def test_name_patterns_are_a_distribution_for_any_name(name):
    extractor = FeatureExtractorV7(LOOKUPS_FOR_PROPERTY)
    probabilities = extractor.name_pattern_probabilities(name)
    assert probabilities.shape == (len(CLASSES),)
    assert np.all(probabilities > 0) and probabilities.sum() == pytest.approx(1.0)


LOOKUPS_FOR_PROPERTY = fit_feature_lookups(site_rows(10), CLASSES)


def test_unseen_name_fragments_point_to_the_right_class(lookups):
    extractor = FeatureExtractorV7(lookups)
    predicted = {name: CLASSES[int(extractor.name_pattern_probabilities(name).argmax())]
                 for name in ("pxltrack_new", "sesstok_v2", "statsview_x")}
    assert predicted == {"pxltrack_new": "Marketing_Advertising", "sesstok_v2": "Strictly_Necessary",
                         "statsview_x": "Analytics_Performance"}


@pytest.mark.parametrize("domain,expected", [
    (".ads.example.com", "example.com"), ("example.com", "example.com"),
    ("shop.example.co.uk", "example.co.uk"), ("a.b.example.de", "example.de"), ("", ""), (".", ""),
])
def test_registrable_domain(domain, expected):
    assert registrable_domain(domain) == expected


def test_domain_features_count_sites_not_rows(lookups):
    extractor = FeatureExtractorV7(lookups)
    names = extractor.get_feature_names()
    features = dict(zip(names, extractor.extract_features({"name": "x", "domain": ".px.adnet.com"})))
    # adnet.com sets two Marketing cookies on each of 30 sites: 30 sites, not 60 rows
    assert features["cookie_domain_sites"] == pytest.approx(np.log1p(30))
    assert features["cookie_domain_share_Marketing_Advertising"] == pytest.approx((30 + 3 * 0.25) / 33)

    unknown = dict(zip(names, extractor.extract_features({"name": "x", "domain": "never-seen.org"})))
    assert unknown["cookie_domain_sites"] == 0
    assert [unknown[f"cookie_domain_share_{c}"] for c in CLASSES] == pytest.approx(lookups["cookie_domains"]["prior"])


def test_v7_keeps_v5_features_first_so_the_evidence_guard_still_applies(lookups):
    extractor = FeatureExtractorV7(lookups)
    cookie = {"name": "_ga", "domain": "example.com", "site_domain": "example.com", "expiry_days": 365}
    v5 = FeatureExtractorV5()
    assert extractor.get_feature_names()[:52] == v5.get_feature_names()
    assert len(extractor.get_feature_names()) == 61
    np.testing.assert_array_equal(extractor.extract_features(cookie)[:52], v5.extract_features(cookie))


def test_out_of_fold_features_never_use_the_rows_own_site():
    frame = site_rows()
    # A domain used by a single site: its own rows must not see it as known.
    lonely = frame.index[frame.site_domain == "site3.com"][:2]
    frame.loc[lonely, "cookie_domain"] = "only-site3.net"
    matrix = out_of_fold_feature_matrix(frame, CLASSES)
    names = FeatureExtractorV7(fit_feature_lookups(frame, CLASSES)).get_feature_names()
    assert np.all(matrix[lonely, names.index("cookie_domain_sites")] == 0)
    assert np.all(matrix[:, names.index("cookie_domain_sites")][frame.cookie_domain == "adnet.com"] > 0)


def test_extractor_dispatch_follows_the_lookup_file(tmp_path, lookups):
    assert isinstance(get_feature_extractor_for_model("7.0.0", tmp_path), FeatureExtractorV5)
    (tmp_path / LOOKUP_FILE).write_text(json.dumps(lookups))
    assert isinstance(get_feature_extractor_for_model("7.1.0", tmp_path), FeatureExtractorV7)


def test_trained_package_ships_verified_lookups_and_classifies(tmp_path, monkeypatch):
    from backend.api.ml_classifier import classifier as classifier_module

    data = tmp_path / "data.csv"
    site_rows().to_csv(data, index=False)
    out = tmp_path / "v7.1.0-test"
    train(parse_args(["--input", str(data), "--version", "7.1.0-test", "--output-dir", str(out),
                      "--package-dir", str(tmp_path / "pkg"), "--test-fraction", "0.2",
                      "--calibration-fraction", "0.2", "--estimators", "20", "--jobs", "1",
                      "--bootstrap-samples", "50"]))

    manifest = json.loads((out / "manifest.json").read_text())
    assert LOOKUP_FILE in manifest["files"]
    assert json.loads((out / "features.json").read_text())[-1] == "cookie_domain_sites"

    monkeypatch.setattr(classifier_module, "get_model_path", lambda version=None: out)
    model = classifier_module.CookieClassifier("7.1.0-test")
    assert isinstance(model.feature_extractor, FeatureExtractorV7)
    result = model.classify({"name": "pxltrack_fresh", "domain": ".adnet.com", "site_domain": "new-site.com",
                             "expiry_days": 30, "secure": True, "http_only": False, "same_site": "Lax"})
    assert result.predicted_category == "Marketing_Advertising"
    assert result.auto_classified is False  # gates fail on toy data: review only

    (out / LOOKUP_FILE).write_text("{}")
    with pytest.raises(RuntimeError, match="Checksum mismatch"):
        classifier_module.CookieClassifier("7.1.0-test")
