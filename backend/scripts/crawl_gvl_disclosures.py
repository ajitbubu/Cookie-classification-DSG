#!/usr/bin/env python3
"""Turn the IAB TCF Global Vendor List (GVL) into candidate cookie labels.

The GVL itself only lists vendors and their TCF purposes; it names no cookies. Each
vendor does publish a ``deviceStorageDisclosureUrl``: a JSON file listing the cookies
it sets (``identifier``, ``domains``, ``maxAgeSeconds``, ``purposes``). This script:

1. Downloads the current GVL (or reads a saved copy) and saves it as
   ``vendor-list-v<N>.json`` in the output directory.
2. Fetches every active vendor's disclosure file (stdlib only, threaded).
3. Collapses each cookie's TCF purposes into one of the model's four labels
   (``label_for_purposes``), or ``Ambiguous`` when the purposes don't settle it.
4. Writes ``disclosures_v<N>.csv`` (one row per disclosed cookie) and
   ``summary_v<N>.json`` (label counts, fetch failures).

Nothing here feeds training yet: the CSV is for inspecting the label spread first.

    python -m backend.scripts.crawl_gvl_disclosures --out-dir models/known_cookies/sources/iab_gvl
    python -m backend.scripts.crawl_gvl_disclosures --gvl saved-vendor-list.json --out-dir ...
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

GVL_URL = "https://vendor-list.consensu.org/v3/vendor-list.json"
USER_AGENT = "cookie-classifier-gvl-crawler/1.0"
MAX_BYTES = 5 * 1024 * 1024

# TCF v2.2 purpose ids, grouped by the model label they imply.
ADVERTISING = {2, 3, 4, 7}          # select ads, ad profiles, measure ad performance
ANALYTICS = {8, 9}                  # measure content, audience statistics
PERSONALISATION = {5, 6, 11}        # content profiles / selection
NECESSARY_SPECIAL = {1, 3}          # special purposes: security & fraud, save privacy choices

COLUMNS = [
    "label", "labelRule", "name", "domains", "type", "maxAgeSeconds", "cookieRefresh",
    "purposes", "specialPurposes", "copiesVendorPurposes", "vendorId", "vendorName",
]


def label_for_purposes(purposes, special_purposes=()) -> tuple[str, str]:
    """Map a disclosure's TCF purposes to (label, rule). Strongest signal wins."""
    p, sp = set(purposes or ()), set(special_purposes or ())
    if p & ADVERTISING:
        return "Marketing_Advertising", "advertising purpose (2/3/4/7)"
    if p & ANALYTICS:
        return "Analytics_Performance", "measurement purpose (8/9)"
    if p & PERSONALISATION:
        return "Functional", "personalisation purpose (5/6/11)"
    if not (p - {1}) and sp and sp <= NECESSARY_SPECIAL:
        return "Strictly_Necessary", "only security / privacy-choice special purposes"
    return "Ambiguous", "no purpose that settles a category"


def _get_json(url: str, timeout: float):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=timeout) as resp:
        body = resp.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("response over 5 MB")
    return json.loads(body.decode("utf-8-sig"))


def disclosure_rows(vendor: dict, disclosure: dict) -> list[dict]:
    """Cookie rows from one vendor's disclosure file (web storage and app SDKs skipped)."""
    vendor_purposes = sorted(vendor.get("purposes", []) + vendor.get("legIntPurposes", []))
    rows = []
    for item in disclosure.get("disclosures") or []:
        if not isinstance(item, dict) or item.get("type") != "cookie" or not item.get("identifier"):
            continue
        purposes = sorted(p for p in item.get("purposes") or [] if isinstance(p, int))
        special = sorted(p for p in item.get("specialPurposes") or [] if isinstance(p, int))
        label, rule = label_for_purposes(purposes, special)
        rows.append({
            "label": label,
            "labelRule": rule,
            "name": str(item["identifier"]),
            "domains": " ".join(str(d) for d in item.get("domains") or [] if d) or item.get("domain", ""),
            "type": item["type"],
            "maxAgeSeconds": item.get("maxAgeSeconds", ""),
            "cookieRefresh": item.get("cookieRefresh", ""),
            "purposes": " ".join(map(str, purposes)),
            "specialPurposes": " ".join(map(str, special)),
            # Many vendors paste their whole purpose list onto every cookie: weak label.
            "copiesVendorPurposes": len(purposes) > 2 and purposes == vendor_purposes,
            "vendorId": vendor["id"],
            "vendorName": vendor.get("name", ""),
        })
    return rows


def crawl(gvl: dict, workers: int, timeout: float) -> tuple[list[dict], Counter]:
    vendors = [v for v in gvl["vendors"].values()
               if not v.get("deletedDate") and v.get("deviceStorageDisclosureUrl")]
    failures: Counter = Counter()

    def fetch(vendor):
        try:
            return disclosure_rows(vendor, _get_json(vendor["deviceStorageDisclosureUrl"], timeout))
        except Exception as exc:  # dead hosts, bad TLS, HTML error pages, malformed JSON
            failures[type(exc).__name__] += 1
            return []

    rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for vendor_rows in pool.map(fetch, vendors):
            rows.extend(vendor_rows)
    return rows, failures


def summarize(rows: list[dict], gvl: dict, failures: Counter) -> dict:
    active = sum(1 for v in gvl["vendors"].values() if not v.get("deletedDate"))
    vendors_with_cookies = len({r["vendorId"] for r in rows})
    return {
        "vendorListVersion": gvl["vendorListVersion"],
        "lastUpdated": gvl["lastUpdated"],
        "activeVendors": active,
        "vendorsWithCookieRows": vendors_with_cookies,
        "fetchFailures": dict(failures),
        "cookieRows": len(rows),
        "uniqueCookieNames": len({r["name"] for r in rows}),
        "labels": dict(Counter(r["label"] for r in rows).most_common()),
        "labelsExcludingCopiedVendorPurposes": dict(
            Counter(r["label"] for r in rows if not r["copiesVendorPurposes"]).most_common()),
    }


def parse_args(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--gvl", help=f"saved GVL JSON to use instead of downloading {GVL_URL}")
    ap.add_argument("--workers", type=int, default=32)
    ap.add_argument("--timeout", type=float, default=15.0)
    return ap.parse_args(argv)


def main(argv=None) -> dict:
    args = parse_args(argv)
    gvl = json.loads(Path(args.gvl).read_text()) if args.gvl else _get_json(GVL_URL, 60)
    version = gvl["vendorListVersion"]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / f"vendor-list-v{version}.json").write_text(json.dumps(gvl, indent=1))

    rows, failures = crawl(gvl, args.workers, args.timeout)
    with open(args.out_dir / f"disclosures_v{version}.csv", "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    summary = summarize(rows, gvl, failures)
    (args.out_dir / f"summary_v{version}.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    main()
