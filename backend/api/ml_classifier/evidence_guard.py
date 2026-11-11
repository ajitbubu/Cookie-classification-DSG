"""Hallucination guard shared by inference and training evaluation (decision D12).

``classifier.py`` applies it to every prediction and ``train_cookie_model.py``
applies it before choosing thresholds and scoring the auto policy, so the
trainer's metrics describe the behaviour production actually has.
"""

from __future__ import annotations

from typing import Sequence, Tuple

import numpy as np

from .config import IDENTITY_EVIDENCE_FEATURES, NO_EVIDENCE_CONFIDENCE_CAP


def evidence_indices(feature_names: Sequence[str]) -> list[int]:
    """Column indices of the identity-evidence features present in this feature set."""
    names = list(feature_names)
    return [names.index(name) for name in IDENTITY_EVIDENCE_FEATURES if name in names]


def apply_evidence_guard(
    features: np.ndarray,
    probabilities: np.ndarray,
    indices: Sequence[int],
    cap: float = NO_EVIDENCE_CONFIDENCE_CAP,
) -> Tuple[np.ndarray, np.ndarray]:
    """Cap confidence for cookies with no name-pattern or vendor signal.

    Such rows are shrunk toward the uniform distribution until the top
    probability equals ``cap``, so the ranking and the probability sum are
    preserved while the confidence stops overstating what the attributes alone
    can support. Returns the guarded probabilities and the lacks-evidence mask;
    a lacks-evidence row is never auto-classified.
    """
    if not len(indices):
        return probabilities, np.zeros(len(probabilities), dtype=bool)
    lacks_evidence = ~np.any(features[:, list(indices)] != 0, axis=1)
    guarded = probabilities.copy()
    uniform = 1.0 / probabilities.shape[1]
    for row in np.flatnonzero(lacks_evidence):
        top = guarded[row].max()
        if top > cap:
            weight = (cap - uniform) / (top - uniform)
            guarded[row] = weight * guarded[row] + (1.0 - weight) * uniform
    return guarded, lacks_evidence
