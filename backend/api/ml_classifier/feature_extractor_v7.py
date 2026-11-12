"""
Feature Extractor V7 - model v7.1.0 onward.

V5's 52 features plus 9 learned from the training data and shipped with the
model as ``feature_lookups.json``:

- ``name_pattern_<class>``: class probabilities of a logistic regression on
  character 2-5-grams of the cookie name (digits folded to 0), so names never
  seen in training still carry signal from their fragments (``sess``, ``pxl``).
- ``cookie_domain_share_<class>`` and ``cookie_domain_sites``: how training
  sites labelled cookies set on the same registrable domain, smoothed toward
  the overall class mix, and on how many sites that domain was seen.

The name-pattern model is evaluated here with numpy only; it reproduces
scikit-learn's ``TfidfVectorizer(analyzer="char_wb", sublinear_tf=True)``
followed by ``LogisticRegression.predict_proba`` (checked by a test).
"""

import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from .feature_extractor_v5 import FeatureExtractorV5

LOOKUP_FILE = "feature_lookups.json"
_DIGIT = re.compile(r"\d")
_SECOND_LEVEL = {"co", "com", "org", "net", "ac", "gov"}


def normalize_cookie_name(name: Any) -> str:
    """Lowercase and fold digits, so per-site identifiers share n-grams."""
    return _DIGIT.sub("0", str(name or "").lower())


def char_wb_ngrams(text: str, low: int, high: int) -> List[str]:
    """scikit-learn's ``char_wb`` analyzer: n-grams inside space-padded words."""
    grams = []
    for word in text.split():
        word = f" {word} "
        length = len(word)
        for n in range(low, high + 1):
            offset = 0
            grams.append(word[offset:offset + n])
            while offset + n < length:
                offset += 1
                grams.append(word[offset:offset + n])
            if offset == 0:  # the word is shorter than n: count it once
                break
    return grams


def registrable_domain(domain: Any) -> str:
    """Approximate eTLD+1 (``.ads.example.co.uk`` -> ``example.co.uk``)."""
    parts = [part for part in str(domain or "").lower().strip().strip(".").split(".") if part]
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in _SECOND_LEVEL:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


class FeatureExtractorV7:
    """Feature extractor for model v7.1.0+ — V5's 52 features plus 9 learned ones."""

    def __init__(self, lookups: Dict[str, Any]):
        self._v5 = FeatureExtractorV5()
        self.classes = list(lookups["classes"])
        patterns = lookups["name_patterns"]
        self._ngram_range = tuple(patterns["ngram_range"])
        self._vocabulary = {gram: index for index, gram in enumerate(patterns["ngrams"])}
        self._idf = np.asarray(patterns["idf"], dtype=np.float64)
        self._coef = np.asarray(patterns["coef"], dtype=np.float64)  # (n_ngrams, n_classes)
        self._intercept = np.asarray(patterns["intercept"], dtype=np.float64)
        domains = lookups["cookie_domains"]
        self._alpha = float(domains["alpha"])
        self._prior = np.asarray(domains["prior"], dtype=np.float64)
        self._domain_counts = {key: np.asarray(value, dtype=np.float64) for key, value in domains["counts"].items()}
        self._feature_names = (
            self._v5.get_feature_names()
            + [f"name_pattern_{label}" for label in self.classes]
            + [f"cookie_domain_share_{label}" for label in self.classes]
            + ["cookie_domain_sites"]
        )

    @classmethod
    def load(cls, model_path: Path) -> "FeatureExtractorV7":
        return cls(json.loads((Path(model_path) / LOOKUP_FILE).read_text()))

    def get_feature_names(self) -> List[str]:
        return list(self._feature_names)

    def name_pattern_probabilities(self, name: Any) -> np.ndarray:
        counts: Dict[int, int] = {}
        for gram in char_wb_ngrams(normalize_cookie_name(name), *self._ngram_range):
            index = self._vocabulary.get(gram)
            if index is not None:
                counts[index] = counts.get(index, 0) + 1
        logits = self._intercept.copy()
        if counts:
            indices = np.fromiter(counts, dtype=np.int64)
            weights = np.array([1.0 + math.log(counts[i]) for i in counts]) * self._idf[indices]
            weights /= np.linalg.norm(weights)
            logits += weights @ self._coef[indices]
        logits -= logits.max()
        probabilities = np.exp(logits)
        return probabilities / probabilities.sum()

    def cookie_domain_features(self, domain: Any) -> np.ndarray:
        counts = self._domain_counts.get(registrable_domain(domain), np.zeros(len(self.classes)))
        sites = counts.sum()
        shares = (counts + self._alpha * self._prior) / (sites + self._alpha)
        return np.append(shares, math.log1p(sites))

    def extract_features(self, cookie: Dict[str, Any]) -> np.ndarray:
        return np.concatenate([
            self._v5.extract_features(cookie),
            self.name_pattern_probabilities(cookie.get("name", "")),
            self.cookie_domain_features(cookie.get("domain", "")),
        ]).astype(np.float32)
