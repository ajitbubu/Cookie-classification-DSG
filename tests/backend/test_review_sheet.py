"""Blind labelling sheet for held-out cookies, and scoring against reviewed labels."""

import json

import numpy as np
import pandas as pd
import pytest

from backend.scripts import build_review_sheet
from backend.scripts.train_cookie_model import (
    TRAINED_LABELS,
    _reviewed_scores,
    load_reviewed_labels,
    parse_args,
    train,
)

CLASSES = sorted(TRAINED_LABELS)
KINDS = [("sesstok", None, "Strictly_Necessary"), ("pxltrack", "adnet.com", "Marketing_Advertising"),
         ("statsview", "metrics.io", "Analytics_Performance"), ("prefui", None, "Functional")]


def dataset(sites=30):
    rows = []
    for i in range(sites):
        site = f"site{i}.com"
        tag = chr(97 + i % 26) + chr(97 + i // 26)
        for stem, domain, label in KINDS:
            for name in (stem, f"{stem}{tag}"):
                rows.append({"observation_id": f"obs_{site}_{name}", "site_domain": site, "cookie_name": name,
                             "cookie_domain": domain or site, "expiry_days": 30, "secure": True,
                             "http_only": False, "same_site": "Lax", "label_category": label})
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    root = tmp_path_factory.mktemp("review")
    data = root / "data.csv"
    dataset().to_csv(data, index=False)
    sidecar = root / "sidecar.csv"
    pd.DataFrame({"observation_id": dataset().observation_id, "cmp": "onetrust", "provider": "Acme",
                  "description": "Keeps you signed in"}).to_csv(sidecar, index=False)
    model = root / "model"
    train(parse_args(["--input", str(data), "--version", "7.1.0-test", "--output-dir", str(model),
                      "--package-dir", str(root / "pkg"), "--test-fraction", "0.2", "--calibration-fraction",
                      "0.2", "--estimators", "20", "--jobs", "1", "--bootstrap-samples", "50"]))
    return root, data, sidecar, model


def test_sheet_holds_exactly_the_models_unseen_test_rows_and_hides_labels(trained):
    root, data, sidecar, model = trained
    sheet = build_review_sheet.main(["--model-dir", str(model), "--input", str(data),
                                     "--evidence-sidecar", str(sidecar), "--output", str(root / "sheet.csv")])
    metadata = json.loads((model / "metadata.json").read_text())
    assert len(sheet) == metadata["test_samples"]
    assert set(sheet.site_domain) <= set(metadata["dataset"]["split"]["test_sites"])
    assert not {"label", "label_category", "predicted_category"} & set(sheet.columns)
    assert (sheet.reviewed_label == "").all()
    assert set(sheet.party) == {"first", "third"}
    assert (sheet.banner_description == "Keeps you signed in").all()


def test_sheet_refuses_a_dataset_that_does_not_reproduce_the_split(trained):
    root, _, _, model = trained
    other = root / "other.csv"
    dataset(40).to_csv(other, index=False)
    with pytest.raises(ValueError, match="does not reproduce"):
        build_review_sheet.main(["--model-dir", str(model), "--input", str(other), "--output", str(root / "x.csv")])


def test_reviewed_labels_accept_codes_skip_blanks_and_reject_typos(tmp_path):
    sheet = tmp_path / "sheet.csv"
    pd.DataFrame({"observation_id": ["a", "b", "c", "d"], "reviewed_label": ["sn", " M ", "", "?"]}).to_csv(sheet, index=False)
    assert load_reviewed_labels([sheet]) == {"a": "Strictly_Necessary", "b": "Marketing_Advertising", "d": None}

    pd.DataFrame({"observation_id": ["a"], "reviewed_label": ["Analytic"]}).to_csv(sheet, index=False)
    with pytest.raises(ValueError, match="line 2"):
        load_reviewed_labels([sheet])


def test_reviewed_scores_use_the_reviewers_label_not_the_websites():
    rows = pd.DataFrame({"observation_id": ["a", "b", "c", "d"], "site_domain": ["s1", "s1", "s2", "s3"],
                         "label": ["Strictly_Necessary"] * 4})
    index = {label: i for i, label in enumerate(CLASSES)}
    predictions = np.array([index["Analytics_Performance"]] * 2 + [index["Strictly_Necessary"]] * 2)
    reviewed = {"a": "Analytics_Performance", "b": "Analytics_Performance", "c": None}
    scores = _reviewed_scores(predictions, rows, CLASSES, reviewed)
    assert (scores["rows_reviewed"], scores["rows_unsure"], scores["rows_scored"]) == (3, 1, 2)
    assert scores["accuracy"] == 1.0
    assert scores["website_label_agreement"] == 0.0
    assert _reviewed_scores(predictions, rows, CLASSES, {}) is None


def test_trainer_reports_reviewed_scores_from_a_filled_sheet(trained, tmp_path):
    root, data, sidecar, _ = trained
    sheet = build_review_sheet.main(["--model-dir", str(trained[3]), "--input", str(data),
                                     "--output", str(tmp_path / "sheet.csv")])
    sheet["reviewed_label"] = "?"
    sheet.loc[sheet.cookie_name.str.startswith("pxl"), "reviewed_label"] = "M"
    sheet.to_csv(tmp_path / "sheet.csv", index=False)
    model = tmp_path / "model"
    train(parse_args(["--input", str(data), "--version", "7.1.0-test", "--output-dir", str(model),
                      "--package-dir", str(tmp_path / "pkg"), "--test-fraction", "0.2", "--calibration-fraction",
                      "0.2", "--estimators", "20", "--jobs", "1", "--bootstrap-samples", "50",
                      "--reviewed-labels", str(tmp_path / "sheet.csv")]))
    metadata = json.loads((model / "metadata.json").read_text())
    reviewed = metadata["metrics"]["internal_site_holdout"]["reviewed"]
    assert reviewed["rows_reviewed"] == len(sheet)
    assert reviewed["rows_scored"] == int(sheet.cookie_name.str.startswith("pxl").sum())
    assert reviewed["website_label_agreement"] == 1.0
    assert metadata["dataset"]["reviewed_labels"][0]["sha256"]
