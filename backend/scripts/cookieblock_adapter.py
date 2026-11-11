#!/usr/bin/env python3
"""Turn the CookieBlock training JSON into a train-only 16-column dataset.

CookieBlock (ETH Zurich, Zenodo 5838646, CC BY 4.0) publishes cookies labeled
by each site's own OneTrust, Cookiebot or Termly declaration. This adapter:

* loads JSON only (pickle/joblib are refused, plan decision C8);
* never reads or writes cookie values;
* maps CookieBlock's integer labels to the v6 classes (D24); "unknown" rows
  are dropped and counted;
* drops rows without observed browser attributes (D5);
* drops every site whose registrable domain appears in our collection site
  list, any split (D7/D27: no leak into our test or holdout sites);
* removes duplicates and contradictions per (site, name, cookie domain, path);
* routes cookie-name families seen on >=3 sites with no label at >=80% to a
  review CSV, out of training (D10, per source).

The output is meant only for the trainer's ``--train-only-input``: it never
joins the site split, calibration or test partitions.

    input JSON ──► schema check ──► label map ──► attribute pick ──► site drop
         ──► dedupe/conflicts ──► D10 family review ──► train CSV
                                                     ├─► review CSV
                                                     ├─► sidecar (cmp, raw label)
                                                     └─► manifest
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator, Sequence

from backend.scripts.build_production_dataset import SCHEMA, cookie_name_family, normalize_domain, sha256

LABEL_SOURCE = "cmp_declaration_cookieblock"

# CookieBlock label order (README of Zenodo 5838646): 0 necessary, 1 functional,
# 2 analytics, 3 advertising, 4 uncategorized, 5 social media, 6 unknown.
RAW_LABEL_NAMES = {
    0: "necessary",
    1: "functional",
    2: "analytics",
    3: "advertising",
    4: "uncategorized",
    5: "social media",
    6: "unknown",
}
LABEL_MAP = {
    0: "Strictly_Necessary",
    1: "Functional",
    2: "Analytics_Performance",
    3: "Marketing_Advertising",
    4: "Unclassified",
    5: "Marketing_Advertising",
}
DROPPED_LABELS = {6}
CMP_NAMES = {0: "cookiebot", 1: "onetrust", 2: "termly"}

RECORD_FIELDS = ("name", "domain", "path", "first_party_domain", "label", "cmp_origin", "variable_data")
OBSERVATION_FIELDS = ("expiry", "session", "secure", "http_only", "host_only", "same_site")
SAME_SITE = {"lax": "Lax", "strict": "Strict", "no_restriction": "None", "none": "None"}
REFUSED_SUFFIXES = {".pkl", ".pickle", ".joblib", ".npy", ".npz", ".sqlite", ".db"}

_WHITESPACE = re.compile(r"[ \t\n\r]*")

REVIEW_MIN_SITES = 3
REVIEW_MIN_AGREEMENT = 0.8
DEDUPE_KEY = ("site_domain", "cookie_name", "cookie_domain", "path")

# Approximate registrable domain (eTLD+1) without a public-suffix dependency.
# Unknown multi-label suffixes collapse to the last two labels, which can only
# widen the match and drop more CookieBlock sites, never leak a listed site.
TWO_LEVEL_SUFFIXES = {
    "ac.in", "ac.jp", "ac.uk", "co.at", "co.id", "co.il", "co.in", "co.jp", "co.kr",
    "co.nz", "co.th", "co.uk", "co.za", "com.ar", "com.au", "com.br", "com.cn",
    "com.co", "com.eg", "com.es", "com.hk", "com.mx", "com.my", "com.ng", "com.pe",
    "com.ph", "com.pl", "com.sa", "com.sg", "com.tr", "com.tw", "com.ua", "com.vn",
    "edu.au", "gov.au", "gov.br", "gov.in", "gov.uk", "gov.za", "govt.nz", "ltd.uk",
    "me.uk", "ne.jp", "net.au", "net.br", "net.in", "net.uk", "or.jp", "org.au",
    "org.br", "org.in", "org.nz", "org.uk", "org.za", "plc.uk",
}


def registrable_domain(value: str) -> str:
    host = normalize_domain(value)
    labels = host.split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in TWO_LEVEL_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def load_excluded_domains(path: Path) -> set[str]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if "site_domain" not in (reader.fieldnames or []):
            raise ValueError(f"{path}: needs a site_domain column")
        return {registrable_domain(row["site_domain"]) for row in reader if row["site_domain"].strip()}


def iter_cookieblock(path: Path) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (key, record) pairs one at a time from the top-level JSON object.

    ``json.load`` on the 270 MB file builds ~1.9M dicts at once and was
    OOM-killed in the 8 GB Docker VM; decoding one record at a time keeps only
    the file text and the current record in memory.
    """
    suffix = path.suffix.lower()
    if suffix in REFUSED_SUFFIXES:
        raise ValueError(f"{path}: refusing {suffix} input; only plain JSON is loaded (pickle can run code)")
    if suffix != ".json":
        raise ValueError(f"{path}: unsupported format {suffix!r}; expected the CookieBlock training .json")
    text = path.read_text(encoding="utf-8")
    decoder = json.JSONDecoder()
    pos = _WHITESPACE.match(text, 0).end()
    if text[pos:pos + 1] != "{":
        raise ValueError(f"{path}: expected a JSON object keyed by cookie")
    pos = _WHITESPACE.match(text, pos + 1).end()
    if text[pos:pos + 1] == "}":
        return
    while True:
        key, pos = decoder.raw_decode(text, pos)
        pos = _WHITESPACE.match(text, pos).end()
        if not isinstance(key, str) or text[pos:pos + 1] != ":":
            raise ValueError(f"{path}: malformed JSON object near offset {pos}")
        record, pos = decoder.raw_decode(text, _WHITESPACE.match(text, pos + 1).end())
        if not isinstance(record, dict):
            raise ValueError(f"{path}: record {key!r} is not an object; CookieBlock schema changed")
        yield key, record
        pos = _WHITESPACE.match(text, pos).end()
        separator = text[pos:pos + 1]
        if separator == "}":
            return
        if separator != ",":
            raise ValueError(f"{path}: malformed JSON object near offset {pos}")
        pos = _WHITESPACE.match(text, pos + 1).end()


def _flag(value: Any) -> str:
    return "true" if value else "false"


def pick_attributes(observations: list[dict[str, Any]]) -> dict[str, str] | None:
    """One attribute set per cookie from its repeated observations.

    Flags take the most common combination. Expiry is the lower median of the
    observed lifetimes in whole days, rounded up, so a single bad reading (some first
    observations hold an absolute timestamp, e.g. 14,114 days for a 365-day
    cookie) cannot set it. A cookie seen as a session cookie in most
    observations is a session cookie (expiry 0, as in the legacy data).
    """
    usable = [
        obs for obs in observations
        if all(field in obs for field in OBSERVATION_FIELDS)
        and str(obs["same_site"]).lower() in SAME_SITE
    ]
    if not usable:
        return None
    flags = Counter(
        (bool(o["secure"]), bool(o["http_only"]), bool(o["host_only"]), SAME_SITE[str(o["same_site"]).lower()])
        for o in usable
    ).most_common(1)[0][0]
    persistent = [o for o in usable if not o["session"]]
    if len(persistent) * 2 <= len(usable):
        expiry_days = 0
    else:
        # Round up: a persistent cookie lasting under a day (e.g. _gid, 24 h)
        # must not read as 0, which means session.
        expiry_days = statistics.median_low(max(1, -(-int(o["expiry"]) // 86400)) for o in persistent)
    return {
        "expiry_days": str(expiry_days),
        "secure": _flag(flags[0]),
        "http_only": _flag(flags[1]),
        "host_only": _flag(flags[2]),
        "same_site": flags[3],
    }


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def adapt(
    source: Path,
    exclude_sites: Path,
    output: Path,
    review_output: Path,
    sidecar_output: Path,
    manifest_path: Path,
    crawl_date: str,
) -> dict[str, Any]:
    excluded_domains = load_excluded_domains(exclude_sites)
    dataset_source = f"cookieblock_{crawl_date}"

    counts: Counter[str] = Counter()
    raw_labels: Counter[str] = Counter()
    excluded_sites_seen: set[str] = set()
    rows: list[dict[str, str]] = []

    for key, record in iter_cookieblock(source):
        missing = [field for field in RECORD_FIELDS if field not in record]
        if missing:
            raise ValueError(f"{source}: record {key!r} lacks {missing}; CookieBlock schema changed")
        label, cmp_origin = record["label"], record["cmp_origin"]
        if label not in RAW_LABEL_NAMES:
            raise ValueError(f"{source}: record {key!r} has unknown label {label!r}")
        if cmp_origin not in CMP_NAMES:
            raise ValueError(f"{source}: record {key!r} has unknown cmp_origin {cmp_origin!r}")
        counts["input_records"] += 1
        raw_labels[RAW_LABEL_NAMES[label]] += 1
        if label in DROPPED_LABELS:
            counts["unknown_label_dropped"] += 1
            continue
        attributes = pick_attributes(record["variable_data"] or [])
        if attributes is None:
            counts["missing_attributes_dropped"] += 1
            continue
        site = normalize_domain(record["first_party_domain"])
        name = str(record["name"]).strip()
        cookie_domain = normalize_domain(record["domain"])
        if not site or not name or not cookie_domain:
            counts["missing_identity_dropped"] += 1
            continue
        if registrable_domain(site) in excluded_domains:
            counts["listed_site_rows_dropped"] += 1
            excluded_sites_seen.add(site)
            continue
        rows.append({
            "observation_id": "",
            "observed_at": crawl_date,
            "site_domain": site,
            "cookie_name": name,
            "cookie_domain": cookie_domain,
            "path": str(record["path"]).strip(),
            **attributes,
            "partitioned": "",
            "setter_domain": "",
            "label_category": LABEL_MAP[label],
            "label_source": LABEL_SOURCE,
            "dataset_source": dataset_source,
            "cmp": CMP_NAMES[cmp_origin],
            "raw_label": RAW_LABEL_NAMES[label],
        })

    by_key: dict[tuple[str, ...], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_key[tuple(row[field] for field in DEDUPE_KEY)].append(row)
    unique_rows = []
    for group in by_key.values():
        if len({row["label_category"] for row in group}) > 1:
            counts["contradictory_rows_removed"] += len(group)
            continue
        counts["duplicate_rows_removed"] += len(group) - 1
        unique_rows.append(group[0])

    family_sites: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for row in unique_rows:
        row["cookie_name_family"] = cookie_name_family(row["cookie_name"])
        family_sites[row["cookie_name_family"]][row["label_category"]].add(row["site_domain"])
    review_families = set()
    for family, votes in family_sites.items():
        sites = set().union(*votes.values())
        if len(sites) >= REVIEW_MIN_SITES and max(map(len, votes.values())) / len(sites) < REVIEW_MIN_AGREEMENT:
            review_families.add(family)

    train_rows, review_rows = [], []
    for row in unique_rows:
        identity = json.dumps(
            [*(row[field] for field in DEDUPE_KEY), row["label_category"], dataset_source],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        row["observation_id"] = "obs_" + hashlib.sha256(identity.encode("utf-8")).hexdigest()
        (review_rows if row["cookie_name_family"] in review_families else train_rows).append(row)
    sort_key = lambda row: tuple(row[field] for field in DEDUPE_KEY)  # noqa: E731
    train_rows.sort(key=sort_key)
    review_rows.sort(key=lambda row: (row["cookie_name_family"], *sort_key(row)))

    _write_csv(output, SCHEMA, train_rows)
    _write_csv(review_output, ["cookie_name_family", *SCHEMA, "cmp", "raw_label"], review_rows)
    _write_csv(sidecar_output, ["observation_id", "cmp", "raw_label"], train_rows)

    manifest = {
        "schema_version": "1.0.0",
        "columns": SCHEMA,
        "label_source": LABEL_SOURCE,
        "dataset_source": dataset_source,
        "use": "train-only (--train-only-input); never split, calibration, test or holdout",
        "source": {"file": str(source), "sha256": sha256(source)},
        "exclude_sites": {
            "file": str(exclude_sites),
            "sha256": sha256(exclude_sites),
            "registrable_domains": len(excluded_domains),
            "method": "approximate eTLD+1 (last two labels, three for listed two-level suffixes)",
            "cookieblock_sites_dropped": len(excluded_sites_seen),
        },
        "attribute_selection": "most common flag set; lower-median expiry in days; session when most observations are session",
        "raw_label_counts": dict(sorted(raw_labels.items())),
        "counts": {
            **{name: counts[name] for name in (
                "input_records",
                "unknown_label_dropped",
                "missing_attributes_dropped",
                "missing_identity_dropped",
                "listed_site_rows_dropped",
                "duplicate_rows_removed",
                "contradictory_rows_removed",
            )},
            "review_families": len(review_families),
            "review_rows": len(review_rows),
            "output_rows": len(train_rows),
        },
        "label_distribution": dict(sorted(Counter(row["label_category"] for row in train_rows).items())),
        "cmp_distribution": dict(sorted(Counter(row["cmp"] for row in train_rows).items())),
        "distinct_sites": len({row["site_domain"] for row in train_rows}),
        "outputs": {
            name: {"file": str(path), "sha256": sha256(path), "bytes": path.stat().st_size}
            for name, path in (("train", output), ("review", review_output), ("sidecar", sidecar_output))
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="CookieBlock training JSON (value-stripped copy)")
    parser.add_argument(
        "--exclude-sites",
        required=True,
        type=Path,
        help="CSV with a site_domain column; every listed registrable domain is dropped (collection_sites.csv)",
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--review-output", required=True, type=Path)
    parser.add_argument("--sidecar-output", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--crawl-date", required=True, help="CookieBlock crawl date, e.g. 2021-05-10")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    manifest = adapt(
        args.input,
        args.exclude_sites,
        args.output,
        args.review_output,
        args.sidecar_output,
        args.manifest,
        args.crawl_date,
    )
    print(json.dumps({**manifest["counts"], "label_distribution": manifest["label_distribution"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
