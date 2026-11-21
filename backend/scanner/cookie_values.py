"""Keep cookie values out of scan results.

Scanned cookies carry other sites' session tokens and user identifiers. The scan
store already drops them on save (``strip_cookie_values`` in
``backend/db/scan_store.py``); this drops them before they leave the scanner, so
they never reach the API response or the browser either.

The model only needs three numbers derived from the value, so those are kept.
They must match ``src/lib/cookieValueFeatures.js`` and ``_extract_value_features``
in ``backend/api/ml_classifier/feature_extractor.py`` exactly: computed over the
first 50 characters, UUID searched in the lower-cased text, base64 meaning at
least 4 characters of ``[A-Za-z0-9+/]`` with ``=`` padding and a length divisible
by 4. Kept here rather than imported so the scanner doesn't load the ML package.
"""

import re
from typing import Any, Dict

VALUE_SAMPLE_LENGTH = 50
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_BASE64 = re.compile(r"^[A-Za-z0-9+/]+=*$")


def value_features(value: Any) -> Dict[str, Any]:
    """The model's value features, without the value."""
    sample = str(value)[:VALUE_SAMPLE_LENGTH] if value else ""
    return {
        "value_length": len(sample),
        "value_is_uuid": bool(_UUID.search(sample.lower())),
        "value_is_base64": len(sample) >= 4 and bool(_BASE64.match(sample)) and len(sample) % 4 == 0,
    }


def without_value(cookie: Dict[str, Any]) -> Dict[str, Any]:
    """A copy of a browser cookie with its value replaced by size + model features."""
    value = cookie.get("value") or ""
    redacted = {key: val for key, val in cookie.items() if key != "value"}
    redacted["size"] = len(value)
    redacted.update(value_features(value))
    return redacted
