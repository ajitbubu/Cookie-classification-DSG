"""
Active Learning Pipeline for Dataset Expansion

Identifies low-confidence predictions and ambiguous cases for human review
to efficiently expand the training dataset.
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json

from .classifier import CookieClassifier, ClassificationResult
from .config import CONFIDENCE_HIGH_THRESHOLD, CONFIDENCE_MEDIUM_THRESHOLD


@dataclass
class ReviewCandidate:
    """Cookie that requires human review for dataset expansion."""
    cookie_id: str
    cookie_data: Dict[str, Any]
    predicted_category: str
    confidence_score: float
    alternatives: List[Dict[str, float]]
    uncertainty_score: float
    selection_reason: str
    selected_at: datetime


class ActiveLearningSelector:
    """Selects cookies for human review using active learning strategies."""

    def __init__(self, classifier: Optional[CookieClassifier] = None):
        """
        Initialize active learning selector.

        Args:
            classifier: Cookie classifier instance
        """
        self.classifier = classifier or CookieClassifier()

    def calculate_uncertainty(self, probabilities: Dict[str, float]) -> float:
        """
        Calculate prediction uncertainty using entropy.

        Args:
            probabilities: Category probability distribution

        Returns:
            Uncertainty score (0-1, higher = more uncertain)
        """
        probs = np.array(list(probabilities.values()))
        probs = probs[probs > 0]  # Remove zeros for log

        if len(probs) == 0:
            return 0.0

        # Calculate entropy
        entropy = -np.sum(probs * np.log2(probs))

        # Normalize to 0-1 range
        max_entropy = np.log2(len(probabilities))
        normalized_uncertainty = entropy / max_entropy if max_entropy > 0 else 0.0

        return normalized_uncertainty

    def calculate_margin(self, probabilities: Dict[str, float]) -> float:
        """
        Calculate margin between top two predictions.

        Args:
            probabilities: Category probability distribution

        Returns:
            Margin score (0-1, lower = more uncertain)
        """
        sorted_probs = sorted(probabilities.values(), reverse=True)

        if len(sorted_probs) < 2:
            return 1.0

        # Margin is difference between top 2
        margin = sorted_probs[0] - sorted_probs[1]

        return margin

    def select_uncertain_samples(
        self,
        cookies: List[Dict[str, Any]],
        n_samples: int = 50,
        strategy: str = "entropy"
    ) -> List[ReviewCandidate]:
        """
        Select most uncertain samples for human review.

        Args:
            cookies: List of cookies to evaluate
            n_samples: Number of samples to select
            strategy: Selection strategy ('entropy', 'margin', 'confidence', 'combined')

        Returns:
            List of review candidates sorted by uncertainty
        """
        print(f"🎯 Selecting {n_samples} samples for review using '{strategy}' strategy...")

        candidates = []

        for cookie in cookies:
            # Classify cookie
            result = self.classifier.classify(cookie, return_alternatives=True, top_k=3)

            # Calculate uncertainty based on strategy
            if strategy == "entropy":
                uncertainty = self.calculate_uncertainty(result.probabilities)
                reason = "High entropy (uncertain prediction)"

            elif strategy == "margin":
                margin = self.calculate_margin(result.probabilities)
                uncertainty = 1.0 - margin  # Convert to uncertainty
                reason = "Low margin between top predictions"

            elif strategy == "confidence":
                uncertainty = 1.0 - result.confidence_score
                reason = "Low confidence score"

            elif strategy == "combined":
                entropy = self.calculate_uncertainty(result.probabilities)
                margin = self.calculate_margin(result.probabilities)
                confidence = 1.0 - result.confidence_score

                # Weighted combination
                uncertainty = 0.4 * entropy + 0.3 * (1.0 - margin) + 0.3 * confidence
                reason = "Combined uncertainty metrics"

            else:
                raise ValueError(f"Unknown strategy: {strategy}")

            # Create candidate
            candidate = ReviewCandidate(
                cookie_id=cookie.get('id', f"cookie_{len(candidates)}"),
                cookie_data=cookie,
                predicted_category=result.predicted_category,
                confidence_score=result.confidence_score,
                alternatives=[
                    {'category': alt.category, 'probability': alt.probability}
                    for alt in result.alternatives
                ],
                uncertainty_score=uncertainty,
                selection_reason=reason,
                selected_at=datetime.now()
            )

            candidates.append(candidate)

        # Sort by uncertainty (descending)
        candidates.sort(key=lambda x: x.uncertainty_score, reverse=True)

        # Select top N
        selected = candidates[:n_samples]

        print(f"✅ Selected {len(selected)} candidates")
        print(f"   Avg uncertainty: {np.mean([c.uncertainty_score for c in selected]):.3f}")
        print(f"   Avg confidence:  {np.mean([c.confidence_score for c in selected]):.3f}")

        return selected

    def select_diverse_samples(
        self,
        cookies: List[Dict[str, Any]],
        n_samples: int = 50,
        diversity_weight: float = 0.3
    ) -> List[ReviewCandidate]:
        """
        Select diverse samples to improve dataset coverage.

        Uses a combination of uncertainty and diversity to avoid selecting
        too many similar cookies.

        Args:
            cookies: List of cookies to evaluate
            n_samples: Number of samples to select
            diversity_weight: Weight for diversity vs uncertainty (0-1)

        Returns:
            List of diverse review candidates
        """
        print(f"🎯 Selecting {n_samples} diverse samples...")

        # First, get uncertain candidates
        all_candidates = self.select_uncertain_samples(
            cookies,
            n_samples=min(len(cookies), n_samples * 3),  # Select 3x more initially
            strategy="combined"
        )

        # Now select diverse subset
        selected = []
        remaining = all_candidates.copy()

        # Always select the most uncertain one first
        selected.append(remaining.pop(0))

        while len(selected) < n_samples and remaining:
            best_candidate = None
            best_score = -1

            for candidate in remaining:
                # Calculate diversity score (how different from already selected)
                diversity_score = self._calculate_diversity(candidate, selected)

                # Combined score
                combined_score = (
                    (1 - diversity_weight) * candidate.uncertainty_score +
                    diversity_weight * diversity_score
                )

                if combined_score > best_score:
                    best_score = combined_score
                    best_candidate = candidate

            if best_candidate:
                selected.append(best_candidate)
                remaining.remove(best_candidate)

        print(f"✅ Selected {len(selected)} diverse candidates")

        return selected

    def _calculate_diversity(
        self,
        candidate: ReviewCandidate,
        selected: List[ReviewCandidate]
    ) -> float:
        """
        Calculate how diverse a candidate is from already selected samples.

        Args:
            candidate: Candidate to evaluate
            selected: Already selected candidates

        Returns:
            Diversity score (0-1, higher = more diverse)
        """
        if not selected:
            return 1.0

        # Calculate average similarity to selected samples
        similarities = []

        for sel in selected:
            # Simple feature-based similarity
            sim = 0.0

            # Name similarity
            if candidate.cookie_data.get('name') == sel.cookie_data.get('name'):
                sim += 0.4

            # Domain similarity
            if candidate.cookie_data.get('domain') == sel.cookie_data.get('domain'):
                sim += 0.3

            # Category similarity
            if candidate.predicted_category == sel.predicted_category:
                sim += 0.3

            similarities.append(sim)

        # Diversity is inverse of average similarity
        avg_similarity = np.mean(similarities)
        diversity = 1.0 - avg_similarity

        return diversity

    def select_borderline_samples(
        self,
        cookies: List[Dict[str, Any]],
        n_samples: int = 50,
        margin_threshold: float = 0.15
    ) -> List[ReviewCandidate]:
        """
        Select samples near decision boundaries.

        These are cookies where multiple categories have similar probabilities.

        Args:
            cookies: List of cookies to evaluate
            n_samples: Number of samples to select
            margin_threshold: Maximum margin to consider borderline

        Returns:
            List of borderline review candidates
        """
        print(f"🎯 Selecting {n_samples} borderline samples (margin < {margin_threshold})...")

        borderline = []

        for cookie in cookies:
            result = self.classifier.classify(cookie, return_alternatives=True, top_k=3)

            # Calculate margin
            margin = self.calculate_margin(result.probabilities)

            if margin < margin_threshold:
                candidate = ReviewCandidate(
                    cookie_id=cookie.get('id', f"cookie_{len(borderline)}"),
                    cookie_data=cookie,
                    predicted_category=result.predicted_category,
                    confidence_score=result.confidence_score,
                    alternatives=[
                        {'category': alt.category, 'probability': alt.probability}
                        for alt in result.alternatives
                    ],
                    uncertainty_score=1.0 - margin,
                    selection_reason=f"Borderline case (margin={margin:.3f})",
                    selected_at=datetime.now()
                )

                borderline.append(candidate)

        # Sort by margin (ascending - smallest margin first)
        borderline.sort(key=lambda x: 1.0 - x.uncertainty_score)

        selected = borderline[:n_samples]

        print(f"✅ Found {len(borderline)} borderline cases, selected {len(selected)}")

        return selected

    def export_for_review(
        self,
        candidates: List[ReviewCandidate],
        output_path: Path,
        format: str = "json"
    ):
        """
        Export candidates to file for human review.

        Args:
            candidates: List of review candidates
            output_path: Path to output file
            format: Output format ('json' or 'csv')
        """
        print(f"💾 Exporting {len(candidates)} candidates to {output_path}...")

        if format == "json":
            data = {
                'exported_at': datetime.now().isoformat(),
                'total_candidates': len(candidates),
                'candidates': [
                    {
                        'cookie_id': c.cookie_id,
                        'cookie_data': c.cookie_data,
                        'predicted_category': c.predicted_category,
                        'confidence_score': c.confidence_score,
                        'alternatives': c.alternatives,
                        'uncertainty_score': c.uncertainty_score,
                        'selection_reason': c.selection_reason,
                        'human_label': None,  # To be filled by reviewer
                        'review_notes': None  # To be filled by reviewer
                    }
                    for c in candidates
                ]
            }

            with open(output_path, 'w') as f:
                json.dump(data, f, indent=2)

        elif format == "csv":
            import csv

            with open(output_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'cookie_id', 'name', 'domain', 'predicted_category',
                    'confidence_score', 'uncertainty_score', 'selection_reason',
                    'human_label', 'review_notes'
                ])

                writer.writeheader()
                for c in candidates:
                    writer.writerow({
                        'cookie_id': c.cookie_id,
                        'name': c.cookie_data.get('name', ''),
                        'domain': c.cookie_data.get('domain', ''),
                        'predicted_category': c.predicted_category,
                        'confidence_score': f"{c.confidence_score:.3f}",
                        'uncertainty_score': f"{c.uncertainty_score:.3f}",
                        'selection_reason': c.selection_reason,
                        'human_label': '',
                        'review_notes': ''
                    })

        print(f"✅ Export complete: {output_path}")
        print(f"   Please review and add 'human_label' for each cookie")


def generate_review_batch(
    cookies: List[Dict[str, Any]],
    batch_size: int = 100,
    output_dir: str = "review_batches",
    strategy: str = "diverse"
) -> Path:
    """
    Generate a batch of cookies for human review.

    This is a high-level convenience function for creating review batches.

    Args:
        cookies: List of cookies to sample from
        batch_size: Number of cookies to select
        output_dir: Directory to save review batch
        strategy: Selection strategy ('uncertain', 'diverse', 'borderline')

    Returns:
        Path to exported review batch
    """
    print("=" * 70)
    print("Active Learning: Generating Review Batch")
    print("=" * 70)
    print()

    selector = ActiveLearningSelector()

    # Select candidates based on strategy
    if strategy == "uncertain":
        candidates = selector.select_uncertain_samples(cookies, n_samples=batch_size)
    elif strategy == "diverse":
        candidates = selector.select_diverse_samples(cookies, n_samples=batch_size)
    elif strategy == "borderline":
        candidates = selector.select_borderline_samples(cookies, n_samples=batch_size)
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    # Export to file
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = output_path / f"review_batch_{strategy}_{timestamp}.json"

    selector.export_for_review(candidates, filename, format="json")

    print()
    print("=" * 70)
    print(f"✅ Review batch ready: {filename}")
    print("=" * 70)

    return filename


if __name__ == "__main__":
    # Example usage
    print("Active Learning Pipeline - Example Usage")
    print()

    # Example: Generate review batch from unclassified cookies
    example_cookies = [
        {'name': f'cookie_{i}', 'domain': f'example{i % 5}.com'}
        for i in range(500)
    ]

    batch_file = generate_review_batch(
        cookies=example_cookies,
        batch_size=50,
        strategy="diverse"
    )

    print(f"\nNext steps:")
    print(f"1. Open {batch_file}")
    print(f"2. Review each cookie and add 'human_label' field")
    print(f"3. Use labeled data to retrain model with expanded dataset")
