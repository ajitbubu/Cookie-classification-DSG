#!/usr/bin/env python3
"""Train a reproducible cookie classifier with leakage-resistant evaluation.

This pipeline intentionally uses the production FeatureExtractorV5 for both
training and evaluation. It never consumes vendor_type, tracker_category, or
other precomputed columns that may encode the target label.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import re
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence
from urllib.parse import urlparse

import numpy as np
import pandas as pd

from backend.api.ml_classifier.feature_extractor_v5 import FeatureExtractorV5


CANONICAL_LABELS = [
    "Analytics_Performance",
    "Functional",
    "Marketing_Advertising",
    "Strictly_Necessary",
    "Unclassified",
]

_LABEL_ALIASES = {
    "analytics": "Analytics_Performance",
    "analytics performance": "Analytics_Performance",
    "analytics and performance": "Analytics_Performance",
    "measure performance": "Analytics_Performance",
    "performance": "Analytics_Performance",
    "statistical": "Analytics_Performance",
    "functional": "Functional",
    "personalization": "Functional",
    "personalisation": "Functional",
    "extend functionality": "Functional",
    "preferences": "Functional",
    "advertising": "Marketing_Advertising",
    "marketing": "Marketing_Advertising",
    "marketing advertising": "Marketing_Advertising",
    "personalized advertising": "Marketing_Advertising",
    "personalised advertising": "Marketing_Advertising",
    "personalize advertising": "Marketing_Advertising",
    "social media tracking": "Marketing_Advertising",
    "social networking": "Marketing_Advertising",
    "social_networking": "Marketing_Advertising",
    "strictly necessary": "Strictly_Necessary",
    "strictly_neccessary": "Strictly_Necessary",
    "necessary": "Strictly_Necessary",
    "essential": "Strictly_Necessary",
    "security": "Strictly_Necessary",
    "operate the site and core services": "Strictly_Necessary",
    "unclassified": "Unclassified",
    "unknown": "Unclassified",
    "uncategorized": "Unclassified",
}

OBSERVATION_COLUMNS = [
    "site_domain",
    "cookie_name",
    "cookie_domain",
    "expiry_days",
    "secure",
    "http_only",
    "same_site",
]


def normalize_label(value: Any) -> str | None:
    """Map historical labels to the five-category v6 taxonomy."""
    if value is None or pd.isna(value):
        return None
    normalized = str(value).strip().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.lower().split())
    return _LABEL_ALIASES.get(normalized)


def _domain(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip().lower()
    if "://" in text:
        text = urlparse(text).hostname or ""
    return text.lstrip(".").split("/")[0]


def _boolean(value: Any) -> bool:
    if value is None or pd.isna(value):
        return False
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return bool(value)


def _series(frame: pd.DataFrame, *names: str, default: Any = None) -> pd.Series:
    for name in names:
        if name in frame.columns:
            return frame[name]
    return pd.Series([default] * len(frame), index=frame.index)


def normalize_training_frame(
    frame: pd.DataFrame,
    *,
    source: str,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Normalize raw input while rejecting rows without label/group provenance."""
    normalized = pd.DataFrame(index=frame.index)
    normalized["site_domain"] = _series(frame, "site_domain", "website_domain").map(_domain)
    normalized["cookie_name"] = _series(frame, "cookie_name", "name", default="").fillna("").astype(str).str.strip()
    normalized["cookie_domain"] = _series(frame, "cookie_domain", "domain").map(_domain)
    normalized["expiry_days"] = pd.to_numeric(
        _series(frame, "expiry_days", default=0), errors="coerce"
    ).fillna(0).clip(lower=0)
    normalized["secure"] = _series(frame, "secure", default=False).map(_boolean)
    normalized["http_only"] = _series(frame, "http_only", "httpOnly", default=False).map(_boolean)
    normalized["same_site"] = _series(frame, "same_site", "sameSite", default=None).where(
        lambda values: values.notna(), None
    )
    raw_labels = _series(frame, "label_category", "label", "category")
    normalized["label"] = raw_labels.map(normalize_label)
    normalized["source"] = source

    missing_site = normalized["site_domain"].eq("")
    missing_cookie = normalized["cookie_name"].eq("") | normalized["cookie_domain"].eq("")
    unsupported_label = normalized["label"].isna()
    accepted = ~(missing_site | missing_cookie | unsupported_label)

    audit = {
        "source": source,
        "input_rows": int(len(frame)),
        "accepted_rows": int(accepted.sum()),
        "missing_site_domain": int(missing_site.sum()),
        "missing_cookie_identity": int(missing_cookie.sum()),
        "unsupported_label": int(unsupported_label.sum()),
        "raw_label_distribution": {
            str(key): int(value)
            for key, value in raw_labels.fillna("<missing>").value_counts().items()
        },
    }
    return normalized.loc[accepted].reset_index(drop=True), audit


def deduplicate_observations(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Remove duplicate observations and discard contradictory labels."""
    before = len(frame)
    deduplicated = frame.drop_duplicates(subset=OBSERVATION_COLUMNS + ["label"]).copy()
    duplicate_rows_removed = before - len(deduplicated)

    conflicts = deduplicated.groupby(OBSERVATION_COLUMNS, dropna=False)["label"].transform("nunique") > 1
    conflicting_observations_removed = int(conflicts.sum())
    cleaned = deduplicated.loc[~conflicts].copy()
    cleaned = cleaned.sort_values(OBSERVATION_COLUMNS + ["label"]).reset_index(drop=True)
    return cleaned, {
        "input_rows": int(before),
        "duplicate_rows_removed": int(duplicate_rows_removed),
        "conflicting_observations_removed": conflicting_observations_removed,
        "output_rows": int(len(cleaned)),
    }


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


def split_by_site_domain(
    frame: pd.DataFrame,
    *,
    test_fraction: float = 0.2,
    calibration_fraction: float = 0.15,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Create train/calibration/test partitions with disjoint website domains.

    Holdout rows whose cookie name family already appears in an earlier
    partition are dropped, so held-out metrics measure unseen cookies rather
    than memorized names that recur across sites.
    """
    sites = np.array(sorted(frame["site_domain"].unique()))
    if len(sites) < 5:
        raise ValueError("At least five distinct site domains are required for grouped splitting")

    rng = np.random.default_rng(seed)
    shuffled = sites.copy()
    rng.shuffle(shuffled)
    test_count = max(1, int(round(len(sites) * test_fraction)))
    calibration_count = max(1, int(round(len(sites) * calibration_fraction)))
    if test_count + calibration_count >= len(sites):
        raise ValueError("Split fractions leave no site domains for training")

    test_sites = set(shuffled[:test_count])
    calibration_sites = set(shuffled[test_count:test_count + calibration_count])
    train_sites = set(shuffled[test_count + calibration_count:])

    families = frame["cookie_name"].map(cookie_name_family)
    in_train = frame["site_domain"].isin(train_sites)
    in_calibration = frame["site_domain"].isin(calibration_sites)
    in_test = frame["site_domain"].isin(test_sites)
    train_families = set(families[in_train])
    calibration_keep = in_calibration & ~families.isin(train_families)
    seen_families = train_families | set(families[calibration_keep])
    test_keep = in_test & ~families.isin(seen_families)

    train = frame[in_train].reset_index(drop=True)
    calibration = frame[calibration_keep].reset_index(drop=True)
    test = frame[test_keep].reset_index(drop=True)

    def cookie_domains(partition: pd.DataFrame) -> set[str]:
        return set(partition["cookie_domain"])

    def name_families(partition: pd.DataFrame) -> set[str]:
        return set(partition["cookie_name"].map(cookie_name_family))

    audit = {
        "seed": seed,
        "train_sites": sorted(train_sites),
        "calibration_sites": sorted(calibration_sites),
        "test_sites": sorted(test_sites),
        "rows": {"train": len(train), "calibration": len(calibration), "test": len(test)},
        "site_domain_overlap": {
            "train_calibration": len(train_sites & calibration_sites),
            "train_test": len(train_sites & test_sites),
            "calibration_test": len(calibration_sites & test_sites),
        },
        "cookie_domain_overlap": {
            "train_calibration": len(cookie_domains(train) & cookie_domains(calibration)),
            "train_test": len(cookie_domains(train) & cookie_domains(test)),
            "calibration_test": len(cookie_domains(calibration) & cookie_domains(test)),
        },
        "cookie_name_family_overlap": {
            "train_calibration": len(name_families(train) & name_families(calibration)),
            "train_test": len(name_families(train) & name_families(test)),
            "calibration_test": len(name_families(calibration) & name_families(test)),
        },
        "rows_removed_for_name_overlap": {
            "calibration": int(in_calibration.sum() - calibration_keep.sum()),
            "test": int(in_test.sum() - test_keep.sum()),
        },
    }
    return train, calibration, test, audit


def build_feature_matrix(frame: pd.DataFrame) -> np.ndarray:
    """Generate features exclusively through the production extractor."""
    extractor = FeatureExtractorV5()
    rows = []
    for row in frame.itertuples(index=False):
        rows.append(extractor.extract_features({
            "name": row.cookie_name,
            "domain": row.cookie_domain,
            "site_domain": row.site_domain,
            "expiry_days": row.expiry_days,
            "secure": row.secure,
            "http_only": row.http_only,
            "same_site": row.same_site,
        }))
    if not rows:
        return np.empty((0, len(extractor.get_feature_names())), dtype=np.float32)
    return np.vstack(rows).astype(np.float32, copy=False)


def apply_temperature(probabilities: np.ndarray, temperature: float) -> np.ndarray:
    clipped = np.clip(np.asarray(probabilities, dtype=np.float64), 1e-12, 1.0)
    logits = np.log(clipped) / temperature
    logits -= logits.max(axis=1, keepdims=True)
    calibrated = np.exp(logits)
    return calibrated / calibrated.sum(axis=1, keepdims=True)


def fit_temperature(probabilities: np.ndarray, encoded_labels: np.ndarray) -> float:
    from scipy.optimize import minimize_scalar

    def negative_log_likelihood(temperature: float) -> float:
        calibrated = apply_temperature(probabilities, temperature)
        chosen = calibrated[np.arange(len(encoded_labels)), encoded_labels]
        return float(-np.log(np.clip(chosen, 1e-12, 1.0)).mean())

    result = minimize_scalar(negative_log_likelihood, bounds=(0.25, 5.0), method="bounded")
    if not result.success:
        raise RuntimeError(f"Temperature calibration failed: {result.message}")
    return float(result.x)


def choose_class_thresholds(
    probabilities: np.ndarray,
    encoded_labels: np.ndarray,
    classes: Sequence[str],
    *,
    target_precision: float,
    minimum_predictions: int,
) -> dict[str, dict[str, Any]]:
    predictions = probabilities.argmax(axis=1)
    confidence = probabilities.max(axis=1)
    thresholds: dict[str, dict[str, Any]] = {}
    for class_index, category in enumerate(classes):
        selected_threshold = 1.01
        selected_count = 0
        selected_precision = None
        for threshold in np.arange(0.50, 1.001, 0.01):
            mask = (predictions == class_index) & (confidence >= threshold)
            count = int(mask.sum())
            if count < minimum_predictions:
                continue
            precision = float((encoded_labels[mask] == class_index).mean())
            if precision >= target_precision:
                selected_threshold = round(float(threshold), 2)
                selected_count = count
                selected_precision = precision
                break
        thresholds[category] = {
            "threshold": selected_threshold,
            "eligible_predictions": selected_count,
            "estimated_precision": selected_precision,
            "enabled": selected_threshold <= 1.0 and category != "Unclassified",
        }
    return thresholds


def _json_safe(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _evaluate(
    probabilities: np.ndarray,
    encoded_labels: np.ndarray,
    classes: Sequence[str],
    thresholds: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, log_loss

    predictions = probabilities.argmax(axis=1)
    report = classification_report(
        encoded_labels,
        predictions,
        labels=list(range(len(classes))),
        target_names=list(classes),
        output_dict=True,
        zero_division=0,
    )
    confidence = probabilities.max(axis=1)
    auto_mask = np.zeros(len(predictions), dtype=bool)
    for index, category in enumerate(classes):
        policy = thresholds[category]
        if policy["enabled"]:
            auto_mask |= (predictions == index) & (confidence >= policy["threshold"])
    auto_count = int(auto_mask.sum())
    auto_accuracy = (
        float((predictions[auto_mask] == encoded_labels[auto_mask]).mean())
        if auto_count else None
    )
    return _json_safe({
        "accuracy": accuracy_score(encoded_labels, predictions),
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
        "log_loss": log_loss(encoded_labels, probabilities, labels=list(range(len(classes)))),
        "per_class": {category: report[category] for category in classes},
        "confusion_matrix": confusion_matrix(
            encoded_labels, predictions, labels=list(range(len(classes)))
        ),
        "auto_policy": {
            "eligible_predictions": auto_count,
            "coverage": auto_count / len(predictions) if len(predictions) else 0.0,
            "accuracy": auto_accuracy,
        },
    })


def _load_inputs(paths: Iterable[Path]) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    normalized_frames = []
    audits = []
    for path in paths:
        frame = pd.read_csv(path, low_memory=False)
        normalized, audit = normalize_training_frame(frame, source=str(path))
        normalized_frames.append(normalized)
        audit["sha256"] = _sha256(path)
        audits.append(audit)
    if not normalized_frames:
        raise ValueError("At least one training CSV is required")
    return pd.concat(normalized_frames, ignore_index=True), audits


def train(args: argparse.Namespace) -> dict[str, Any]:
    import joblib
    import scipy
    import sklearn
    import xgboost
    from sklearn.preprocessing import LabelEncoder
    from xgboost import XGBClassifier

    input_paths = [Path(path).resolve() for path in args.input]
    external_path = Path(args.external_holdout).resolve() if args.external_holdout else None
    combined, source_audits = _load_inputs(input_paths)
    cleaned, dedup_audit = deduplicate_observations(combined)
    train_frame, calibration_frame, test_frame, split_audit = split_by_site_domain(
        cleaned,
        test_fraction=args.test_fraction,
        calibration_fraction=args.calibration_fraction,
        seed=args.seed,
    )
    if calibration_frame.empty or test_frame.empty:
        raise ValueError(
            "No unseen cookie name families left in the calibration or test "
            f"partition after removing overlap: {split_audit['rows_removed_for_name_overlap']}"
        )

    external_frame = None
    external_audit = None
    external_is_disjoint = False
    if external_path:
        external_frame, external_source_audit = _load_inputs([external_path])
        external_frame, external_dedup = deduplicate_observations(external_frame)
        known_sites = set(train_frame.site_domain) | set(calibration_frame.site_domain)
        external_sites = set(external_frame.site_domain)
        external_is_disjoint = known_sites.isdisjoint(external_sites)
        external_audit = {
            "source": external_source_audit,
            "deduplication": external_dedup,
            "site_domains_disjoint_from_training": external_is_disjoint,
            "provenance": args.external_provenance,
        }

    encoder = LabelEncoder().fit(CANONICAL_LABELS)
    classes = [str(value) for value in encoder.classes_]
    x_train = build_feature_matrix(train_frame)
    x_calibration = build_feature_matrix(calibration_frame)
    x_test = build_feature_matrix(test_frame)
    y_train = encoder.transform(train_frame.label)
    y_calibration = encoder.transform(calibration_frame.label)
    y_test = encoder.transform(test_frame.label)

    model = XGBClassifier(
        objective="multi:softprob",
        num_class=len(classes),
        n_estimators=args.estimators,
        learning_rate=args.learning_rate,
        max_depth=args.max_depth,
        min_child_weight=2,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=2.0,
        eval_metric="mlogloss",
        random_state=args.seed,
        n_jobs=args.jobs,
        tree_method="hist",
    )
    model.fit(x_train, y_train, eval_set=[(x_calibration, y_calibration)], verbose=False)

    calibration_probabilities = model.predict_proba(x_calibration)
    temperature = fit_temperature(calibration_probabilities, y_calibration)
    calibrated_calibration = apply_temperature(calibration_probabilities, temperature)
    thresholds = choose_class_thresholds(
        calibrated_calibration,
        y_calibration,
        classes,
        target_precision=args.target_auto_precision,
        minimum_predictions=args.minimum_threshold_predictions,
    )
    test_probabilities = apply_temperature(model.predict_proba(x_test), temperature)
    test_metrics = _evaluate(test_probabilities, y_test, classes, thresholds)

    external_metrics = None
    if external_frame is not None and len(external_frame):
        x_external = build_feature_matrix(external_frame)
        y_external = encoder.transform(external_frame.label)
        external_probabilities = apply_temperature(model.predict_proba(x_external), temperature)
        external_metrics = _evaluate(external_probabilities, y_external, classes, thresholds)

    internal_gates = {
        "macro_f1": test_metrics["macro_f1"] >= args.minimum_macro_f1,
        "marketing_recall": test_metrics["per_class"]["Marketing_Advertising"]["recall"] >= args.minimum_marketing_recall,
        "unclassified_precision": test_metrics["per_class"]["Unclassified"]["precision"] >= args.minimum_unclassified_precision,
        "auto_precision": (
            test_metrics["auto_policy"]["accuracy"] is not None
            and test_metrics["auto_policy"]["accuracy"] >= args.target_auto_precision
        ),
        "site_holdout_is_disjoint": all(value == 0 for value in split_audit["site_domain_overlap"].values()),
        "name_holdout_is_disjoint": all(value == 0 for value in split_audit["cookie_name_family_overlap"].values()),
    }
    external_gate = bool(
        external_metrics
        and external_is_disjoint
        and args.external_provenance
        and external_metrics["macro_f1"] >= args.minimum_macro_f1
        and external_metrics["auto_policy"]["accuracy"] is not None
        and external_metrics["auto_policy"]["accuracy"] >= args.target_auto_precision
    )
    promotion_eligible = all(internal_gates.values()) and external_gate
    auto_classification_enabled = bool(
        args.enable_auto_classification and promotion_eligible
    )

    output_dir = Path(args.output_dir).resolve()
    if output_dir.exists() and any(output_dir.iterdir()) and not args.overwrite:
        raise FileExistsError(f"Output directory is not empty: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / "model.ubj"
    model.save_model(model_path)
    (output_dir / "labels.json").write_text(json.dumps(classes, indent=2) + "\n")
    feature_names = FeatureExtractorV5().get_feature_names()
    (output_dir / "features.json").write_text(json.dumps(feature_names, indent=2) + "\n")
    (output_dir / "calibration.json").write_text(json.dumps({
        "method": "temperature_scaling",
        "temperature": temperature,
        "per_class_auto_thresholds": thresholds,
        "fitted_on": "site-domain- and cookie-name-family-disjoint calibration partition",
    }, indent=2) + "\n")

    metadata = {
        "version": args.version,
        "model_type": "xgboost_native",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "num_features": len(feature_names),
        "features": feature_names,
        "categories": classes,
        "training_samples": len(train_frame),
        "calibration_samples": len(calibration_frame),
        "test_samples": len(test_frame),
        "dataset": {
            "sources": source_audits,
            "deduplication": dedup_audit,
            "split": split_audit,
            "external_holdout": external_audit,
        },
        "calibration": {
            "method": "temperature_scaling",
            "temperature": temperature,
            "target_auto_precision": args.target_auto_precision,
            "per_class_auto_thresholds": thresholds,
        },
        "metrics": {
            "internal_site_holdout": test_metrics,
            "external_holdout": external_metrics,
        },
        "acceptance": {
            "internal_gates": internal_gates,
            "external_holdout_gate": external_gate,
            "promotion_eligible": promotion_eligible,
            "auto_classification_enabled": auto_classification_enabled,
        },
        "runtime": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "scipy": scipy.__version__,
            "joblib": joblib.__version__,
        },
        "code": {
            "training_pipeline_sha256": _sha256(Path(__file__).resolve()),
            "feature_extractor_sha256": _sha256(
                Path(__file__).resolve().parents[1]
                / "api" / "ml_classifier" / "feature_extractor_v5.py"
            ),
        },
        "training_parameters": {
            "seed": args.seed,
            "estimators": args.estimators,
            "learning_rate": args.learning_rate,
            "max_depth": args.max_depth,
        },
    }
    metadata_path = output_dir / "metadata.json"
    metadata_path.write_text(json.dumps(_json_safe(metadata), indent=2) + "\n")

    artifact_files = [
        model_path,
        output_dir / "labels.json",
        output_dir / "features.json",
        output_dir / "calibration.json",
        metadata_path,
    ]
    manifest = {
        "version": args.version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "promotion_eligible": promotion_eligible,
        "files": {
            path.name: {"sha256": _sha256(path), "bytes": path.stat().st_size}
            for path in artifact_files
        },
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    package_dir = Path(args.package_dir).resolve()
    package_dir.mkdir(parents=True, exist_ok=True)
    package_path = package_dir / f"cookie-model-v{args.version}.tar.gz"
    with tarfile.open(package_path, "w:gz") as archive:
        for path in artifact_files + [manifest_path]:
            archive.add(path, arcname=f"v{args.version}/{path.name}")
    package_checksum = _sha256(package_path)
    package_path.with_suffix(package_path.suffix + ".sha256").write_text(
        f"{package_checksum}  {package_path.name}\n"
    )

    summary = {
        "output_dir": str(output_dir),
        "package": str(package_path),
        "package_sha256": package_checksum,
        "promotion_eligible": promotion_eligible,
        "internal_gates": internal_gates,
        "external_holdout_gate": external_gate,
        "test_metrics": test_metrics,
    }
    print(json.dumps(summary, indent=2))
    return summary


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", required=True, help="Training CSV; repeatable")
    parser.add_argument("--external-holdout", help="Independent externally sourced labeled CSV")
    parser.add_argument("--external-provenance", help="Human-readable source/version for external holdout")
    parser.add_argument("--version", default="6.1.0")
    parser.add_argument("--output-dir", default="models/v6.1.0")
    parser.add_argument("--package-dir", default="model_artifacts")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--test-fraction", type=float, default=0.20)
    parser.add_argument("--calibration-fraction", type=float, default=0.18)
    parser.add_argument("--estimators", type=int, default=350)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--target-auto-precision", type=float, default=0.97)
    parser.add_argument("--minimum-threshold-predictions", type=int, default=50)
    parser.add_argument("--minimum-macro-f1", type=float, default=0.75)
    parser.add_argument("--minimum-marketing-recall", type=float, default=0.70)
    parser.add_argument("--minimum-unclassified-precision", type=float, default=0.60)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument(
        "--enable-auto-classification",
        action="store_true",
        help="Enable only when all internal and external promotion gates pass",
    )
    args = parser.parse_args(argv)
    if bool(args.external_holdout) != bool(args.external_provenance):
        parser.error("--external-holdout and --external-provenance must be provided together")
    return args


if __name__ == "__main__":
    train(parse_args())
