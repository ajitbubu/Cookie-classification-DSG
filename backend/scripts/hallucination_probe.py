#!/usr/bin/env python3
"""Probe the live classifier for confident answers it has no evidence for.

Three checks against ``POST /api/v1/ml/classify``:

A. 300 random names on unknown domains: every one should abstain.
B. Made-up names that only contain fragments of real tracker names (``_gamer_tag``,
   ``ide_theme``, ``cart_gauge``): none should get a confident answer.
C. Real banner cookies from the given sites: confident answers that contradict the
   site's own banner label are listed. Use sites the live model was not trained on.

"Confident" is the API's High band (>= 0.85) and not abstained. Prints a JSON report.

    python -m backend.scripts.hallucination_probe \
      --banner-csv models/training_data/banner/banner_collect_<date>.csv --sites www.okta.com www.zoom.com
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import string
import urllib.request
from collections import Counter

CONFIDENT = 0.85
LOOKALIKES = [
    "language", "legal_notice", "megamenu_state", "agenda_view", "saga_step", "yoga_class",
    "fbcolor", "fbx_theme", "ide_theme", "idea_box", "guide_seen", "mysession_ui", "session_tab",
    "utm_free_layout", "analytics_optout_banner_text", "ads_free_mode", "track_order_view",
    "user_font_size", "uid_hint_shown", "consent_text_lang", "cart_gauge", "gate_open",
    "pagination", "navigation_open", "_gamer_tag", "gat_color", "hjson_cfg", "pixel_ratio",
    "clid_test", "gclid_docs_page",
]
API_CATEGORY_TO_LABEL = {
    "Marketing": "Marketing_Advertising", "Analytics": "Analytics_Performance",
    "Strictly Necessary": "Strictly_Necessary", "Functional": "Functional", "Unclassified": "Unclassified",
}


def classify(api: str, cookies: list[dict]) -> list[dict]:
    results = []
    for start in range(0, len(cookies), 200):
        body = json.dumps({"cookies": cookies[start:start + 200]}).encode()
        request = urllib.request.Request(api, body, {"Content-Type": "application/json"})
        results += json.load(urllib.request.urlopen(request, timeout=300))["classifications"]
    return results


def is_confident(result: dict) -> bool:
    return result["classification_status"] != "abstained" and result["confidence_score"] >= CONFIDENT


def summarize(cookies: list[dict], results: list[dict]) -> dict:
    confident = [(c["name"], r) for c, r in zip(cookies, results) if is_confident(r)]
    return {
        "n": len(cookies),
        "status": dict(Counter(r["classification_status"] for r in results)),
        "source": dict(Counter(r["source"] for r in results)),
        "auto_classified": sum(bool(r.get("auto_classified")) for r in results),
        "confident": len(confident),
        "max_model_confidence": max([r["confidence_score"] for r in results if r["source"] == "ml_prediction"] or [0]),
        "confident_examples": [(n, r["suggested_category"], r["confidence_score"], r["source"]) for n, r in confident[:30]],
    }


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://127.0.0.1:1001/api/v1/ml/classify")
    parser.add_argument("--banner-csv", help="16-column banner CSV for check C")
    parser.add_argument("--sites", nargs="*", default=[], help="site_domain values to use for check C")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args(argv)
    rng = random.Random(args.seed)

    def word(length: int) -> str:
        return "".join(rng.choice(string.ascii_lowercase + string.digits) for _ in range(length))

    def attributes() -> dict:
        return {"expiry_days": rng.choice([0, 1, 30, 90, 365, 400]), "secure": rng.random() < .6,
                "http_only": rng.random() < .3, "same_site": rng.choice(["lax", "strict", "none", "unspecified"])}

    nonsense = []
    for _ in range(300):
        domain = f"{word(8)}.example"
        nonsense.append({"name": rng.choice([word(6), word(4) + "_" + word(5), word(10)]),
                         "domain": "." + domain, "site_domain": domain, **attributes()})
    lookalikes = [{"name": n, "domain": ".shop-example.com", "site_domain": "shop-example.com", **attributes()}
                  for n in LOOKALIKES]
    report = {"A_nonsense": summarize(nonsense, classify(args.api, nonsense)),
              "B_lookalike": summarize(lookalikes, classify(args.api, lookalikes))}

    if args.banner_csv and args.sites:
        rows = [r for r in csv.DictReader(open(args.banner_csv)) if r["site_domain"] in set(args.sites)]
        cookies = [{"name": r["cookie_name"], "domain": r["cookie_domain"], "site_domain": r["site_domain"],
                    "expiry_days": float(r["expiry_days"] or 0), "secure": r["secure"] == "true",
                    "http_only": r["http_only"] == "true", "same_site": r["same_site"].lower()} for r in rows]
        results = classify(args.api, cookies)
        wrong = []
        for row, result in zip(rows, results):
            predicted = API_CATEGORY_TO_LABEL.get(result["suggested_category"], result["suggested_category"])
            if is_confident(result) and predicted != row["label_category"]:
                wrong.append((row["cookie_name"], row["label_category"], predicted,
                              result["confidence_score"], result["source"]))
        report["C_banner"] = {**summarize(cookies, results), "confident_wrong": len(wrong), "wrong": wrong}
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
