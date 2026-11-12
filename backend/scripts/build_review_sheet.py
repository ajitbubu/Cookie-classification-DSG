"""Write a blind labelling sheet of a model's held-out unseen-name test cookies.

The website's own category and the model's guess are left out, so reviewers
judge each cookie from its name, domain, attributes and the banner's provider
and description. Reviewers fill ``reviewed_label`` with one of the codes in
REVIEW_CODES, and the trainer scores against the result via ``--reviewed-labels``.

Usage:
  python -m backend.scripts.build_review_sheet --model-dir models/v7.1.0 \
      --input models/training_data/banner/banner_all_2026-11-11b.csv \
      --evidence-sidecar models/training_data/banner/banner_all_2026-11-11b_sidecar.csv \
      --output models/training_data/reviewed/review_sheet_v7.1.0.csv
"""

import argparse
import json
from pathlib import Path
from typing import Sequence

import pandas as pd

from backend.scripts.train_cookie_model import (
    REVIEW_CODES,
    _load_inputs,
    deduplicate_observations,
    split_by_site_domain,
)

SHEET_COLUMNS = [
    "observation_id", "site_domain", "cookie_name", "cookie_domain", "party", "expiry_days", "secure",
    "http_only", "same_site", "provider", "banner_description", "reviewed_label", "notes",
]


def unseen_test_rows(frame: pd.DataFrame, split: dict) -> pd.DataFrame:
    """The model's unseen-name test rows, re-derived from its recorded site split."""
    sites = frame.site_domain.nunique()
    _, _, test, audit = split_by_site_domain(
        frame,
        test_fraction=len(split["test_sites"]) / sites,
        calibration_fraction=len(split["calibration_sites"]) / sites,
        seed=split["seed"],
    )
    if audit["test_sites"] != split["test_sites"] or audit["calibration_sites"] != split["calibration_sites"]:
        raise ValueError("Input does not reproduce the model's site split; pass the dataset it was trained on")
    return test


def build_sheet(test: pd.DataFrame, sidecar: pd.DataFrame | None) -> pd.DataFrame:
    sheet = test.copy()
    first_party = [cookie == site or cookie.endswith("." + site) or site.endswith("." + cookie)
                   for cookie, site in zip(sheet.cookie_domain, sheet.site_domain)]
    sheet["party"] = ["first" if fp else "third" for fp in first_party]
    if sidecar is not None:
        evidence = sidecar.set_index("observation_id")
        sheet["provider"] = sheet.observation_id.map(evidence["provider"]).fillna("")
        sheet["banner_description"] = sheet.observation_id.map(evidence["description"]).fillna("")
    else:
        sheet["provider"] = sheet["banner_description"] = ""
    sheet["reviewed_label"] = sheet["notes"] = ""
    return sheet.sort_values(["site_domain", "cookie_name"])[SHEET_COLUMNS].reset_index(drop=True)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", required=True, help="Model whose metadata.json holds the site split")
    parser.add_argument("--input", action="append", required=True, help="Training CSV the model used; repeatable")
    parser.add_argument("--evidence-sidecar", action="append", default=[], help="Sidecar CSV with provider/description")
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> pd.DataFrame:
    args = parse_args(argv)
    split = json.loads((Path(args.model_dir) / "metadata.json").read_text())["dataset"]["split"]
    frame, _ = _load_inputs([Path(path) for path in args.input])
    frame, _ = deduplicate_observations(frame)
    sidecar = (pd.concat([pd.read_csv(path, dtype=str, keep_default_na=False) for path in args.evidence_sidecar])
               if args.evidence_sidecar else None)
    sheet = build_sheet(unseen_test_rows(frame, split), sidecar)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.to_csv(output, index=False)
    print(f"{len(sheet)} cookies from {sheet.site_domain.nunique()} sites -> {output}")
    print("reviewed_label codes: " + ", ".join(f"{code} = {label or 'cannot tell'}" for code, label in REVIEW_CODES.items()))
    return sheet


if __name__ == "__main__":
    main()
