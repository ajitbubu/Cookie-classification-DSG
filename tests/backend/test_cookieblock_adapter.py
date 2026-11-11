import csv
import json

import pytest

from backend.scripts.build_production_dataset import SCHEMA
from backend.scripts.cookieblock_adapter import adapt, pick_attributes, registrable_domain

DAY = 86400


def observation(expiry_days=365, session=False, secure=False, http_only=False, host_only=True, same_site="lax"):
    return {
        "value": "SECRET-COOKIE-VALUE",
        "expiry": expiry_days * DAY,
        "session": session,
        "secure": secure,
        "http_only": http_only,
        "host_only": host_only,
        "same_site": same_site,
    }


def record(name, site, label, cmp_origin=0, domain=None, observations=None):
    return {
        "visit_id": 1,
        "name": name,
        "domain": domain or site,
        "path": "/",
        "first_party_domain": f"https://{site}/",
        "label": label,
        "cmp_origin": cmp_origin,
        "variable_data": observations if observations is not None else [observation()],
    }


def run(tmp_path, records, listed_sites=("ours.com",)):
    source = tmp_path / "cookieblock.json"
    source.write_text(json.dumps({f"{r['name']};{r['domain']};/;{r['first_party_domain']}#{i}": r
                                  for i, r in enumerate(records)}))
    sites = tmp_path / "collection_sites.csv"
    sites.write_text("site_domain,split\n" + "".join(f"{s},train\n" for s in listed_sites))
    paths = {name: tmp_path / f"{name}.csv" for name in ("train", "review", "sidecar")}
    manifest = adapt(source, sites, paths["train"], paths["review"], paths["sidecar"],
                     tmp_path / "manifest.json", "2021-05-10")
    read = {name: list(csv.DictReader(path.open(encoding="utf-8"))) for name, path in paths.items()}
    return manifest, read, paths


def test_maps_every_cookieblock_label_and_drops_unknown(tmp_path):
    records = [record(f"c{label}", f"site{label}.com", label) for label in range(7)]
    manifest, read, _ = run(tmp_path, records)

    labels = {row["cookie_name"]: row["label_category"] for row in read["train"]}
    assert labels == {
        "c0": "Strictly_Necessary",
        "c1": "Functional",
        "c2": "Analytics_Performance",
        "c3": "Marketing_Advertising",
        "c4": "Unclassified",
        "c5": "Marketing_Advertising",
    }
    assert manifest["counts"]["unknown_label_dropped"] == 1
    assert {row["label_source"] for row in read["train"]} == {"cmp_declaration_cookieblock"}
    assert {row["dataset_source"] for row in read["train"]} == {"cookieblock_2021-05-10"}


def test_output_has_schema_and_no_cookie_values(tmp_path):
    _, read, paths = run(tmp_path, [record("_ga", "a.com", 2)])

    with paths["train"].open(encoding="utf-8") as handle:
        assert csv.DictReader(handle).fieldnames == SCHEMA
    for path in [*paths.values(), tmp_path / "manifest.json"]:
        assert "SECRET-COOKIE-VALUE" not in path.read_text(encoding="utf-8")
    assert read["train"][0]["observation_id"].startswith("obs_")


def test_termly_rows_kept_and_tagged_in_sidecar(tmp_path):
    manifest, read, _ = run(tmp_path, [record("t", "a.com", 0, cmp_origin=2)])

    assert read["sidecar"] == [{"observation_id": read["train"][0]["observation_id"], "cmp": "termly",
                                "raw_label": "necessary"}]
    assert manifest["cmp_distribution"] == {"termly": 1}


def test_listed_sites_dropped_by_registrable_domain(tmp_path):
    records = [
        record("a", "shop.ours.com", 0),
        record("b", "www.ours.com", 0),
        record("c", "theirs.co.uk", 0),
        record("d", "keep.com", 0),
    ]
    manifest, read, _ = run(tmp_path, records, listed_sites=("ours.com", "www.theirs.co.uk"))

    assert [row["site_domain"] for row in read["train"]] == ["keep.com"]
    assert manifest["counts"]["listed_site_rows_dropped"] == 3


def test_registrable_domain_handles_two_level_suffixes():
    assert registrable_domain("https://www.shop.example.co.uk/x") == "example.co.uk"
    assert registrable_domain(".cdn.example.com") == "example.com"


def test_rows_without_observed_attributes_dropped(tmp_path):
    manifest, read, _ = run(tmp_path, [record("x", "a.com", 0, observations=[]),
                                       record("y", "b.com", 0, observations=[{"expiry": 1}])])

    assert read["train"] == []
    assert manifest["counts"]["missing_attributes_dropped"] == 2


def test_attribute_pick_ignores_one_bad_expiry_and_uses_common_flags():
    picked = pick_attributes([
        observation(expiry_days=14114, secure=True),
        observation(expiry_days=365),
        observation(expiry_days=365),
    ])
    assert picked == {"expiry_days": "365", "secure": "false", "http_only": "false",
                      "host_only": "true", "same_site": "Lax"}
    assert pick_attributes([observation(expiry_days=14114), observation(expiry_days=365)])["expiry_days"] == "365"
    assert pick_attributes([observation(session=True), observation(session=True), observation()])["expiry_days"] == "0"
    assert pick_attributes([observation(same_site="no_restriction")])["same_site"] == "None"


def test_short_persistent_cookie_is_not_a_session_cookie():
    under_a_day = dict(observation(), expiry=86399)
    assert pick_attributes([under_a_day])["expiry_days"] == "1"
    assert pick_attributes([dict(observation(), expiry=0)])["expiry_days"] == "1"
    assert pick_attributes([observation(expiry_days=365)])["expiry_days"] == "365"


def test_duplicates_merged_and_contradictions_removed(tmp_path):
    records = [
        record("dup", "a.com", 0, domain=".a.com"),
        record("dup", "a.com", 0, domain="a.com"),
        record("clash", "a.com", 0),
        record("clash", "a.com", 3, domain=".a.com"),
    ]
    manifest, read, _ = run(tmp_path, records)

    assert [row["cookie_name"] for row in read["train"]] == ["dup"]
    assert manifest["counts"]["duplicate_rows_removed"] == 1
    assert manifest["counts"]["contradictory_rows_removed"] == 2


def test_disputed_family_goes_to_review_and_not_training(tmp_path):
    disputed = [record("_x_1a", "a.com", 2), record("_x_2b", "b.com", 2), record("_x", "c.com", 3)]
    agreed = [record("_ga", f"s{i}.com", 2) for i in range(4)] + [record("_ga", "s9.com", 3)]
    single = [record("only_here", "z.com", 1)]
    manifest, read, _ = run(tmp_path, disputed + agreed + single)

    assert {row["cookie_name_family"] for row in read["review"]} == {"_x"}
    assert len(read["review"]) == 3
    assert {row["cookie_name"] for row in read["train"]} == {"_ga", "only_here"}
    assert manifest["counts"]["review_families"] == 1


@pytest.mark.parametrize("name", ["cookieblock.pkl", "cookieblock.joblib", "cookieblock.sqlite"])
def test_refuses_non_json_inputs(tmp_path, name):
    source = tmp_path / name
    source.write_bytes(b"not loaded")
    sites = tmp_path / "sites.csv"
    sites.write_text("site_domain\nours.com\n")
    with pytest.raises(ValueError, match="refusing"):
        adapt(source, sites, tmp_path / "t.csv", tmp_path / "r.csv", tmp_path / "s.csv", tmp_path / "m.json", "2021-05-10")


def test_schema_change_aborts_before_writing(tmp_path):
    broken = record("x", "a.com", 0)
    del broken["cmp_origin"]
    with pytest.raises(ValueError, match="schema changed"):
        run(tmp_path, [broken])
    assert not (tmp_path / "train.csv").exists()


def test_unexpected_label_aborts(tmp_path):
    with pytest.raises(ValueError, match="unknown label"):
        run(tmp_path, [record("x", "a.com", 9)])


def test_streaming_reader_matches_json_load(tmp_path):
    from backend.scripts.cookieblock_adapter import iter_cookieblock

    data = {"a;x.com;/;https://x.com/": record("a", "x.com", 0), "b;y.com;/;https://y.com/": record("b", "y.com", 1)}
    pretty = tmp_path / "pretty.json"
    pretty.write_text(json.dumps(data, indent=2))
    assert dict(iter_cookieblock(pretty)) == data

    empty = tmp_path / "empty.json"
    empty.write_text(" { } ")
    assert list(iter_cookieblock(empty)) == []

    for bad in ("[1, 2]", '{"a": {} "b": {}}'):
        broken = tmp_path / "broken.json"
        broken.write_text(bad)
        with pytest.raises(ValueError):
            list(iter_cookieblock(broken))
