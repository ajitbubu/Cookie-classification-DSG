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
* The IAB TCF Global Vendor List: cookies that ad-tech vendors disclose for
  advertising purposes (``crawl_gvl_disclosures.py`` output, ``Marketing_Advertising``
  rows only; its other labels are too sparse to trust). Checked after the OCD, with
  the vendor as the platform and the same agreement-based confidence.

Usage:
  python -m backend.scripts.build_known_cookies \
      --declarations models/training_data/banner/banner_all_2026-11-11b.csv \
      --declarations models/training_data/external/cookieblock/cookieblock_train_2021-05-10.csv \
      --open-cookie-database models/training_data/external/ocd/open-cookie-database.csv \
      --gvl-disclosures models/training_data/external/iab_gvl/disclosures_v186.csv \
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


GVL_LABEL = "Marketing_Advertising"


def iab_gvl(path: Path) -> Dict[str, list]:
    """Advertising cookies vendors disclose in the GVL: exact names, and ``name*`` as a prefix."""
    exact, prefix = {}, {}
    with Path(path).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            name, vendor = row.get("name", "").strip(), row.get("vendorName", "").strip()
            if row.get("label") != GVL_LABEL or not name:
                continue
            stem = name[:-1] if name.endswith("*") else name
            if "*" in stem:  # leading or inner wildcards ("*uxid", "*udc*") match too much
                continue
            if stem != name:
                if len(stem) >= OCD_MIN_PREFIX:
                    prefix.setdefault(stem.lower(), vendor)
            else:
                exact.setdefault(name.lower(), {"category": GVL_LABEL, "platform": vendor})
    prefixes = sorted(([p, GVL_LABEL, v] for p, v in prefix.items()), key=lambda item: (-len(item[0]), item[0]))
    return {"exact": dict(sorted(exact.items())), "prefix": prefixes}


def ocd_agreement(ocd: Dict[str, list], families: Dict[str, Dict[str, int]]) -> Dict[str, dict]:
    """Per mapped category: how often a list entry (OCD or GVL) agrees with a clear website majority."""
    tally = defaultdict(Counter)
    for name, entry in ocd["exact"].items():
        majority = site_majority(families.get(cookie_name_family(name)))
        if majority:
            tally[entry["category"]]["agree" if majority[0] == entry["category"] else "disagree"] += 1
    return {
        category: {"checked": c["agree"] + c["disagree"], "agreement": round(c["agree"] / (c["agree"] + c["disagree"]), 3)}
        for category, c in sorted(tally.items())
    }


def build(declarations: Sequence[Path], ocd_path: Path | None, gvl_path: Path | None = None) -> dict:
    families = website_declarations(declarations)
    ocd = open_cookie_database(ocd_path) if ocd_path else {"exact": {}, "prefix": []}
    gvl = iab_gvl(gvl_path) if gvl_path else {"exact": {}, "prefix": []}
    sources = [{"path": str(p), "sha256": sha256(Path(p)), "kind": "website_declarations"} for p in declarations]
    if ocd_path:
        sources.append({"path": str(ocd_path), "sha256": sha256(Path(ocd_path)), "kind": "open_cookie_database",
                        "license": "Apache-2.0", "url": "https://github.com/jkwakman/Open-Cookie-Database"})
    if gvl_path:
        sources.append({"path": str(gvl_path), "sha256": sha256(Path(gvl_path)), "kind": "iab_gvl",
                        "url": "https://vendor-list.consensu.org/v3/vendor-list.json"})
    return {
        "built": date.today().isoformat(),
        "rule": {"majority_min_sites": MAJORITY_MIN_SITES, "majority_min_share": MAJORITY_MIN_SHARE,
                 "ocd_min_prefix": OCD_MIN_PREFIX,
                 "order": ["website_majority", "open_cookie_database", "iab_gvl"]},
        "sources": sources,
        "ocd_category_map": OCD_CATEGORY_MAP,
        "ocd_agreement": ocd_agreement(ocd, families),
        "families": families,
        "open_cookie_database": ocd,
        "gvl_agreement": ocd_agreement(gvl, families),
        "iab_gvl": gvl,
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--declarations", action="append", required=True, help="Banner-style CSV; repeatable")
    parser.add_argument("--open-cookie-database", help="Open Cookie Database CSV")
    parser.add_argument("--gvl-disclosures", help="crawl_gvl_disclosures.py CSV (IAB TCF vendor disclosures)")
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> dict:
    args = parse_args(argv)
    table = build([Path(p) for p in args.declarations], Path(args.open_cookie_database) if args.open_cookie_database else None,
                  Path(args.gvl_disclosures) if args.gvl_disclosures else None)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(table, separators=(",", ":")) + "\n")
    majorities = sum(1 for counts in table["families"].values() if site_majority(counts))
    print(f"{len(table['families'])} name families, {majorities} with a clear website majority; "
          f"{len(table['open_cookie_database']['exact'])} OCD names + {len(table['open_cookie_database']['prefix'])} prefixes -> {output}")
    print("OCD agreement with website majorities: " + json.dumps(table["ocd_agreement"]))
    print(f"{len(table['iab_gvl']['exact'])} GVL names + {len(table['iab_gvl']['prefix'])} prefixes; "
          "agreement: " + json.dumps(table["gvl_agreement"]))
    return table


if __name__ == "__main__":
    main()
