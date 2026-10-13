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
