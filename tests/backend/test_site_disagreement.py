"""Cookies websites label differently: built by the trainer, shipped with the model."""

import pandas as pd

from backend.api.ml_classifier.site_disagreement import SiteDisagreement
from backend.scripts.train_cookie_model import site_label_disagreement


def declared(name, labels):
    return [{"site_domain": f"site{i}.com", "cookie_name": name, "label": label} for i, label in enumerate(labels)]


FRAME = pd.DataFrame(
    declared("__stripe_mid", ["Strictly_Necessary"] * 3 + ["Functional"] * 2)
    + declared("_ga_ABC123", ["Analytics_Performance"] * 3 + ["Marketing_Advertising"] * 2)
    + declared("_ga_XYZ789", ["Analytics_Performance"] * 2)
    + declared("sessionid", ["Strictly_Necessary"] * 6 + ["Functional"])  # 1 of 7 sites: under 30%
    + declared("rare", ["Strictly_Necessary", "Functional"])  # only 2 sites
)


def test_only_families_split_by_a_real_share_of_enough_sites_are_disputed():
    table = site_label_disagreement(FRAME)
    assert table["families"] == {
        "__stripe_mid": {"Functional": 2, "Strictly_Necessary": 3},
        # _ga_ABC123 and _ga_XYZ789 are one family; sites, not rows, are counted
        "_ga": {"Analytics_Performance": 3, "Marketing_Advertising": 2},
    }
    assert table["rule"] == {"minimum_sites": 3, "minimum_share": 0.3}


def test_split_matches_by_name_family_and_lists_the_larger_side_first():
    lookup = SiteDisagreement(site_label_disagreement(FRAME))
    assert list(lookup.split("__stripe_mid").items()) == [("Strictly_Necessary", 3), ("Functional", 2)]
    assert lookup.split("_ga_NEWSITE1") == {"Analytics_Performance": 3, "Marketing_Advertising": 2}
    assert lookup.split("sessionid") is None
    assert lookup.split(None) is None


def test_models_without_the_table_report_no_split(tmp_path):
    assert SiteDisagreement.load(tmp_path) is None
