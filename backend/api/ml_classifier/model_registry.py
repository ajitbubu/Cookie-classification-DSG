"""
Model Registry and Versioning System

Manages multiple model versions with A/B testing capabilities.
Supports champion/challenger model deployment and automated rollback.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import random

from .config import MODELS_DIR


class ModelStatus(Enum):
    """Model deployment status."""
    TRAINING = "training"
    STAGING = "staging"
    TESTING = "testing"
    PRODUCTION = "production"
    CHAMPION = "champion"
    CHALLENGER = "challenger"
    RETIRED = "retired"
    FAILED = "failed"


@dataclass
class ModelMetrics:
    """Model performance metrics."""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    avg_confidence: float
    cv_accuracy_mean: Optional[float] = None
    cv_accuracy_std: Optional[float] = None


@dataclass
class ModelVersion:
    """Model version information."""
    version: str
    model_type: str
    status: ModelStatus
    trained_at: datetime
    deployed_at: Optional[datetime]
    retired_at: Optional[datetime]
    metrics: ModelMetrics
    num_features: int
    categories: List[str]
    model_path: Path
    notes: str = ""


class ModelRegistry:
    """Registry for managing model versions."""

    def __init__(self, registry_path: Optional[Path] = None):
        """
        Initialize model registry.

        Args:
            registry_path: Path to registry JSON file
        """
        self.registry_path = registry_path or (MODELS_DIR / "registry.json")
        self.models: Dict[str, ModelVersion] = {}
        self._load_registry()

    def _load_registry(self):
        """Load registry from file."""
        if self.registry_path.exists():
            with open(self.registry_path, 'r') as f:
                data = json.load(f)

            for version, model_data in data.items():
                # Parse dates
                trained_at = datetime.fromisoformat(model_data['trained_at'])
                deployed_at = (
                    datetime.fromisoformat(model_data['deployed_at'])
                    if model_data.get('deployed_at')
                    else None
                )
                retired_at = (
                    datetime.fromisoformat(model_data['retired_at'])
                    if model_data.get('retired_at')
                    else None
                )

                # Parse metrics
                metrics = ModelMetrics(**model_data['metrics'])

                # Create model version
                model = ModelVersion(
                    version=version,
                    model_type=model_data['model_type'],
                    status=ModelStatus(model_data['status']),
                    trained_at=trained_at,
                    deployed_at=deployed_at,
                    retired_at=retired_at,
                    metrics=metrics,
                    num_features=model_data['num_features'],
                    categories=model_data['categories'],
                    model_path=Path(model_data['model_path']),
                    notes=model_data.get('notes', '')
                )

                self.models[version] = model

    def _save_registry(self):
        """Save registry to file."""
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)

        data = {}
        for version, model in self.models.items():
            data[version] = {
                'version': model.version,
                'model_type': model.model_type,
                'status': model.status.value,
                'trained_at': model.trained_at.isoformat(),
                'deployed_at': model.deployed_at.isoformat() if model.deployed_at else None,
                'retired_at': model.retired_at.isoformat() if model.retired_at else None,
                'metrics': asdict(model.metrics),
                'num_features': model.num_features,
                'categories': model.categories,
                'model_path': str(model.model_path),
                'notes': model.notes
            }

        with open(self.registry_path, 'w') as f:
            json.dump(data, f, indent=2)

    def register_model(
        self,
        version: str,
        model_path: Path,
        metadata: Dict[str, Any],
        status: ModelStatus = ModelStatus.STAGING,
        notes: str = ""
    ) -> ModelVersion:
        """
        Register a new model version.

        Args:
            version: Model version string (e.g., "1.0.0", "1.1.0")
            model_path: Path to model directory
            metadata: Model metadata from training
            status: Initial deployment status
            notes: Optional notes about this version

        Returns:
            Registered ModelVersion
        """
        print(f"📝 Registering model v{version}...")

        # Parse metrics
        metrics = ModelMetrics(
            accuracy=metadata['metrics']['accuracy'],
            precision=metadata['metrics']['precision'],
            recall=metadata['metrics']['recall'],
            f1_score=metadata['metrics']['f1_score'],
            avg_confidence=metadata['metrics']['avg_confidence'],
            cv_accuracy_mean=metadata.get('cross_validation', {}).get('cv_accuracy_mean'),
            cv_accuracy_std=metadata.get('cross_validation', {}).get('cv_accuracy_std')
        )

        # Create model version
        model = ModelVersion(
            version=version,
            model_type=metadata['model_type'],
            status=status,
            trained_at=datetime.fromisoformat(metadata['trained_at']),
            deployed_at=None,
            retired_at=None,
            metrics=metrics,
            num_features=metadata['num_features'],
            categories=metadata['categories'],
            model_path=model_path,
            notes=notes
        )

        self.models[version] = model
        self._save_registry()

        print(f"✅ Model v{version} registered with status: {status.value}")

        return model

    def get_model(self, version: str) -> Optional[ModelVersion]:
        """Get model by version."""
        return self.models.get(version)

    def get_champion_model(self) -> Optional[ModelVersion]:
        """Get current champion (production) model."""
        for model in self.models.values():
            if model.status == ModelStatus.CHAMPION:
                return model
        return None

    def get_challenger_model(self) -> Optional[ModelVersion]:
        """Get current challenger model for A/B testing."""
        for model in self.models.values():
            if model.status == ModelStatus.CHALLENGER:
                return model
        return None

    def list_models(
        self,
        status: Optional[ModelStatus] = None
    ) -> List[ModelVersion]:
        """
        List all models, optionally filtered by status.

        Args:
            status: Filter by status (None = all models)

        Returns:
            List of model versions
        """
        if status:
            return [m for m in self.models.values() if m.status == status]
        return list(self.models.values())

    def promote_to_production(
        self,
        version: str,
        retire_current: bool = True
    ) -> ModelVersion:
        """
        Promote a model to production (champion).

        Args:
            version: Model version to promote
            retire_current: Whether to retire current champion

        Returns:
            Promoted model version

        Raises:
            ValueError: If model not found or not ready for production
        """
        print(f"🚀 Promoting model v{version} to production...")

        model = self.get_model(version)
        if not model:
            raise ValueError(f"Model v{version} not found")

        if model.status == ModelStatus.FAILED:
            raise ValueError(f"Cannot promote failed model v{version}")

        # Retire current champion if requested
        if retire_current:
            current_champion = self.get_champion_model()
            if current_champion:
                print(f"   Retiring current champion v{current_champion.version}")
                current_champion.status = ModelStatus.RETIRED
                current_champion.retired_at = datetime.now()

        # Promote new model
        model.status = ModelStatus.CHAMPION
        model.deployed_at = datetime.now()

        self._save_registry()

        print(f"✅ Model v{version} is now in production")

        return model

    def set_challenger(self, version: str) -> ModelVersion:
        """
        Set a model as challenger for A/B testing.

        Args:
            version: Model version to set as challenger

        Returns:
            Challenger model version
        """
        print(f"🧪 Setting model v{version} as challenger...")

        model = self.get_model(version)
        if not model:
            raise ValueError(f"Model v{version} not found")

        # Remove current challenger status
        current_challenger = self.get_challenger_model()
        if current_challenger:
            print(f"   Removing challenger status from v{current_challenger.version}")
            current_challenger.status = ModelStatus.STAGING

        # Set new challenger
        model.status = ModelStatus.CHALLENGER
        model.deployed_at = datetime.now()

        self._save_registry()

        print(f"✅ Model v{version} is now challenger for A/B testing")

        return model

    def rollback(self, to_version: Optional[str] = None) -> ModelVersion:
        """
        Rollback to a previous model version.

        Args:
            to_version: Specific version to rollback to (None = previous champion)

        Returns:
            Rolled back model version
        """
        print("⏮️  Rolling back model...")

        if to_version:
            model = self.get_model(to_version)
            if not model:
                raise ValueError(f"Model v{to_version} not found")
        else:
            # Find most recent retired model
            retired = [m for m in self.models.values() if m.status == ModelStatus.RETIRED]
            if not retired:
                raise ValueError("No previous model to rollback to")

            retired.sort(key=lambda m: m.retired_at or datetime.min, reverse=True)
            model = retired[0]

        print(f"   Rolling back to v{model.version}")

        return self.promote_to_production(model.version, retire_current=True)

    def compare_models(
        self,
        version1: str,
        version2: str
    ) -> Dict[str, Any]:
        """
        Compare two model versions.

        Args:
            version1: First model version
            version2: Second model version

        Returns:
            Comparison dictionary
        """
        model1 = self.get_model(version1)
        model2 = self.get_model(version2)

        if not model1 or not model2:
            raise ValueError("One or both models not found")

        return {
            'model1': {
                'version': model1.version,
                'accuracy': model1.metrics.accuracy,
                'f1_score': model1.metrics.f1_score,
                'avg_confidence': model1.metrics.avg_confidence,
                'status': model1.status.value
            },
            'model2': {
                'version': model2.version,
                'accuracy': model2.metrics.accuracy,
                'f1_score': model2.metrics.f1_score,
                'avg_confidence': model2.metrics.avg_confidence,
                'status': model2.status.value
            },
            'difference': {
                'accuracy': model2.metrics.accuracy - model1.metrics.accuracy,
                'f1_score': model2.metrics.f1_score - model1.metrics.f1_score,
                'avg_confidence': model2.metrics.avg_confidence - model1.metrics.avg_confidence
            }
        }


class ABTestingController:
    """Controls A/B testing between champion and challenger models."""

    def __init__(
        self,
        registry: ModelRegistry,
        traffic_split: float = 0.1
    ):
        """
        Initialize A/B testing controller.

        Args:
            registry: Model registry instance
            traffic_split: Percentage of traffic for challenger (0.0-1.0)
        """
        self.registry = registry
        self.traffic_split = traffic_split
        self.metrics_log: List[Dict[str, Any]] = []

    def select_model(self, request_id: Optional[str] = None) -> str:
        """
        Select which model to use for a request.

        Args:
            request_id: Optional request ID for consistent routing

        Returns:
            Model version to use
        """
        champion = self.registry.get_champion_model()
        challenger = self.registry.get_challenger_model()

        # If no challenger, use champion
        if not challenger:
            return champion.version if champion else None

        # Deterministic routing based on request_id if provided
        if request_id:
            # Hash request_id to determine routing
            hash_value = hash(request_id)
            use_challenger = (hash_value % 100) < (self.traffic_split * 100)
        else:
            # Random routing
            use_challenger = random.random() < self.traffic_split

        if use_challenger:
            return challenger.version
        else:
            return champion.version if champion else challenger.version

    def log_prediction(
        self,
        model_version: str,
        cookie_id: str,
        predicted_category: str,
        confidence_score: float,
        processing_time_ms: float
    ):
        """
        Log a prediction for A/B testing analysis.

        Args:
            model_version: Model version used
            cookie_id: Cookie ID
            predicted_category: Predicted category
            confidence_score: Confidence score
            processing_time_ms: Processing time in milliseconds
        """
        self.metrics_log.append({
            'timestamp': datetime.now().isoformat(),
            'model_version': model_version,
            'cookie_id': cookie_id,
            'predicted_category': predicted_category,
            'confidence_score': confidence_score,
            'processing_time_ms': processing_time_ms
        })

    def analyze_ab_test(self) -> Dict[str, Any]:
        """
        Analyze A/B test results.

        Returns:
            Analysis results comparing champion and challenger
        """
        champion = self.registry.get_champion_model()
        challenger = self.registry.get_challenger_model()

        if not champion or not challenger:
            return {'error': 'Champion or challenger not configured'}

        # Filter metrics by model
        champion_metrics = [m for m in self.metrics_log if m['model_version'] == champion.version]
        challenger_metrics = [m for m in self.metrics_log if m['model_version'] == challenger.version]

        if not champion_metrics or not challenger_metrics:
            return {'error': 'Insufficient data for analysis'}

        # Calculate statistics
        champion_stats = {
            'total_predictions': len(champion_metrics),
            'avg_confidence': sum(m['confidence_score'] for m in champion_metrics) / len(champion_metrics),
            'avg_latency_ms': sum(m['processing_time_ms'] for m in champion_metrics) / len(champion_metrics)
        }

        challenger_stats = {
            'total_predictions': len(challenger_metrics),
            'avg_confidence': sum(m['confidence_score'] for m in challenger_metrics) / len(challenger_metrics),
            'avg_latency_ms': sum(m['processing_time_ms'] for m in challenger_metrics) / len(challenger_metrics)
        }

        # Recommendation
        confidence_improvement = challenger_stats['avg_confidence'] - champion_stats['avg_confidence']
        latency_degradation = challenger_stats['avg_latency_ms'] - champion_stats['avg_latency_ms']

        recommendation = "Keep testing"
        if confidence_improvement > 0.02 and latency_degradation < 50:
            recommendation = "Promote challenger to champion"
        elif confidence_improvement < -0.02 or latency_degradation > 100:
            recommendation = "Reject challenger, keep champion"

        return {
            'champion': {
                'version': champion.version,
                'stats': champion_stats
            },
            'challenger': {
                'version': challenger.version,
                'stats': challenger_stats
            },
            'comparison': {
                'confidence_improvement': confidence_improvement,
                'latency_change_ms': latency_degradation
            },
            'recommendation': recommendation
        }


# Convenience functions

_registry_instance = None


def get_model_registry() -> ModelRegistry:
    """Get singleton model registry instance."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ModelRegistry()
    return _registry_instance


if __name__ == "__main__":
    # Example usage
    print("Model Registry - Example Usage")
    print()

    registry = ModelRegistry()

    # List all models
    print("Registered models:")
    for model in registry.list_models():
        print(f"  v{model.version}: {model.status.value} (F1={model.metrics.f1_score:.3f})")
