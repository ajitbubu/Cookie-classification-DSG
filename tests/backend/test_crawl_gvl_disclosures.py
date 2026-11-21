"""TCF purpose → label mapping and disclosure parsing in backend/scripts/crawl_gvl_disclosures.py."""
from hypothesis import given, strategies as st

from backend.scripts.crawl_gvl_disclosures import disclosure_rows, label_for_purposes

LABELS = {"Marketing_Advertising", "Analytics_Performance", "Functional", "Strictly_Necessary", "Ambiguous"}
VENDOR = {"id": 7, "name": "Vendor", "purposes": [1, 2, 3, 4, 7], "legIntPurposes": []}


def test_advertising_wins_over_everything_else():
    assert label_for_purposes([1, 2, 8, 9])[0] == "Marketing_Advertising"


def test_measurement_only_is_analytics():
    assert label_for_purposes([1, 8, 9])[0] == "Analytics_Performance"


def test_personalisation_only_is_functional():
    assert label_for_purposes([1, 5, 6])[0] == "Functional"


def test_security_or_privacy_choice_only_is_necessary():
    assert label_for_purposes([1], [1])[0] == "Strictly_Necessary"
    assert label_for_purposes([], [3])[0] == "Strictly_Necessary"


def test_storage_only_or_ad_delivery_is_ambiguous():
    assert label_for_purposes([1])[0] == "Ambiguous"
    assert label_for_purposes([], [2])[0] == "Ambiguous"
    assert label_for_purposes([10])[0] == "Ambiguous"


@given(st.lists(st.integers(1, 11)), st.lists(st.integers(1, 3)))
def test_always_returns_a_known_label(purposes, special):
    assert label_for_purposes(purposes, special)[0] in LABELS


def test_disclosure_rows_keeps_cookies_and_flags_copied_vendor_purposes():
    disclosure = {"disclosures": [
        {"identifier": "uid", "type": "cookie", "domains": ["ads.example"], "maxAgeSeconds": 86400,
         "purposes": [1, 2, 3, 4, 7]},
        {"identifier": "sess", "type": "cookie", "domains": ["ads.example"], "purposes": [1], "specialPurposes": [1]},
        {"identifier": "ls_key", "type": "web", "purposes": [1]},
        {"type": "cookie", "purposes": [1]},
    ]}
    rows = {r["name"]: r for r in disclosure_rows(VENDOR, disclosure)}
    assert set(rows) == {"uid", "sess"}
    assert rows["uid"]["label"] == "Marketing_Advertising" and rows["uid"]["copiesVendorPurposes"]
    assert rows["sess"]["label"] == "Strictly_Necessary" and not rows["sess"]["copiesVendorPurposes"]
    assert rows["uid"]["domains"] == "ads.example"


def test_disclosure_rows_tolerates_missing_or_malformed_lists():
    assert disclosure_rows(VENDOR, {}) == []
    assert disclosure_rows(VENDOR, {"disclosures": None}) == []
    assert disclosure_rows(VENDOR, {"disclosures": ["junk", {"identifier": "a", "type": "cookie",
                                                            "purposes": None}]})[0]["label"] == "Ambiguous"
