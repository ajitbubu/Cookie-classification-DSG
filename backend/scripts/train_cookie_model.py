#!/usr/bin/env python3
"""Train a reproducible cookie classifier with leakage-resistant evaluation.

This pipeline intentionally uses the production feature extractor (V7: V5's
52 features plus name-pattern and cookie-domain lookups learned here) for both
training and evaluation. It never consumes vendor_type, tracker_category, or
other precomputed columns that may encode the target label.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence
from urllib.parse import urlparse

import numpy as np
import pandas as pd

from backend.api.ml_classifier.evidence_guard import apply_evidence_guard, evidence_indices
from backend.api.ml_classifier.feature_extractor_v5 import FeatureExtractorV5
from backend.api.ml_classifier.feature_extractor_v7 import (
    LOOKUP_FILE,
    FeatureExtractorV7,
    normalize_cookie_name,
    registrable_domain,
)
from backend.api.ml_classifier.site_disagreement import DISAGREEMENT_FILE
from backend.scripts.build_production_dataset import cookie_name_family, normalize_label as _normalize_label_text


CANONICAL_LABELS = [
    "Analytics_Performance",
    "Functional",
    "Marketing_Advertising",
    "Strictly_Necessary",
    "Unclassified",
]
# Unclassified is not learned: it is what the API returns when the model
# abstains (evidence guard or low confidence). No real source declares cookies
# as Unclassified, so rows with that label are dropped and counted, and the
# model is trained on the four purpose classes only.
ABSTAIN_LABEL = "Unclassified"
TRAINED_LABELS = [label for label in CANONICAL_LABELS if label != ABSTAIN_LABEL]

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
    return _normalize_label_text(str(value)) or None


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


def _blank(values: pd.Series) -> pd.Series:
    return values.isna() | values.astype(str).str.strip().eq("")


def normalize_training_frame(
    frame: pd.DataFrame,
    *,
    source: str,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Normalize raw input while rejecting rows without label/group provenance.

    Rows whose expiry, secure or httpOnly value was never observed are dropped
    (decision D5) instead of being imputed as 0/False, which would teach the
    model attribute values the cookie never had.
    """
    missing_attributes = (
        _blank(_series(frame, "expiry_days"))
        | _blank(_series(frame, "secure"))
        | _blank(_series(frame, "http_only", "httpOnly"))
    )
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
    normalized["observation_id"] = _series(frame, "observation_id", default="").fillna("").astype(str)

    missing_site = normalized["site_domain"].eq("")
    missing_cookie = normalized["cookie_name"].eq("") | normalized["cookie_domain"].eq("")
    unsupported_label = normalized["label"].isna()
    abstain_label = normalized["label"].eq(ABSTAIN_LABEL)
    accepted = ~(missing_site | missing_cookie | unsupported_label | missing_attributes | abstain_label)

    audit = {
        "source": source,
        "input_rows": int(len(frame)),
        "accepted_rows": int(accepted.sum()),
        "missing_site_domain": int(missing_site.sum()),
        "missing_cookie_identity": int(missing_cookie.sum()),
        "unsupported_label": int(unsupported_label.sum()),
        "missing_attributes": int(missing_attributes.sum()),
        "unclassified_label_dropped": int(abstain_label.sum()),
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


def all_rows_on_sites(frame: pd.DataFrame, sites: Iterable[str]) -> pd.DataFrame:
    """Every row on the given held-out sites, including familiar cookie names.

    The split's calibration and test partitions keep only cookie names training
    never saw. A scan of a new website mostly meets familiar names such as _ga,
    so confidence is calibrated on all cookies of the calibration sites, and
    auto-classification has to be precise on all cookies of the test sites as
    well as on the unseen names.
    """
    return frame[frame["site_domain"].isin(set(sites))].reset_index(drop=True)


def require_every_class(train: pd.DataFrame) -> None:
    """Refuse to train when a taxonomy class has no training rows.

    The model would output fewer classes than labels.json lists, so scoring
    and the production classifier would both break.
    """
    missing = sorted(set(TRAINED_LABELS) - set(train["label"]))
    if missing:
        raise ValueError(f"No training rows for {missing}; add a source that labels them")


def _site_key(domain: str) -> str:
    return domain[4:] if domain.startswith("www.") else domain


def add_train_only_rows(
    train: pd.DataFrame,
    calibration: pd.DataFrame,
    test: pd.DataFrame,
    train_only: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """Append train-only rows (e.g. CookieBlock, legacy) to the train partition.

    The split, calibration and test rows are decided before this runs and are
    never changed by it (decision D27): train-only rows take no part in the
    site split or the name-family overlap filter. Train-only rows from a site
    that is in calibration or test are dropped, so those sites stay unseen.
    Returns the combined train frame, a mask over the test rows whose cookie
    family no training source has seen (decision D31), and an audit.
    """
    held_out_sites = {_site_key(site) for site in set(calibration["site_domain"]) | set(test["site_domain"])}
    on_held_out_site = train_only["site_domain"].map(_site_key).isin(held_out_sites)
    kept = train_only.loc[~on_held_out_site]
    combined = pd.concat([train, kept], ignore_index=True)

    train_only_families = set(kept["cookie_name"].map(cookie_name_family))
    unseen_test = ~test["cookie_name"].map(cookie_name_family).isin(train_only_families)
    audit = {
        "input_rows": int(len(train_only)),
        "rows_dropped_on_held_out_sites": int(on_held_out_site.sum()),
        "rows_added_to_train": int(len(kept)),
        "train_rows_from_split": int(len(train)),
        "test_rows_unseen_by_all_sources": int(unseen_test.sum()),
    }
    return combined, unseen_test.reset_index(drop=True), audit


def build_feature_matrix(frame: pd.DataFrame, extractor: Any = None) -> np.ndarray:
    """Generate features exclusively through a production extractor (V5 by default)."""
    extractor = extractor or FeatureExtractorV5()
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


NAME_NGRAM_RANGE = (2, 5)
DOMAIN_SMOOTHING = 3.0
LOOKUP_FOLDS = 5


def fit_feature_lookups(frame: pd.DataFrame, classes: Sequence[str]) -> dict[str, Any]:
    """Learn FeatureExtractorV7's lookups from labelled rows.

    Name patterns: TF-IDF over character n-grams of the normalized cookie name
    and a class-balanced logistic regression. Cookie domains: per registrable
    domain, the number of distinct sites that gave its cookies each label.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    index = {label: position for position, label in enumerate(classes)}
    labels = frame["label"].map(index).to_numpy()
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=NAME_NGRAM_RANGE, min_df=2,
                                 sublinear_tf=True, lowercase=False)
    names = vectorizer.fit_transform(frame["cookie_name"].map(normalize_cookie_name))
    regression = LogisticRegression(C=2.0, max_iter=2000, class_weight="balanced").fit(names, labels)

    triples = pd.DataFrame({
        "domain": frame["cookie_domain"].map(registrable_domain),
        "site": frame["site_domain"],
        "label": labels,
    }).drop_duplicates()
    triples = triples[triples["domain"] != ""]
    counts = pd.crosstab(triples["domain"], triples["label"]).reindex(columns=range(len(classes)), fill_value=0)
    return {
        "classes": list(classes),
        "name_patterns": {
            "ngram_range": list(NAME_NGRAM_RANGE),
            "ngrams": vectorizer.get_feature_names_out().tolist(),
            "idf": vectorizer.idf_.tolist(),
            "coef": regression.coef_.T.tolist(),
            "intercept": regression.intercept_.tolist(),
        },
        "cookie_domains": {
            "alpha": DOMAIN_SMOOTHING,
            "prior": (np.bincount(labels, minlength=len(classes)) / len(labels)).tolist(),
            "counts": {domain: [int(v) for v in row] for domain, row in zip(counts.index, counts.to_numpy())},
        },
    }


def out_of_fold_feature_matrix(train: pd.DataFrame, classes: Sequence[str],
                               folds: int = LOOKUP_FOLDS) -> np.ndarray:
    """Training features whose learned columns come from lookups fitted without the row's site.

    Otherwise a row's own label would leak into its name-pattern and domain
    features and the model would learn to trust them more than it should.
    """
    from sklearn.model_selection import GroupKFold

    matrix = None
    for fit_rows, apply_rows in GroupKFold(folds).split(train, groups=train["site_domain"]):
        extractor = FeatureExtractorV7(fit_feature_lookups(train.iloc[fit_rows], classes))
        part = build_feature_matrix(train.iloc[apply_rows], extractor)
        if matrix is None:
            matrix = np.empty((len(train), part.shape[1]), dtype=np.float32)
        matrix[apply_rows] = part
    return matrix


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


WILSON_Z = 1.96  # one-sided 97.5% lower bound


def wilson_lower_bound(successes: int, trials: int, z: float = WILSON_Z) -> float:
    """Wilson score lower bound of a binomial proportion; 0 when there are no trials."""
    if trials <= 0:
        return 0.0
    phat = successes / trials
    denominator = 1 + z * z / trials
    centre = phat + z * z / (2 * trials)
    margin = z * np.sqrt(phat * (1 - phat) / trials + z * z / (4 * trials * trials))
    return float((centre - margin) / denominator)


def choose_class_thresholds(
    probabilities: np.ndarray,
    encoded_labels: np.ndarray,
    classes: Sequence[str],
    *,
    target_precision: float,
    minimum_predictions: int,
    eligible: np.ndarray | None = None,
) -> dict[str, dict[str, Any]]:
    """Pick, per class, the lowest confidence threshold whose precision is proven.

    A threshold is accepted only when at least ``minimum_predictions`` eligible
    calibration rows clear it and the Wilson lower bound of their precision is
    at least ``target_precision``: a point estimate on a small sample is not
    enough. Rows the evidence guard flags are not eligible, as in production.
    """
    predictions = probabilities.argmax(axis=1)
    confidence = probabilities.max(axis=1)
    if eligible is None:
        eligible = np.ones(len(predictions), dtype=bool)
    thresholds: dict[str, dict[str, Any]] = {}
    for class_index, category in enumerate(classes):
        selected_threshold = 1.01
        selected_count = 0
        selected_precision = None
        selected_lower_bound = None
        for threshold in np.arange(0.50, 1.001, 0.01):
            mask = eligible & (predictions == class_index) & (confidence >= threshold)
            count = int(mask.sum())
            if count < minimum_predictions:
                continue
            correct = int((encoded_labels[mask] == class_index).sum())
            lower_bound = wilson_lower_bound(correct, count)
            if lower_bound >= target_precision:
                selected_threshold = round(float(threshold), 2)
                selected_count = count
                selected_precision = correct / count
                selected_lower_bound = lower_bound
                break
        thresholds[category] = {
            "threshold": selected_threshold,
            "eligible_predictions": selected_count,
            "estimated_precision": selected_precision,
            "precision_wilson_lower_bound": selected_lower_bound,
            "enabled": selected_threshold <= 1.0,
        }
    return thresholds


def auto_policy_mask(
    probabilities: np.ndarray,
    classes: Sequence[str],
    thresholds: dict[str, dict[str, Any]],
    eligible: np.ndarray,
) -> np.ndarray:
    """Rows the production policy would auto-classify (mirrors CookieClassifier.can_auto_classify)."""
    predictions = probabilities.argmax(axis=1)
    confidence = probabilities.max(axis=1)
    mask = np.zeros(len(predictions), dtype=bool)
    for index, category in enumerate(classes):
        policy = thresholds[category]
        if policy["enabled"]:
            mask |= (predictions == index) & (confidence >= policy["threshold"])
    return mask & eligible


def auto_policy_gate(
    correct: np.ndarray,
    sites: np.ndarray,
    *,
    target_precision: float,
    minimum_predictions: int,
    minimum_sites: int,
    bootstrap_samples: int,
    seed: int,
) -> dict[str, Any]:
    """Decide whether auto-classified predictions are proven precise (decisions D13, C10).

    ``correct`` and ``sites`` describe only the auto-classified rows. All must
    hold: enough predictions, enough distinct sites, a Wilson lower bound and a
    site-clustered bootstrap lower bound (sites resampled with replacement, so
    one large site cannot carry the estimate) both at or above the target.
    """
    count = int(len(correct))
    correct_count = int(np.sum(correct))
    site_values, site_index = np.unique(sites, return_inverse=True)
    bootstrap_lower_bound = None
    if len(site_values):
        per_site_total = np.bincount(site_index, minlength=len(site_values))
        per_site_correct = np.bincount(site_index, weights=correct.astype(float), minlength=len(site_values))
        rng = np.random.default_rng(seed)
        draws = rng.integers(0, len(site_values), size=(bootstrap_samples, len(site_values)))
        accuracy = per_site_correct[draws].sum(axis=1) / per_site_total[draws].sum(axis=1)
        bootstrap_lower_bound = float(np.quantile(accuracy, 0.025))
    wilson = wilson_lower_bound(correct_count, count)
    return {
        "eligible_predictions": count,
        "distinct_sites": int(len(site_values)),
        "accuracy": correct_count / count if count else None,
        "wilson_lower_bound": wilson if count else None,
        "site_bootstrap_lower_bound": bootstrap_lower_bound,
        "requirements": {
            "target_precision": target_precision,
            "minimum_predictions": minimum_predictions,
            "minimum_sites": minimum_sites,
            "bootstrap_samples": bootstrap_samples,
        },
        "passed": bool(
            count >= minimum_predictions
            and len(site_values) >= minimum_sites
            and wilson >= target_precision
            and bootstrap_lower_bound is not None
            and bootstrap_lower_bound >= target_precision
        ),
    }


def per_cmp_gate(
    encoded_labels: np.ndarray,
    predictions: np.ndarray,
    cmps: np.ndarray,
    sites: np.ndarray,
    *,
    minimum_rows: int,
    minimum_sites: int,
    maximum_gap: float,
) -> dict[str, Any]:
    """Require every well-sampled CMP's macro-F1 to sit within ``maximum_gap`` of overall (C4).

    Macro-F1 is taken over the classes present in the overall truth, for the
    overall figure and each CMP alike. CMPs below ``minimum_rows`` rows or
    ``minimum_sites`` sites are reported but not judged; rows with no known
    CMP are not grouped. With no CMP judged the gate passes and says so.
    """
    from sklearn.metrics import f1_score

    labels = sorted(set(encoded_labels.tolist()))
    overall = float(f1_score(encoded_labels, predictions, labels=labels, average="macro", zero_division=0))
    per_cmp: dict[str, Any] = {}
    for cmp in sorted(set(cmps.tolist()) - {""}):
        mask = cmps == cmp
        rows, site_count = int(mask.sum()), int(len(set(sites[mask].tolist())))
        entry: dict[str, Any] = {"rows": rows, "sites": site_count}
        if rows >= minimum_rows and site_count >= minimum_sites:
            macro_f1 = float(f1_score(encoded_labels[mask], predictions[mask], labels=labels,
                                      average="macro", zero_division=0))
            entry.update(macro_f1=macro_f1, gap=overall - macro_f1, passed=overall - macro_f1 <= maximum_gap)
        else:
            entry["passed"] = None
        per_cmp[cmp] = entry
    judged = [entry for entry in per_cmp.values() if entry["passed"] is not None]
    return {
        "overall_macro_f1": overall,
        "requirements": {"minimum_rows": minimum_rows, "minimum_sites": minimum_sites, "maximum_gap": maximum_gap},
        "rows_without_cmp": int((cmps == "").sum()),
        "per_cmp": per_cmp,
        "cmps_judged": len(judged),
        "passed": all(entry["passed"] for entry in judged),
    }


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


CONSENSUS_MIN_SITES = 3
CONSENSUS_MIN_SHARE = 0.30


def acceptable_label_matrix(reference: pd.DataFrame, rows: pd.DataFrame, classes: Sequence[str]) -> np.ndarray:
    """Which labels count as correct for each row, given how all sites label that cookie.

    Websites disagree about the same cookie (``__stripe_mid`` is Strictly
    Necessary on some banners, Functional on others), so a single site's label
    is not the only defensible answer. A label is acceptable for a row when the
    row's own site gave it, or when its cookie name family is declared on at
    least CONSENSUS_MIN_SITES sites and at least CONSENSUS_MIN_SHARE of them
    gave that label. ``reference`` is every labelled row; this decides only how
    predictions are scored, never what the model sees.
    """
    index = {label: position for position, label in enumerate(classes)}
    declared = pd.DataFrame({
        "family": reference["cookie_name"].map(cookie_name_family),
        "site": reference["site_domain"],
        "label": reference["label"],
    }).drop_duplicates()
    site_counts = declared.groupby("family")["site"].nunique()
    shares = declared.groupby(["family", "label"])["site"].nunique().div(site_counts, level="family")
    agreed = shares[(shares >= CONSENSUS_MIN_SHARE)
                    & (site_counts.reindex(shares.index.get_level_values("family")).to_numpy() >= CONSENSUS_MIN_SITES)]
    agreed_by_family: dict[str, list[int]] = {}
    for family, label in agreed.index:
        agreed_by_family.setdefault(family, []).append(index[label])

    matrix = np.zeros((len(rows), len(classes)), dtype=bool)
    matrix[np.arange(len(rows)), rows["label"].map(index).to_numpy()] = True
    for position, family in enumerate(rows["cookie_name"].map(cookie_name_family)):
        matrix[position, agreed_by_family.get(family, [])] = True
    return matrix


def site_label_disagreement(frame: pd.DataFrame) -> dict[str, Any]:
    """Cookie name families that sites label differently, for the Review Queue.

    Same rule as consensus scoring: declared on at least CONSENSUS_MIN_SITES
    sites, with at least two labels each given by CONSENSUS_MIN_SHARE of them.
    Values are site counts per label (every label seen, not only the large ones).
    """
    declared = pd.DataFrame({
        "family": frame["cookie_name"].map(cookie_name_family),
        "site": frame["site_domain"],
        "label": frame["label"],
    }).drop_duplicates()
    sites_per_label = declared.groupby(["family", "label"])["site"].nunique()
    site_counts = declared.groupby("family")["site"].nunique()
    families = {}
    for family, counts in sites_per_label.groupby(level="family"):
        total = site_counts[family]
        if total >= CONSENSUS_MIN_SITES and (counts / total >= CONSENSUS_MIN_SHARE).sum() >= 2:
            families[family] = {label: int(count) for (_, label), count in counts.items()}
    return {"rule": {"minimum_sites": CONSENSUS_MIN_SITES, "minimum_share": CONSENSUS_MIN_SHARE},
            "families": dict(sorted(families.items()))}


def _consensus_scores(predictions: np.ndarray, encoded_labels: np.ndarray, acceptable: np.ndarray,
                      classes: Sequence[str]) -> dict[str, Any]:
    """Macro F1 where a prediction any acceptable label allows counts as correct."""
    from sklearn.metrics import accuracy_score, classification_report

    targets = np.where(acceptable[np.arange(len(predictions)), predictions], predictions, encoded_labels)
    report = classification_report(targets, predictions, labels=list(range(len(classes))),
                                   target_names=list(classes), output_dict=True, zero_division=0)
    return {
        "accuracy": accuracy_score(targets, predictions),
        "macro_f1": report["macro avg"]["f1-score"],
        "per_class": {category: report[category] for category in classes},
        "rows_with_several_acceptable_labels": int((acceptable.sum(axis=1) > 1).sum()),
        "rule": {"minimum_sites": CONSENSUS_MIN_SITES, "minimum_share": CONSENSUS_MIN_SHARE},
    }


# Codes reviewers type in a labelling sheet's reviewed_label column; "?" = can't tell.
REVIEW_CODES = {
    "SN": "Strictly_Necessary",
    "F": "Functional",
    "A": "Analytics_Performance",
    "M": "Marketing_Advertising",
    "?": None,
}


def load_reviewed_labels(paths: Iterable[Path]) -> dict[str, str | None]:
    """Map observation_id -> human-reviewed label (None = reviewer couldn't tell).

    Rows with a blank reviewed_label are not reviewed yet and are skipped; any
    other value outside REVIEW_CODES is an error, so a typo never becomes a label.
    """
    reviewed: dict[str, str | None] = {}
    for path in paths:
        sheet = pd.read_csv(path, dtype=str, keep_default_na=False)
        for line, (observation_id, raw) in enumerate(zip(sheet.observation_id, sheet.reviewed_label), start=2):
            code = raw.strip().upper()
            if not code:
                continue
            if code not in REVIEW_CODES:
                raise ValueError(f"{path} line {line}: reviewed_label {raw!r} is not one of {', '.join(REVIEW_CODES)}")
            reviewed[observation_id] = REVIEW_CODES[code]
    return reviewed


def _reviewed_scores(predictions: np.ndarray, rows: pd.DataFrame, classes: Sequence[str],
                     reviewed: dict[str, str | None]) -> dict[str, Any] | None:
    """Score predictions against human-reviewed labels instead of the website's own."""
    from sklearn.metrics import accuracy_score, classification_report

    labels = rows.observation_id.map(reviewed)
    in_sheet = rows.observation_id.isin(reviewed).to_numpy()
    scored = labels.notna().to_numpy()
    if not scored.any():
        return None
    index = {label: position for position, label in enumerate(classes)}
    targets = labels[scored].map(index).to_numpy()
    report = classification_report(targets, predictions[scored], labels=list(range(len(classes))),
                                   target_names=list(classes), output_dict=True, zero_division=0)
    return _json_safe({
        "rows_reviewed": int(in_sheet.sum()),
        "rows_unsure": int((in_sheet & ~scored).sum()),
        "rows_scored": int(scored.sum()),
        "sites": int(rows.site_domain[scored].nunique()),
        "website_label_agreement": float((rows.label[scored] == labels[scored]).mean()),
        "accuracy": accuracy_score(targets, predictions[scored]),
        "macro_f1": report["macro avg"]["f1-score"],
        "per_class": {category: report[category] for category in classes},
    })


def _evaluate(
    probabilities: np.ndarray,
    encoded_labels: np.ndarray,
    classes: Sequence[str],
    thresholds: dict[str, dict[str, Any]],
    *,
    eligible: np.ndarray,
    sites: np.ndarray,
    gate: dict[str, Any],
    acceptable: np.ndarray | None = None,
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
    auto_mask = auto_policy_mask(probabilities, classes, thresholds, eligible)
    auto_count = int(auto_mask.sum())
    auto_gate = auto_policy_gate(
        predictions[auto_mask] == encoded_labels[auto_mask], sites[auto_mask], **gate
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
        "rows_lacking_evidence": int((~eligible).sum()),
        "consensus": (_consensus_scores(predictions, encoded_labels, acceptable, classes)
                      if acceptable is not None else None),
        "auto_policy": {
            "coverage": auto_count / len(predictions) if len(predictions) else 0.0,
            **auto_gate,
        },
    })


def _load_evidence_sidecars(paths: Iterable[Path]) -> dict[str, str]:
    """Map observation_id -> CMP from evidence sidecars (never a model feature)."""
    cmp_by_observation: dict[str, str] = {}
    for path in paths:
        sidecar = pd.read_csv(path, dtype=str, keep_default_na=False, usecols=["observation_id", "cmp"])
        cmp_by_observation.update(zip(sidecar.observation_id, sidecar.cmp.str.strip().str.lower()))
    return cmp_by_observation


def _load_train_only_inputs(paths: Iterable[Path]) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Load each train-only CSV, deduplicated and conflict-dropped within its own source."""
    frames, audits = [], []
    for path in paths:
        frame, (source_audit,) = _load_inputs([path])
        frame, dedup_audit = deduplicate_observations(frame)
        frames.append(frame)
        audits.append({**source_audit, "deduplication": dedup_audit})
    if not frames:
        return pd.DataFrame(columns=OBSERVATION_COLUMNS + ["label", "source"]), audits
    return pd.concat(frames, ignore_index=True), audits


def _load_inputs(paths: Iterable[Path]) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    normalized_frames = []
    audits = []
    for path in paths:
        # keep_default_na=False: pandas would read SameSite "None" as NaN. Blanks stay "".
        frame = pd.read_csv(path, low_memory=False, keep_default_na=False)
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
        seed=args.split_seed,
    )
    if calibration_frame.empty or test_frame.empty:
        raise ValueError(
            "No unseen cookie name families left in the calibration or test "
            f"partition after removing overlap: {split_audit['rows_removed_for_name_overlap']}"
        )

    # Calibrate on the cookie mix a real scan meets, not only on unseen names.
    calibration_frame = all_rows_on_sites(cleaned, split_audit["calibration_sites"])
    split_audit["rows"]["calibration_all_cookies"] = len(calibration_frame)

    train_only_paths = [Path(path).resolve() for path in args.train_only_input or []]
    train_only_frame, train_only_source_audits = _load_train_only_inputs(train_only_paths)
    train_frame, unseen_test_mask, train_only_audit = add_train_only_rows(
        train_frame, calibration_frame, test_frame, train_only_frame
    )

    require_every_class(train_frame)

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

    encoder = LabelEncoder().fit(TRAINED_LABELS)
    classes = [str(value) for value in encoder.classes_]
    lookups = fit_feature_lookups(train_frame, classes)
    extractor = FeatureExtractorV7(lookups)
    x_train = out_of_fold_feature_matrix(train_frame, classes)
    x_calibration = build_feature_matrix(calibration_frame, extractor)
    x_test = build_feature_matrix(test_frame, extractor)
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

    guard_indices = evidence_indices(extractor.get_feature_names())

    def guarded_probabilities(features: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Calibrated, evidence-guarded probabilities and the auto-eligible mask, as in production."""
        calibrated = apply_temperature(model.predict_proba(features), temperature)
        guarded, lacks_evidence = apply_evidence_guard(features, calibrated, guard_indices)
        return guarded, ~lacks_evidence

    temperature = fit_temperature(model.predict_proba(x_calibration), y_calibration)
    calibrated_calibration, calibration_eligible = guarded_probabilities(x_calibration)
    thresholds = choose_class_thresholds(
        calibrated_calibration,
        y_calibration,
        classes,
        target_precision=args.target_auto_precision,
        minimum_predictions=args.minimum_threshold_predictions,
        eligible=calibration_eligible,
    )
    gate = {
        "target_precision": args.target_auto_precision,
        "minimum_predictions": args.minimum_auto_predictions,
        "minimum_sites": args.minimum_auto_sites,
        "bootstrap_samples": args.bootstrap_samples,
        "seed": args.split_seed,
    }
    test_probabilities, test_eligible = guarded_probabilities(x_test)
    test_sites = test_frame.site_domain.to_numpy()
    test_acceptable = acceptable_label_matrix(cleaned, test_frame, classes)
    test_metrics = _evaluate(test_probabilities, y_test, classes, thresholds,
                             eligible=test_eligible, sites=test_sites, gate=gate, acceptable=test_acceptable)
    unseen_mask = unseen_test_mask.to_numpy()
    unseen_test_metrics = (
        _evaluate(test_probabilities[unseen_mask], y_test[unseen_mask], classes, thresholds,
                  eligible=test_eligible[unseen_mask], sites=test_sites[unseen_mask], gate=gate,
                  acceptable=test_acceptable[unseen_mask])
        if train_only_paths and unseen_mask.any() else None
    )
    all_test_frame = all_rows_on_sites(cleaned, split_audit["test_sites"])
    all_test_probabilities, all_test_eligible = guarded_probabilities(build_feature_matrix(all_test_frame, extractor))
    all_test_metrics = _evaluate(all_test_probabilities, encoder.transform(all_test_frame.label), classes,
                                 thresholds, eligible=all_test_eligible,
                                 sites=all_test_frame.site_domain.to_numpy(), gate=gate,
                                 acceptable=acceptable_label_matrix(cleaned, all_test_frame, classes))
    reviewed_paths = [Path(path).resolve() for path in args.reviewed_labels or []]
    reviewed = load_reviewed_labels(reviewed_paths)
    test_metrics["reviewed"] = _reviewed_scores(test_probabilities.argmax(axis=1), test_frame, classes, reviewed)
    all_test_metrics["reviewed"] = _reviewed_scores(all_test_probabilities.argmax(axis=1), all_test_frame,
                                                    classes, reviewed)
    cmp_by_observation = _load_evidence_sidecars(Path(path).resolve() for path in args.evidence_sidecar or [])
    cmp_gate = per_cmp_gate(
        y_test,
        test_probabilities.argmax(axis=1),
        test_frame.observation_id.map(cmp_by_observation).fillna("").to_numpy(),
        test_sites,
        minimum_rows=args.minimum_cmp_rows,
        minimum_sites=args.minimum_cmp_sites,
        maximum_gap=args.maximum_cmp_macro_f1_gap,
    )

    external_metrics = None
    if external_frame is not None and len(external_frame):
        x_external = build_feature_matrix(external_frame, extractor)
        y_external = encoder.transform(external_frame.label)
        external_probabilities, external_eligible = guarded_probabilities(x_external)
        external_metrics = _evaluate(external_probabilities, y_external, classes, thresholds,
                                     eligible=external_eligible,
                                     sites=external_frame.site_domain.to_numpy(), gate=gate)

    internal_gates = {
        # Consensus scoring: sites disagree about many cookies (see acceptable_label_matrix).
        "macro_f1": test_metrics["consensus"]["macro_f1"] >= args.minimum_macro_f1,
        "marketing_recall": test_metrics["per_class"]["Marketing_Advertising"]["recall"] >= args.minimum_marketing_recall,
        "auto_precision": test_metrics["auto_policy"]["passed"],
        "auto_precision_all_cookies": all_test_metrics["auto_policy"]["passed"],
        "per_cmp_macro_f1": cmp_gate["passed"],
        "site_holdout_is_disjoint": all(value == 0 for value in split_audit["site_domain_overlap"].values()),
        "name_holdout_is_disjoint": all(value == 0 for value in split_audit["cookie_name_family_overlap"].values()),
    }
    external_gate = bool(
        external_metrics
        and external_is_disjoint
        and args.external_provenance
        and external_metrics["macro_f1"] >= args.minimum_macro_f1
        and external_metrics["auto_policy"]["passed"]
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
    feature_names = extractor.get_feature_names()
    (output_dir / LOOKUP_FILE).write_text(json.dumps(lookups) + "\n")
    (output_dir / DISAGREEMENT_FILE).write_text(json.dumps(site_label_disagreement(train_frame), indent=1) + "\n")
    (output_dir / "features.json").write_text(json.dumps(feature_names, indent=2) + "\n")
    (output_dir / "calibration.json").write_text(json.dumps({
        "method": "temperature_scaling",
        "temperature": temperature,
        "per_class_auto_thresholds": thresholds,
        "fitted_on": "all cookies on calibration sites (site-domain-disjoint from training and test)",
    }, indent=2) + "\n")

    metadata = {
        "version": args.version,
        "model_type": "xgboost_native",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "num_features": len(feature_names),
        "features": feature_names,
        "categories": classes,
        "abstain_category": ABSTAIN_LABEL,
        "training_samples": len(train_frame),
        "calibration_samples": len(calibration_frame),
        "test_samples": len(test_frame),
        "test_samples_all_cookies": len(all_test_frame),
        "dataset": {
            "sources": source_audits,
            "deduplication": dedup_audit,
            "split": split_audit,
            "train_only": {"sources": train_only_source_audits, **train_only_audit},
            "external_holdout": external_audit,
            "reviewed_labels": [{"source": str(path), "sha256": _sha256(path)} for path in reviewed_paths],
        },
        "calibration": {
            "method": "temperature_scaling",
            "temperature": temperature,
            "target_auto_precision": args.target_auto_precision,
            "threshold_rule": "lowest threshold with >= minimum predictions and Wilson lower bound >= target",
            "evidence_guard": "applied before thresholds and metrics; guarded rows never auto-classify",
            "per_class_auto_thresholds": thresholds,
        },
        "metrics": {
            "internal_site_holdout": test_metrics,
            "internal_site_holdout_unseen_by_all_sources": unseen_test_metrics,
            "internal_site_holdout_all_cookies": all_test_metrics,
            "internal_site_holdout_per_cmp": cmp_gate,
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
            "feature_extractor_v7_sha256": _sha256(
                Path(__file__).resolve().parents[1]
                / "api" / "ml_classifier" / "feature_extractor_v7.py"
            ),
        },
        "training_parameters": {
            "seed": args.seed,
            "split_seed": args.split_seed,
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
        output_dir / LOOKUP_FILE,
        output_dir / DISAGREEMENT_FILE,
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
    parser.add_argument(
        "--train-only-input",
        action="append",
        help="CSV whose rows only ever join the train partition (e.g. CookieBlock, legacy); repeatable",
    )
    parser.add_argument("--external-holdout", help="Independent externally sourced labeled CSV")
    parser.add_argument("--external-provenance", help="Human-readable source/version for external holdout")
    parser.add_argument(
        "--reviewed-labels",
        action="append",
        help="Filled-in labelling sheet (build_review_sheet.py); scored separately, never trained on. Repeatable",
    )
    parser.add_argument("--version", default="6.1.0")
    parser.add_argument("--output-dir", default="models/v6.1.0")
    parser.add_argument("--package-dir", default="model_artifacts")
    parser.add_argument("--seed", type=int, default=42, help="Model seed")
    parser.add_argument(
        "--split-seed",
        type=int,
        default=42,
        help="Site split seed; keep fixed across ablation arms so every arm is scored on the same test rows",
    )
    parser.add_argument("--test-fraction", type=float, default=0.20)
    parser.add_argument("--calibration-fraction", type=float, default=0.18)
    parser.add_argument("--estimators", type=int, default=350)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--max-depth", type=int, default=6)
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument(
        "--evidence-sidecar",
        action="append",
        help="CSV with observation_id,cmp for the per-CMP gate (never a model feature); repeatable",
    )
    parser.add_argument(
        "--target-auto-precision",
        type=float,
        default=0.95,
        help="Wilson and site-bootstrap lower bound the auto policy must reach",
    )
    parser.add_argument("--minimum-threshold-predictions", type=int, default=50)
    parser.add_argument("--minimum-auto-predictions", type=int, default=100)
    parser.add_argument("--minimum-auto-sites", type=int, default=20)
    parser.add_argument("--bootstrap-samples", type=int, default=1000)
    parser.add_argument("--minimum-cmp-rows", type=int, default=300)
    parser.add_argument("--minimum-cmp-sites", type=int, default=20)
    parser.add_argument("--maximum-cmp-macro-f1-gap", type=float, default=0.05)
    parser.add_argument("--minimum-macro-f1", type=float, default=0.75)
    parser.add_argument("--minimum-marketing-recall", type=float, default=0.70)
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
