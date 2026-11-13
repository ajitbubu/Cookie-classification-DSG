"""Known cookies: categories other sources already give a cookie, checked before the model.

Built by ``backend/scripts/build_known_cookies.py`` into
``models/known_cookies/known_cookies.json``. A match is evidence for the
reviewer, not a decision: the classify route still sends it to review.

Order:
1. Website majority: at least MAJORITY_MIN_SITES websites declare the cookie in
   their banners and at least MAJORITY_MIN_SHARE of them agree on a category.
2. Open Cookie Database: an exact name, else the longest wildcard prefix.
Otherwise None, and the model's prediction stands.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from backend.scripts.build_production_dataset import cookie_name_family

logger = logging.getLogger(__name__)

MAJORITY_MIN_SITES = 3
MAJORITY_MIN_SHARE = 2 / 3


def site_majority(counts: Optional[Dict[str, int]]) -> Optional[Tuple[str, int, int]]:
    """(category, sites agreeing, sites declaring) when a clear majority exists, else None."""
    if not counts:
        return None
    total = sum(counts.values())
    category = max(sorted(counts), key=counts.get)
    if total >= MAJORITY_MIN_SITES and counts[category] / total >= MAJORITY_MIN_SHARE:
        return category, counts[category], total
    return None


class KnownCookies:
    def __init__(self, table: Dict[str, Any]):
        self._families: Dict[str, Dict[str, int]] = table.get("families", {})
        ocd = table.get("open_cookie_database", {})
        self._ocd_exact: Dict[str, Dict[str, str]] = ocd.get("exact", {})
        self._ocd_prefix = ocd.get("prefix", [])
        self._ocd_agreement: Dict[str, Dict[str, float]] = table.get("ocd_agreement", {})

    @classmethod
    def load(cls, path: Path) -> Optional["KnownCookies"]:
        path = Path(path)
        if not path.exists():
            logger.warning(f"Known-cookie table not found at {path}; scans use the model only")
            return None
        return cls(json.loads(path.read_text()))

    def lookup(self, cookie_name: Any) -> Optional[Dict[str, Any]]:
        """The known category for a cookie name, with where it came from, or None."""
        name = str(cookie_name or "").strip()
        if not name:
            return None
        counts = self._families.get(cookie_name_family(name))
        majority = site_majority(counts)
        if majority:
            category, agreeing, declaring = majority
            return {"category": category, "source": "website_declarations", "confidence": agreeing / declaring,
                    # "N of M websites" already tells the reviewer about the minority.
                    "sites": agreeing, "total_sites": declaring, "site_split": None}
        entry = self._ocd_entry(name.lower())
        if entry:
            category, platform = entry
            # Confidence = how often this OCD category agrees with a clear website majority.
            agreement = self._ocd_agreement.get(category, {}).get("agreement", 0.5)
            return {"category": category, "source": "open_cookie_database", "confidence": agreement,
                    "platform": platform or None, "site_split": dict(counts) if counts else None}
        return None

    def _ocd_entry(self, name: str) -> Optional[Tuple[str, str]]:
        exact = self._ocd_exact.get(name)
        if exact:
            return exact["category"], exact.get("platform", "")
        for prefix, category, platform in self._ocd_prefix:  # longest first
            if name.startswith(prefix):
                return category, platform
        return None
