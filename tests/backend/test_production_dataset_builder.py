import csv
import json

from backend.scripts.build_production_dataset import SCHEMA, build_dataset


def test_build_dataset_normalizes_deduplicates_and_rejects_missing_identity(tmp_path):
    source = tmp_path / "source.csv"
    rows = [
        {
            "site_domain": "Example.COM",
            "cookie_name": "_ga",
            "cookie_domain": ".example.com",
            "expiry_days": "365.0",
            "secure": "1.0",
            "http_only": "false",
            "same_site": "lax",
            "label_category": "Analytics",
        },
        {
            "site_domain": "Example.COM",
            "cookie_name": "_ga",
            "cookie_domain": ".example.com",
            "expiry_days": "365.0",
            "secure": "1.0",
            "http_only": "false",
            "same_site": "lax",
            "label_category": "Analytics",
        },
        {
            "site_domain": "",
            "cookie_name": "missing_site",
            "cookie_domain": "example.com",
            "expiry_days": "0",
            "secure": "false",
            "http_only": "false",
            "same_site": "",
            "label_category": "Functional",
        },
    ]
    with source.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    output = tmp_path / "production.csv"
    manifest_path = tmp_path / "manifest.json"
    manifest = build_dataset([source], output, manifest_path, "fixture_v1")

    with output.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        output_rows = list(reader)

    assert reader.fieldnames == SCHEMA
    assert len(output_rows) == 1
    assert output_rows[0]["label_category"] == "Analytics_Performance"
    assert output_rows[0]["site_domain"] == "example.com"
    assert output_rows[0]["cookie_domain"] == "example.com"
    assert output_rows[0]["observation_id"].startswith("obs_")
    assert manifest["normalization"] == {
        "normalized_rows": 2,
        "duplicate_rows_removed": 1,
        "contradictory_rows_removed": 0,
        "output_rows": 1,
    }
    assert json.loads(manifest_path.read_text())["column_count"] == 16


BANNER_HEADER = ["category", "categorySource", "cmp", "name", "domain", "path", "party", "expires",
                 "declaredDuration", "httpOnly", "secure", "sameSite", "partitioned", "status",
                 "provider", "description"]


def banner_row(name, category="Strictly Necessary", source="banner", status="Declared & set",
               domain=".bank.com", expires="13 months", http_only="true", secure="true", same_site="lax"):
    return {"category": category, "categorySource": source, "cmp": "OneTrust", "name": name,
            "domain": domain, "path": "/", "party": "First party", "expires": expires,
            "declaredDuration": "399 days", "httpOnly": http_only, "secure": secure,
            "sameSite": same_site, "partitioned": "false", "status": status,
            "provider": "Adobe", "description": "Keeps the session"}


def write_banner_export(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=BANNER_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def build_banner(tmp_path, rows, name="cookies_www.bank.com_2026-11-02.csv"):
    source = tmp_path / name
    write_banner_export(source, rows)
    output, sidecar = tmp_path / "out.csv", tmp_path / "sidecar.csv"
    manifest = build_dataset([source], output, tmp_path / "m.json", "banner_collect_2026-11-02", sidecar)
    read = lambda p: list(csv.DictReader(p.open(newline="", encoding="utf-8")))
    return manifest, read(output), read(sidecar)


def test_banner_export_keeps_only_declared_and_set_banner_rows(tmp_path):
    manifest, rows, _ = build_banner(tmp_path, [
        banner_row("SESSIONID"),
        banner_row("declared_only", status="Declared, not set", expires="", http_only="", secure=""),
        banner_row("_gcl_au", category="Likely Marketing", source="guess", status="Not declared"),
        banner_row("mystery", category="Unclassified", source="none", status="Not declared"),
    ])

    assert [row["cookie_name"] for row in rows] == ["SESSIONID"]
    row = rows[0]
    assert row["label_source"] == "website_banner_explicit"
    assert row["site_domain"] == "www.bank.com"
    assert row["observed_at"] == "2026-11-02"
    assert row["cookie_domain"] == "bank.com"
    assert row["host_only"] == "false"
    assert row["expiry_days"] == "396"
    stats = manifest["sources"][0]
    assert (stats["format"], stats["declared_not_set"], stats["not_banner_declared"]) == ("banner_export", 1, 2)


def test_banner_export_maps_labels_and_drops_notice_titles(tmp_path):
    manifest, rows, _ = build_banner(tmp_path, [
        banner_row("a", category="Performance"),
        banner_row("b", category="Preference"),
        banner_row("c", category="Advertising"),
        banner_row("d", category="California Notice of Right to Opt-Out from Sale/Sharing"),
    ])

    assert {row["cookie_name"]: row["label_category"] for row in rows} == {
        "a": "Analytics_Performance", "b": "Functional", "c": "Marketing_Advertising"}
    assert manifest["sources"][0]["unsupported_label"] == 1


def test_banner_export_expiry_and_same_site(tmp_path):
    _, rows, _ = build_banner(tmp_path, [
        banner_row("session", expires="Session", same_site="no_restriction"),
        banner_row("hour", expires="1 hours", same_site="unspecified", domain="www.bank.com"),
        banner_row("year", expires="12 months", same_site="strict"),
        banner_row("odd", expires="soon"),
    ])

    got = {row["cookie_name"]: (row["expiry_days"], row["same_site"], row["host_only"]) for row in rows}
    assert got == {"session": ("0", "None", "false"), "hour": ("1", "Unknown", "true"),
                   "year": ("365", "Strict", "false")}


def test_banner_export_writes_evidence_sidecar_outside_the_schema(tmp_path):
    _, rows, sidecar = build_banner(tmp_path, [banner_row("SESSIONID")])

    assert sidecar == [{"observation_id": rows[0]["observation_id"], "cmp": "onetrust",
                        "raw_label": "Strictly Necessary", "provider": "Adobe",
                        "description": "Keeps the session"}]
    assert list(rows[0]) == SCHEMA


def test_banner_export_needs_site_and_date_in_file_name(tmp_path):
    import pytest

    source = tmp_path / "export.csv"
    write_banner_export(source, [banner_row("x")])
    with pytest.raises(ValueError, match="cookies_<site>_<YYYY-MM-DD>.csv"):
        build_dataset([source], tmp_path / "o.csv", tmp_path / "m.json", "x")


def test_banner_category_names_from_onetrust_sites():
    from backend.scripts.build_production_dataset import normalize_label

    expected = {
        "Strictly Necessary Cookies": "Strictly_Necessary",
        "Required Cookies": "Strictly_Necessary",
        "Targeting Cookies": "Marketing_Advertising",
        "First Party Targeting Cookies": "Marketing_Advertising",
        "Advertising & Targeting Cookies": "Marketing_Advertising",
        "Personalized Advertising": "Marketing_Advertising",
        "Functionality Cookies": "Functional",
        "First Party Functional Cookies": "Functional",
        "Performance cookies": "Analytics_Performance",
        "Analytics and Performance": "Analytics_Performance",
        "Store and access information on a device": "",
        "GPC": "",
        "Session Capture": "",
        "Cookies": "",
    }
    assert {name: normalize_label(name) for name in expected} == expected
