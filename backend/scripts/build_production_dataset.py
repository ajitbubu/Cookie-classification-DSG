#!/usr/bin/env python3
"""Build the canonical 16-column cookie-classification dataset.

The builder uses only raw observable cookie fields, normalizes labels to the
v6 taxonomy, removes duplicate observations, and discards contradictory or
identity-incomplete rows. Unknown provenance fields remain empty rather than
being inferred.

Inputs are either legacy CSVs (one row per labeled cookie) or banner exports
named ``cookies_<site>_<YYYY-MM-DD>.csv`` (detected by their header). From a
banner export only cookies the site's banner declared *and* the browser set are
kept, labeled ``website_banner_explicit``; guessed or undeclared rows are not
labels and are counted, never trained on.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlparse


SCHEMA = [
    "observation_id",
    "observed_at",
    "site_domain",
    "cookie_name",
    "cookie_domain",
    "path",
    "expiry_days",
    "secure",
    "http_only",
    "same_site",
    "host_only",
    "partitioned",
    "setter_domain",
    "label_category",
    "label_source",
    "dataset_source",
]

LABEL_ALIASES = {
    "analytics": "Analytics_Performance",
    "analytics performance": "Analytics_Performance",
    "analytics and performance": "Analytics_Performance",
    "measure performance": "Analytics_Performance",
    "performance": "Analytics_Performance",
    "statistical": "Analytics_Performance",
    "statistics": "Analytics_Performance",            # Cookiebot
    "performance & analytics": "Analytics_Performance",  # Ketch
    "performance analytics": "Analytics_Performance",    # Ketch
    "analytics & performance": "Analytics_Performance",  # Ketch
    "analytic & performance": "Analytics_Performance",   # Ketch
    "third party analytics": "Analytics_Performance",    # Ketch
    "functional": "Functional",
    "personalization": "Functional",
    "personalisation": "Functional",
    "functionality": "Functional",
    "preference": "Functional",
    "extend functionality": "Functional",
    "preferences": "Functional",
    "functional technologies": "Functional",             # Ketch
    "advertising": "Marketing_Advertising",
    "marketing": "Marketing_Advertising",
    "marketing advertising": "Marketing_Advertising",
    "personalized advertising": "Marketing_Advertising",
    "personalised advertising": "Marketing_Advertising",
    "personalize advertising": "Marketing_Advertising",
    "social media tracking": "Marketing_Advertising",
    "social networking": "Marketing_Advertising",
    "targeting": "Marketing_Advertising",
    "targeted advertising": "Marketing_Advertising",  # Ketch
    "behavioral advertising": "Marketing_Advertising",  # Ketch
    "marketing and advertising": "Marketing_Advertising",  # Ketch
    "sharing for targeted advertising": "Marketing_Advertising",  # Ketch
    "social media, marketing, and advertising technologies": "Marketing_Advertising",  # Ketch
    "advertising & targeting": "Marketing_Advertising",
    "advertising and targeting": "Marketing_Advertising",
    "sales, sharing, and targeting": "Marketing_Advertising",
    "strictly necessary": "Strictly_Necessary",
    "strictly neccessary": "Strictly_Necessary",
    "necessary": "Strictly_Necessary",
    "essential": "Strictly_Necessary",
    "essential services": "Strictly_Necessary",       # Ketch
    "essential product functions & services": "Strictly_Necessary",  # Ketch
    "essential technologies": "Strictly_Necessary",   # Ketch
    "required": "Strictly_Necessary",
    "security": "Strictly_Necessary",
    "operate the site and core services": "Strictly_Necessary",
    # OneTrust batch 3 (2026-11-11), incl. Dutch and German banners
    "performance and analytical technology": "Analytics_Performance",
    "performance and analytics": "Analytics_Performance",
    "performance/analytics": "Analytics_Performance",
    "performance/analytical": "Analytics_Performance",
    "performance tracking technologies": "Analytics_Performance",
    "performance technologies": "Analytics_Performance",
    "analytics/performance": "Analytics_Performance",
    "analytics/performance cookies and pixel tracking": "Analytics_Performance",
    "analytics/site monitoring": "Analytics_Performance",
    "google analytics": "Analytics_Performance",
    "analytische": "Analytics_Performance",
    "leistungs": "Analytics_Performance",
    "functional tracking technologies": "Functional",
    "functional/personalization tracking technologies": "Functional",
    "functionality technology": "Functional",
    "functionele": "Functional",
    "funktionelle": "Functional",
    "targeting tracking technologies": "Marketing_Advertising",
    "targeting technologies": "Marketing_Advertising",
    "targeting & advertising": "Marketing_Advertising",
    "targeting and advertising": "Marketing_Advertising",
    "targeting/advertising": "Marketing_Advertising",
    "advertising/targeting": "Marketing_Advertising",
    "advertising (targeting)": "Marketing_Advertising",
    "advertising and social media": "Marketing_Advertising",
    "advertising and marketing": "Marketing_Advertising",
    "retargeting or advertising technology": "Marketing_Advertising",
    "social media": "Marketing_Advertising",
    "ad personalization": "Marketing_Advertising",
    "cookies für marketingzwecke": "Marketing_Advertising",
    "strictly necessary tracking technologies": "Strictly_Necessary",
    "strictly necessary technology": "Strictly_Necessary",
    "strictly necessary technologies": "Strictly_Necessary",
    "necessary tracking technologies": "Strictly_Necessary",
    "essential website": "Strictly_Necessary",
    "unbedingt erforderliche": "Strictly_Necessary",
    # All-vendor batch 5 (2026-11-11), incl. Spanish and Swedish banners
    "analysis or measurement": "Analytics_Performance",
    "cookies de análisis o medición": "Analytics_Performance",
    "analysis": "Analytics_Performance",
    "analytical": "Analytics_Performance",
    "statistics and analysis": "Analytics_Performance",
    "statistiska och analytiska": "Analytics_Performance",
    "prestanda kakor": "Analytics_Performance",
    "funktionella": "Functional",
    "funktionella kakor": "Functional",
    "customisation": "Functional",
    "preference or personalization": "Functional",
    "cookies de preferencias o personalización": "Functional",
    "targeting / advertising": "Marketing_Advertising",
    "targeting and social media": "Marketing_Advertising",
    "targeting and marketing": "Marketing_Advertising",
    "cookies de publicidad": "Marketing_Advertising",
    "marknadsföring": "Marketing_Advertising",
    "profiling": "Marketing_Advertising",
    "cross contextual behavioral advertising": "Marketing_Advertising",
    "essential cookies (always active)": "Strictly_Necessary",
    "always on": "Strictly_Necessary",
    "technical": "Strictly_Necessary",
    "technical/strictly necessary": "Strictly_Necessary",
    "cookies estrictamente necesarias y técnicas": "Strictly_Necessary",
    "absolut nödvändiga kakor": "Strictly_Necessary",
    "nödvändiga": "Strictly_Necessary",
    # Round 6 (2026-11-11)
    "targeting & marketing": "Marketing_Advertising",
    "targeting or marketing": "Marketing_Advertising",
    "targeting or advertising": "Marketing_Advertising",
    "targeting & social media": "Marketing_Advertising",
    "cookies for advertising purposes": "Marketing_Advertising",
    "selling, sharing, targeted advertising": "Marketing_Advertising",
    "marketing technologien": "Marketing_Advertising",
    "google ads technologien": "Marketing_Advertising",
    "analyse technologien": "Analytics_Performance",
    "performance technologien": "Analytics_Performance",
    "analytical and statistical": "Analytics_Performance",
    "analytics (partner)": "Analytics_Performance",
    "analytics and/or performance": "Analytics_Performance",
    "functionality or preference": "Functional",
    "unbedingt erforderliche technologien": "Strictly_Necessary",
    "essential cookies (strictly necessary)": "Strictly_Necessary",
    "website operation": "Strictly_Necessary",
    # Round 7 (2026-11-11), incl. Canadian French "témoins"
    "targeted advertising & social media": "Marketing_Advertising",
    "marketing & advertising": "Marketing_Advertising",
    "témoins pour une publicité ciblée": "Marketing_Advertising",
    "user analytics": "Analytics_Performance",
    "témoins de performance": "Analytics_Performance",
    "témoins de fonctionnalité": "Functional",
    "témoins strictement nécessaires": "Strictly_Necessary",
    # Round 8 (2026-11-11)
    "performance cookies (or analytics cookies)": "Analytics_Performance",
    "performance measurement": "Analytics_Performance",
    "analytics and measurement": "Analytics_Performance",
    "targeting cookies (or advertising cookies)": "Marketing_Advertising",
    "advertising/marketing": "Marketing_Advertising",
    # Round 9 (2026-11-11)
    "targeting/advertising/do not sell or share for cross context behavioral advertising": "Marketing_Advertising",
    "sales, sharing, and targeted advertising": "Marketing_Advertising",
    "marketing and targeted advertising": "Marketing_Advertising",
    "targeted advertising & data selling or sharing": "Marketing_Advertising",
    "website performance measurement": "Analytics_Performance",
    "analytic and performance": "Analytics_Performance",
    "analysis and statistics": "Analytics_Performance",
    "always active": "Strictly_Necessary",
    # Round 10 (2026-11-11)
    "data analytics": "Analytics_Performance",
    "performance and analytical": "Analytics_Performance",
    "analytics information": "Analytics_Performance",
    "analytics & tracking": "Analytics_Performance",
    "piwik analytics": "Analytics_Performance",
    "advertising & marketing": "Marketing_Advertising",
    "basic ads": "Marketing_Advertising",
    "functional or customization": "Functional",
    "functional & personalisation": "Functional",
    "technically necessary": "Strictly_Necessary",
    "security, prevent fraud, and debug": "Strictly_Necessary",
    # Round 11 (2026-11-12), incl. Italian and Dutch banners
    "cookie per pubblicità mirata": "Marketing_Advertising",
    "cookie dei social media": "Marketing_Advertising",
    "offsite targeting: marketing and personalisation": "Marketing_Advertising",
    "social media & marketing": "Marketing_Advertising",
    "advertentie": "Marketing_Advertising",
    "cookie analytics": "Analytics_Performance",
    "cookie di performance di terzi": "Analytics_Performance",
    "analytical / performance": "Analytics_Performance",
    "performance & analytical": "Analytics_Performance",
    "session replay": "Analytics_Performance",
    "personalisatie": "Functional",
    "cookie strettamente necessari": "Strictly_Necessary",
    "noodzakelijke": "Strictly_Necessary",
    # Round 12 (2026-11-12)
    "ad targeting": "Marketing_Advertising",
    "internal marketing": "Marketing_Advertising",
    "marketing and customer engagement": "Marketing_Advertising",
    "strictly necessary cookies (always active)": "Strictly_Necessary",
    # Round 15 (2026-11-12), incl. Dutch, Italian and Portuguese banners
    "opt out of sale or sharing/targeted advertising": "Marketing_Advertising",
    "advertising and social media cookies, web beacons/pixel tags, and similar tracking technologies": "Marketing_Advertising",
    "retargeting cookies, web beacons/pixel tags, and similar tracking technologies": "Marketing_Advertising",
    "targeted advertising cookies:": "Marketing_Advertising",
    "cookie di profilazione": "Marketing_Advertising",
    "doelgroepgerichte": "Marketing_Advertising",
    "relevante advertenties tonen buiten onze online kanalen zoals bijvoorbeeld meta of google": "Marketing_Advertising",
    "performance and analytical cookies, web beacons/pixel tags, and similar tracking technologies": "Analytics_Performance",
    "analytical/performance": "Analytics_Performance",
    "prestatiecookies": "Analytics_Performance",
    "cookies de desempenho": "Analytics_Performance",
    "essential functionality": "Strictly_Necessary",
    "strikt noodzakelijke": "Strictly_Necessary",
    "cookies estritamente necessários": "Strictly_Necessary",
    # Round 16 (2026-11-12)
    "targeted advertising / social media": "Marketing_Advertising",
    "targeting cookies and third party embeds": "Marketing_Advertising",
    "advertising & marketing (eea)": "Marketing_Advertising",
    "retargeting/advertising": "Marketing_Advertising",
    "performance / analytical": "Analytics_Performance",
    "enhanced site functionality": "Functional",
    "operationally necessary": "Strictly_Necessary",
    "unclassified": "Unclassified",
    "unknown": "Unclassified",
    "uncategorized": "Unclassified",
}

BANNER_EXPORT_COLUMNS = {
    "category", "categorySource", "cmp", "name", "domain", "path", "expires",
    "httpOnly", "secure", "sameSite", "partitioned", "status",
}
BANNER_EXPORT_NAME = re.compile(r"^cookies_(?P<site>.+)_(?P<date>\d{4}-\d{2}-\d{2})\.csv$")
BANNER_LABEL_SOURCE = "website_banner_explicit"
SIDECAR_FIELDS = ["observation_id", "cmp", "raw_label", "provider", "description"]
_EXPORT_DURATION = re.compile(r"^(?P<count>\d+(?:\.\d+)?)\s*(?P<unit>minute|hour|day|week|month|year)s?$")
_DAYS_PER_UNIT = {"minute": 1 / 1440, "hour": 1 / 24, "day": 1, "week": 7, "month": 30.44, "year": 365.25}

OBSERVATION_FIELDS = [
    "site_domain",
    "cookie_name",
    "cookie_domain",
    "expiry_days",
    "secure",
    "http_only",
    "same_site",
]


_IDENTIFIER_SUFFIX = re.compile(r"[_-][^_-]*\d[^_-]*$")


def cookie_name_family(name: str) -> str:
    """Group cookie names that differ only by per-site identifier suffixes.

    Trailing ``_``/``-`` segments containing a digit are identifiers
    (``_ga_ABC123``, ``_hjSessionUser_123``, ``AWSALB_e0xu``), so they are
    stripped until the remaining tail is a plain word.
    """
    family = str(name).strip().lower()
    while True:
        stripped = _IDENTIFIER_SUFFIX.sub("", family)
        if stripped == family or not stripped:
            return family
        family = stripped


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_domain(value: str | None) -> str:
    text = (value or "").strip().lower()
    if "://" in text:
        text = urlparse(text).hostname or ""
    return text.lstrip(".").split("/", 1)[0]


def normalize_boolean(value: str | None) -> str:
    text = (value or "").strip().lower()
    if text in {"1", "1.0", "true", "yes", "y"}:
        return "true"
    if text in {"0", "0.0", "false", "no", "n"}:
        return "false"
    return ""


def normalize_expiry(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    try:
        return str(max(0, int(float(text))))
    except ValueError:
        return ""


def normalize_same_site(value: str | None) -> str:
    text = (value or "").strip().lower()
    return {"lax": "Lax", "strict": "Strict", "none": "None", "no_restriction": "None"}.get(text, "Unknown")


def parse_export_expiry(value: str | None) -> str:
    """Turn an export's observed lifetime ("Session", "13 months", "1 hours") into days.

    A persistent cookie never becomes 0 (the session value): sub-day lifetimes
    round up to 1. Anything unrecognised is blank, so the row counts as unobserved.
    """
    text = (value or "").strip().lower()
    if text == "session":
        return "0"
    match = _EXPORT_DURATION.match(text)
    if not match:
        return ""
    days = float(match["count"]) * _DAYS_PER_UNIT[match["unit"]]
    return str(max(1, round(days)))


def normalize_label(value: str | None) -> str:
    """Map a category name to the taxonomy; banner names like "First Party Targeting Cookies" reduce to "targeting"."""
    text = (value or "").replace("\u200b", "").strip().replace("_", " ").replace("-", " ")
    text = " ".join(text.lower().split())
    if text.endswith(" always active"):  # OneTrust's toggle label read with the category name
        text = text[: -len(" always active")]
    if text.startswith("first party "):
        text = text[len("first party "):]
    if text.endswith(" cookies"):
        text = text[: -len(" cookies")]
    return LABEL_ALIASES.get(text, "")


def normalize_row(row: dict[str, str], dataset_source: str) -> dict[str, str]:
    return {
        "observation_id": "",
        "observed_at": "",
        "site_domain": normalize_domain(row.get("site_domain") or row.get("website_domain")),
        "cookie_name": (row.get("cookie_name") or row.get("name") or "").strip(),
        "cookie_domain": normalize_domain(row.get("cookie_domain") or row.get("domain")),
        "path": (row.get("path") or "").strip(),
        "expiry_days": normalize_expiry(row.get("expiry_days")),
        "secure": normalize_boolean(row.get("secure")),
        "http_only": normalize_boolean(row.get("http_only") or row.get("httpOnly")),
        "same_site": normalize_same_site(row.get("same_site") or row.get("sameSite")),
        "host_only": normalize_boolean(row.get("host_only")),
        "partitioned": normalize_boolean(row.get("partitioned")),
        "setter_domain": normalize_domain(row.get("setter_domain")),
        "label_category": normalize_label(
            row.get("label_category") or row.get("label") or row.get("category")
        ),
        "label_source": "legacy_import_unverified",
        "dataset_source": dataset_source,
    }


def normalize_banner_export_row(
    row: dict[str, str], site_domain: str, observed_at: str, dataset_source: str
) -> dict[str, str]:
    domain = (row.get("domain") or "").strip()
    normalized = {
        "observation_id": "",
        "observed_at": observed_at,
        "site_domain": normalize_domain(site_domain),
        "cookie_name": (row.get("name") or "").strip(),
        "cookie_domain": normalize_domain(domain),
        "path": (row.get("path") or "").strip(),
        "expiry_days": parse_export_expiry(row.get("expires")),
        "secure": normalize_boolean(row.get("secure")),
        "http_only": normalize_boolean(row.get("httpOnly")),
        "same_site": normalize_same_site(row.get("sameSite")),
        "host_only": ("false" if domain.startswith(".") else "true") if domain else "",
        "partitioned": normalize_boolean(row.get("partitioned")),
        "setter_domain": "",
        "label_category": normalize_label(row.get("category")),
        "label_source": BANNER_LABEL_SOURCE,
        "dataset_source": dataset_source,
    }
    normalized["_evidence"] = {
        "cmp": (row.get("cmp") or "").strip().lower(),
        "raw_label": (row.get("category") or "").strip(),
        "provider": (row.get("provider") or "").strip(),
        "description": (row.get("description") or "").strip(),
    }
    return normalized


def build_dataset(
    inputs: Iterable[Path],
    output: Path,
    manifest_path: Path,
    dataset_source: str,
    sidecar_path: Path | None = None,
) -> dict[str, object]:
    input_paths = list(inputs)
    normalized_rows: list[dict[str, str]] = []
    source_stats = []

    for path in input_paths:
        stats = {
            "file": str(path),
            "sha256": sha256(path),
            "input_rows": 0,
            "accepted_rows": 0,
            "missing_identity": 0,
            "unsupported_label": 0,
        }
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            banner_export = BANNER_EXPORT_COLUMNS <= set(reader.fieldnames or [])
            if banner_export:
                name = BANNER_EXPORT_NAME.match(path.name)
                if not name:
                    raise ValueError(
                        f"{path.name}: banner exports must be named cookies_<site>_<YYYY-MM-DD>.csv"
                    )
                stats.update(format="banner_export", not_banner_declared=0, declared_not_set=0,
                             missing_attributes=0)
            for raw_row in reader:
                stats["input_rows"] += 1
                if banner_export:
                    if (raw_row.get("categorySource") or "").strip() != "banner":
                        stats["not_banner_declared"] += 1
                        continue
                    if (raw_row.get("status") or "").strip() != "Declared & set":
                        stats["declared_not_set"] += 1
                        continue
                    row = normalize_banner_export_row(
                        raw_row, name["site"], name["date"], dataset_source
                    )
                else:
                    row = normalize_row(raw_row, dataset_source)
                if not row["site_domain"] or not row["cookie_name"] or not row["cookie_domain"]:
                    stats["missing_identity"] += 1
                    continue
                if not row["label_category"]:
                    stats["unsupported_label"] += 1
                    continue
                if banner_export and not all(
                    row[field] for field in ("expiry_days", "secure", "http_only")
                ):
                    stats["missing_attributes"] += 1
                    continue
                normalized_rows.append(row)
                stats["accepted_rows"] += 1
        source_stats.append(stats)

    rows_by_observation: dict[tuple[str, ...], dict[str, dict[str, str]]] = defaultdict(dict)
    for row in normalized_rows:
        observation = tuple(row[field] for field in OBSERVATION_FIELDS)
        rows_by_observation[observation].setdefault(row["label_category"], row)

    clean_rows = []
    contradictory_rows_removed = 0
    for observation, labeled_rows in rows_by_observation.items():
        if len(labeled_rows) != 1:
            contradictory_rows_removed += len(labeled_rows)
            continue
        row = next(iter(labeled_rows.values()))
        identity = json.dumps(
            [*observation, row["label_category"], dataset_source],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        row["observation_id"] = "obs_" + hashlib.sha256(identity.encode("utf-8")).hexdigest()
        clean_rows.append(row)

    clean_rows.sort(
        key=lambda row: tuple(row[field] for field in OBSERVATION_FIELDS)
        + (row["label_category"],)
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SCHEMA, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(clean_rows)

    if sidecar_path is not None:
        sidecar_path.parent.mkdir(parents=True, exist_ok=True)
        with sidecar_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=SIDECAR_FIELDS, lineterminator="\n")
            writer.writeheader()
            writer.writerows(
                {"observation_id": row["observation_id"], **row["_evidence"]}
                for row in clean_rows
                if "_evidence" in row
            )

    completeness = {
        field: sum(bool(row[field]) for row in clean_rows)
        for field in SCHEMA
    }
    label_distribution: dict[str, int] = defaultdict(int)
    for row in clean_rows:
        label_distribution[row["label_category"]] += 1

    manifest = {
        "schema_version": "1.0.0",
        "columns": SCHEMA,
        "column_count": len(SCHEMA),
        "dataset_source": dataset_source,
        "sources": source_stats,
        "normalization": {
            "normalized_rows": len(normalized_rows),
            "duplicate_rows_removed": len(normalized_rows)
            - sum(len(labels) for labels in rows_by_observation.values()),
            "contradictory_rows_removed": contradictory_rows_removed,
            "output_rows": len(clean_rows),
        },
        "label_distribution": dict(sorted(label_distribution.items())),
        "non_empty_values_by_column": completeness,
        "output": {
            "file": str(output),
            "sha256": sha256(output),
            "bytes": output.stat().st_size,
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--dataset-source", required=True)
    parser.add_argument("--sidecar", type=Path, help="Evidence CSV for banner-export rows (never a model feature)")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    manifest = build_dataset(
        args.input,
        args.output,
        args.manifest,
        args.dataset_source,
        args.sidecar,
    )
    print(json.dumps(manifest["normalization"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
