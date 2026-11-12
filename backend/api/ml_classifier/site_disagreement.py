"""Cookies that websites label differently, shipped with the model (v7.1.0+).

``__stripe_mid`` is Strictly Necessary on some cookie banners and Functional on
others. For such cookies there is no single right category, so the Review Queue
shows how the training sites split instead of presenting the model's pick as
settled. The table is written by the trainer as ``label_disagreement.json``:
``{"rule": {...}, "families": {name_family: {label: site_count}}}``.
"""

import json
from pathlib import Path
from typing import Any, Dict, Optional

from backend.scripts.build_production_dataset import cookie_name_family

DISAGREEMENT_FILE = "label_disagreement.json"


class SiteDisagreement:
    def __init__(self, table: Dict[str, Any]):
        self.rule = table.get("rule", {})
        self._families: Dict[str, Dict[str, int]] = table.get("families", {})

    @classmethod
    def load(cls, model_path: Path) -> Optional["SiteDisagreement"]:
        path = Path(model_path) / DISAGREEMENT_FILE
        return cls(json.loads(path.read_text())) if path.exists() else None

    def split(self, cookie_name: Any) -> Optional[Dict[str, int]]:
        """Sites per label for a disputed cookie name, most common first; None if sites agree."""
        counts = self._families.get(cookie_name_family(str(cookie_name or "")))
        return dict(sorted(counts.items(), key=lambda item: -item[1])) if counts else None
