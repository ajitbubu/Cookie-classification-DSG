"""Build the known-cookie table that scans check before the ML model.

Two kinds of evidence go in:

* Website declarations: the category each website gives a cookie in its own
  consent banner (our banner collection and CookieBlock). Counted as websites
  per category, per cookie name family (``_ga_ABC123`` -> ``_ga``).
* The Open Cookie Database (Apache 2.0): one curated category per cookie name,
  some entries matching any name that starts with them (``Wildcard match``).
  Its categories are mapped to ours, and the share of its entries that agree
  with a clear website majority is recorded per category, so a match can carry
  an honest confidence.

Usage:
  python -m backend.scripts.build_known_cookies \
      --declarations models/training_data/banner/banner_all_2026-11-11b.csv \
      --declarations models/training_data/external/cookieblock/cookieblock_train_2021-05-10.csv \
      --open-cookie-database models/training_data/external/ocd/open-cookie-database.csv \
      --output models/known_cookies/known_cookies.json
"""

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, Sequence

from backend.api.ml_classifier.known_cookies import MAJORITY_MIN_SITES, MAJORITY_MIN_SHARE, site_majority
from backend.scripts.build_production_dataset import cookie_name_family, sha256

# Shorter wildcards ("_s", "ct") would catch unrelated cookies such as "_session".
OCD_MIN_PREFIX = 4

TRAINED_LABELS = {"Strictly_Necessary", "Functional", "Analytics_Performance", "Marketing_Advertising"}

# Open Cookie Database category -> ours. Its "Functional" means needed for the
# site to work (113 of 186 matches agree with Strictly Necessary on banners);
# "Personalization" is what banners call Functional.
OCD_CATEGORY_MAP = {
    "Functional": "Strictly_Necessary",
    "Security": "Strictly_Necessary",
    "Necessary": "Strictly_Necessary",
    "Personalization": "Functional",
    "Analytics": "Analytics_Performance",
    "Marketing": "Marketing_Advertising",
}


def website_declarations(paths: Sequence[Path]) -> Dict[str, Dict[str, int]]:
    """Name family -> {category: websites declaring it}; each website counted once per category."""
    sites = defaultdict(lambda: defaultdict(set))
    for path in paths:
        with Path(path).open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                label, name = row.get("label_category", ""), row.get("cookie_name", "")
                if label in TRAINED_LABELS and name.strip():
                    sites[cookie_name_family(name)][label].add(row["site_domain"])
    return {family: {label: len(s) for label, s in sorted(by.items())} for family, by in sorted(sites.items())}


def open_cookie_database(path: Path) -> Dict[str, list]:
    """Exact names and wildcard prefixes with our category, skipping categories we can't map."""
    exact, prefix = {}, []
    with Path(path).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            category = OCD_CATEGORY_MAP.get(row.get("Category", "").strip())
            name = row.get("Cookie / Data Key name", "").strip()
            if not category or not name:
                continue
            entry = {"category": category, "platform": row.get("Platform", "").strip()}
            if row.get("Wildcard match", "").strip() == "1":
                if len(name) < OCD_MIN_PREFIX:
                    continue
                prefix.append([name.lower(), entry["category"], entry["platform"]])
            else:
                exact.setdefault(name.lower(), entry)
    prefix.sort(key=lambda item: (-len(item[0]), item[0]))  # longest prefix first
    return {"exact": dict(sorted(exact.items())), "prefix": prefix}


def ocd_agreement(ocd: Dict[str, list], families: Dict[str, Dict[str, int]]) -> Dict[str, dict]:
    """Per mapped category: how often an OCD entry agrees with a clear website majority."""
    tally = defaultdict(Counter)
    for name, entry in ocd["exact"].items():
        majority = site_majority(families.get(cookie_name_family(name)))
        if majority:
            tally[entry["category"]]["agree" if majority[0] == entry["category"] else "disagree"] += 1
    return {
        category: {"checked": c["agree"] + c["disagree"], "agreement": round(c["agree"] / (c["agree"] + c["disagree"]), 3)}
        for category, c in sorted(tally.items())
    }


def build(declarations: Sequence[Path], ocd_path: Path | None) -> dict:
    families = website_declarations(declarations)
    ocd = open_cookie_database(ocd_path) if ocd_path else {"exact": {}, "prefix": []}
    sources = [{"path": str(p), "sha256": sha256(Path(p)), "kind": "website_declarations"} for p in declarations]
    if ocd_path:
        sources.append({"path": str(ocd_path), "sha256": sha256(Path(ocd_path)), "kind": "open_cookie_database",
                        "license": "Apache-2.0", "url": "https://github.com/jkwakman/Open-Cookie-Database"})
    return {
        "built": date.today().isoformat(),
        "rule": {"majority_min_sites": MAJORITY_MIN_SITES, "majority_min_share": MAJORITY_MIN_SHARE,
                 "ocd_min_prefix": OCD_MIN_PREFIX,
                 "order": ["website_majority", "open_cookie_database"]},
        "sources": sources,
        "ocd_category_map": OCD_CATEGORY_MAP,
        "ocd_agreement": ocd_agreement(ocd, families),
        "families": families,
        "open_cookie_database": ocd,
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--declarations", action="append", required=True, help="Banner-style CSV; repeatable")
    parser.add_argument("--open-cookie-database", help="Open Cookie Database CSV")
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> dict:
    args = parse_args(argv)
    table = build([Path(p) for p in args.declarations], Path(args.open_cookie_database) if args.open_cookie_database else None)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(table, separators=(",", ":")) + "\n")
    majorities = sum(1 for counts in table["families"].values() if site_majority(counts))
    print(f"{len(table['families'])} name families, {majorities} with a clear website majority; "
          f"{len(table['open_cookie_database']['exact'])} OCD names + {len(table['open_cookie_database']['prefix'])} prefixes -> {output}")
    print("OCD agreement with website majorities: " + json.dumps(table["ocd_agreement"]))
    return table


if __name__ == "__main__":
    main()
