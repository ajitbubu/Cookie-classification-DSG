"""Known-cookie table: website majorities first, then the Open Cookie Database."""

import csv
import json

import pytest

from backend.api.ml_classifier.known_cookies import KnownCookies, site_majority
from backend.scripts import build_known_cookies


def test_site_majority_needs_three_sites_and_two_thirds():
    assert site_majority({"Marketing_Advertising": 2}) is None  # too few sites
    assert site_majority({"Marketing_Advertising": 2, "Analytics_Performance": 2}) is None  # no clear majority
    assert site_majority({"Marketing_Advertising": 4, "Analytics_Performance": 2}) == ("Marketing_Advertising", 4, 6)
    assert site_majority(None) is None


TABLE = {
    "families": {"_ga": {"Analytics_Performance": 40, "Marketing_Advertising": 3},
                 "__stripe_mid": {"Strictly_Necessary": 8, "Functional": 7}},
    "open_cookie_database": {
        "exact": {"__stripe_mid": {"category": "Strictly_Necessary", "platform": "Stripe"},
                  "_ga": {"category": "Marketing_Advertising", "platform": "Google Analytics"}},
        "prefix": [["_hjsession", "Analytics_Performance", "Hotjar"], ["_hj", "Marketing_Advertising", "Hotjar"]],
    },
    "ocd_agreement": {"Strictly_Necessary": {"checked": 10, "agreement": 0.6}},
    "iab_gvl": {
        "exact": {"__stripe_mid": {"category": "Marketing_Advertising", "platform": "Ad Vendor"},
                  "uuid2": {"category": "Marketing_Advertising", "platform": "Xandr"}},
        "prefix": [["dtm_session_", "Marketing_Advertising", "Dotomi"]],
    },
    "gvl_agreement": {"Marketing_Advertising": {"checked": 50, "agreement": 0.9}},
}


@pytest.fixture
def known():
    return KnownCookies(TABLE)


def test_website_majority_wins_and_matches_name_families(known):
    match = known.lookup("_ga_ABC123")  # per-site suffix stripped -> _ga
    assert match["category"] == "Analytics_Performance" and match["source"] == "website_declarations"
    assert (match["sites"], match["total_sites"]) == (40, 43)
    assert match["confidence"] == pytest.approx(40 / 43)


def test_open_cookie_database_used_when_websites_split(known):
    match = known.lookup("__stripe_mid")
    assert match["source"] == "open_cookie_database" and match["category"] == "Strictly_Necessary"
    assert match["platform"] == "Stripe" and match["confidence"] == 0.6
    assert match["site_split"] == {"Strictly_Necessary": 8, "Functional": 7}


def test_wildcard_prefix_takes_the_longest_match(known):
    assert known.lookup("_hjSessionUser_123")["category"] == "Analytics_Performance"
    assert known.lookup("_hjFirstSeen")["category"] == "Marketing_Advertising"


def test_iab_gvl_used_after_the_open_cookie_database(known):
    assert known.lookup("__stripe_mid")["source"] == "open_cookie_database"  # OCD wins when both list it
    match = known.lookup("uuid2")
    assert match["source"] == "iab_gvl" and match["category"] == "Marketing_Advertising"
    assert match["platform"] == "Xandr" and match["confidence"] == 0.9
    assert known.lookup("dtm_session_42")["platform"] == "Dotomi"


def test_unknown_or_empty_names_return_none(known):
    assert known.lookup("xq7_unlisted") is None
    assert known.lookup("") is None and known.lookup(None) is None


def test_missing_table_means_model_only(tmp_path):
    assert KnownCookies.load(tmp_path / "absent.json") is None


def _write(path, header, rows):
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def test_builder_counts_sites_maps_ocd_and_drops_short_wildcards(tmp_path):
    banner = tmp_path / "banner.csv"
    _write(banner, ["site_domain", "cookie_name", "label_category"], [
        ["a.com", "_fbp", "Marketing_Advertising"], ["a.com", "_fbp", "Marketing_Advertising"],  # same site twice
        ["b.com", "_fbp", "Marketing_Advertising"], ["c.com", "_fbp", "Marketing_Advertising"],
        ["d.com", "odd", "Unclassified"],
    ])
    ocd = tmp_path / "ocd.csv"
    _write(ocd, ["Platform", "Category", "Cookie / Data Key name", "Wildcard match"], [
        ["Meta", "Marketing", "_fbp", "0"], ["Site", "Functional", "PHPSESSID", "0"],
        ["Hotjar", "Analytics", "_hjSession", "1"], ["Marfeel", "Analytics", "_s", "1"],
        ["X", "Unmapped", "foo", "0"],
    ])
    out = tmp_path / "known.json"
    table = build_known_cookies.main(["--declarations", str(banner), "--open-cookie-database", str(ocd), "--output", str(out)])
    assert json.loads(out.read_text()) == table
    assert table["families"] == {"_fbp": {"Marketing_Advertising": 3}}
    assert table["open_cookie_database"]["exact"]["phpsessid"]["category"] == "Strictly_Necessary"
    assert "foo" not in table["open_cookie_database"]["exact"]
    assert [p[0] for p in table["open_cookie_database"]["prefix"]] == ["_hjsession"]
    assert table["ocd_agreement"] == {"Marketing_Advertising": {"checked": 1, "agreement": 1.0}}
    assert table["iab_gvl"] == {"exact": {}, "prefix": []}


def test_builder_reads_gvl_advertising_rows_and_safe_wildcards(tmp_path):
    banner = tmp_path / "banner.csv"
    _write(banner, ["site_domain", "cookie_name", "label_category"],
           [[f"{s}.com", "uuid2", "Marketing_Advertising"] for s in "abc"])
    gvl = tmp_path / "gvl.csv"
    _write(gvl, ["label", "name", "vendorName"], [
        ["Marketing_Advertising", "uuid2", "Xandr"], ["Marketing_Advertising", "uuid2", "Other"],  # first vendor kept
        ["Marketing_Advertising", "DotomiSession_*", "Dotomi"],  # trailing * -> prefix
        ["Marketing_Advertising", "ab*", "Short"],  # prefix too short
        ["Marketing_Advertising", "*uxid", "Lead"], ["Marketing_Advertising", "*udc*", "Inner"],
        ["Ambiguous", "storage_only", "V"], ["Analytics_Performance", "few_rows", "V"],
    ])
    table = build_known_cookies.main(["--declarations", str(banner), "--gvl-disclosures", str(gvl),
                                      "--output", str(tmp_path / "known.json")])
    assert table["iab_gvl"]["exact"] == {"uuid2": {"category": "Marketing_Advertising", "platform": "Xandr"}}
    assert table["iab_gvl"]["prefix"] == [["dotomisession_", "Marketing_Advertising", "Dotomi"]]
    assert table["gvl_agreement"] == {"Marketing_Advertising": {"checked": 1, "agreement": 1.0}}
    assert table["sources"][-1]["kind"] == "iab_gvl"


def test_shipped_table_loads_and_knows_common_cookies():
    from backend.api.ml_routes import get_known_cookies
    known = get_known_cookies()
    assert known is not None
    assert known.lookup("_fbp")["category"] == "Marketing_Advertising"
