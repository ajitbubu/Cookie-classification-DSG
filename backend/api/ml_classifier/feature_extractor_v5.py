"""
Feature Extractor V5 - Matches model v5.0.0/v6.0.0

Extracts 52 features as expected by the v5/v6 model.
"""

import re
from typing import Dict, List, Any, Optional
import numpy as np


class FeatureExtractorV5:
    """Feature extractor for model v5.0.0 / v6.0.0 — produces 52 features."""

    def __init__(self):
        """Initialize feature extractor"""
        self._feature_names = [
            'expiry_days', 'secure', 'http_only', 'is_third_party',
            'cookie_name_len', 'is_ga_like', 'is_fb_like', 'has_prefix_utm',
            'has_consent_kw', 'has_session_kw', 'is_session', 'is_short_term',
            'is_medium_term', 'is_long_term', 'is_persistent', 'is_com_domain',
            'is_net_domain', 'is_org_domain', 'name_starts_underscore',
            'name_has_id', 'name_has_user', 'name_has_track', 'same_site_lax',
            'same_site_strict', 'same_site_none', 'vendor_first_party',
            'vendor_advertising', 'vendor_analytics', 'tracker_first_party',
            'tracker_advertising', 'tracker_analytics', 'is_google',
            'is_facebook', 'is_amazon', 'is_microsoft', 'is_linkedin',
            'name_prefix_ga', 'name_prefix_fb', 'name_prefix_utm',
            'expiry_exactly_365', 'expiry_exactly_730', 'expiry_exactly_30',
            'expiry_exactly_7', 'vendor_tracker_match', 'both_advertising',
            'both_analytics', 'domain_depth', 'secure_and_httponly',
            'secure_and_third_party', 'name_has_session', 'name_has_analytics',
            'name_has_consent',
        ]

    def get_feature_names(self) -> List[str]:
        """Return ordered list of feature names"""
        return list(self._feature_names)

    def extract_features(self, cookie: Dict[str, Any]) -> np.ndarray:
        """
        Extract 52 features from cookie metadata.

        Args:
            cookie: Dictionary with cookie metadata
                Required: name, domain
                Optional: expiry_days, secure, http_only, same_site, etc.

        Returns:
            numpy array of shape (52,) with extracted features
        """
        name = cookie.get('name', '')
        domain = cookie.get('domain', '')
        expiry_days = int(cookie.get('expiry_days', 0) or 0)
        secure = bool(cookie.get('secure', False))
        http_only = bool(cookie.get('http_only', False))
        same_site = (cookie.get('same_site') or '').lower()
        site_domain = cookie.get('site_domain', None)

        name_lower = name.lower()
        domain_lower = domain.lower().lstrip('.')

        # Third-party detection
        is_third_party = 0.0
        if site_domain:
            sd = site_domain.lower().lstrip('.')
            cd = domain_lower
            if cd != sd and not cd.endswith('.' + sd) and not sd.endswith('.' + cd):
                is_third_party = 1.0

        features = []

        # Basic cookie attributes
        features.append(float(expiry_days))
        features.append(float(secure))
        features.append(float(http_only))
        features.append(is_third_party)
        features.append(float(len(name)))

        # GA / FB / UTM patterns
        is_ga_like = float(
            name_lower.startswith('_ga') or name_lower.startswith('_gid') or
            name_lower.startswith('_gat') or name_lower.startswith('__utm') or
            'google-analytics' in domain_lower or 'googletagmanager' in domain_lower
        )
        is_fb_like = float(
            name_lower.startswith('_fb') or name_lower in ('fr', 'sb', 'datr', 'c_user') or
            'facebook' in domain_lower or 'fbcdn' in domain_lower
        )
        has_prefix_utm = float(name_lower.startswith('__utm') or name_lower.startswith('_utm'))

        features.append(is_ga_like)
        features.append(is_fb_like)
        features.append(has_prefix_utm)

        # Keyword features
        has_consent_kw = float(any(kw in name_lower for kw in ('consent', 'gdpr', 'cookie')))
        has_session_kw = float(any(kw in name_lower for kw in ('session', 'sess')))
        features.append(has_consent_kw)
        features.append(has_session_kw)

        # Expiry buckets
        features.append(float(expiry_days == 0))                       # is_session
        features.append(float(0 < expiry_days <= 30))                  # is_short_term
        features.append(float(30 < expiry_days <= 365))                # is_medium_term
        features.append(float(expiry_days > 365))                      # is_long_term
        features.append(float(expiry_days > 0))                        # is_persistent

        # TLD features
        features.append(float(domain_lower.endswith('.com')))
        features.append(float(domain_lower.endswith('.net')))
        features.append(float(domain_lower.endswith('.org')))

        # Name structural features
        features.append(float(name.startswith('_')))
        features.append(float('id' in name_lower))
        features.append(float('user' in name_lower))
        features.append(float('track' in name_lower or 'trk' in name_lower))

        # SameSite encoding
        features.append(float(same_site == 'lax'))
        features.append(float(same_site == 'strict'))
        features.append(float(same_site == 'none'))

        # Vendor signals (simple domain-based heuristics)
        vendor_first_party = float(is_third_party == 0.0)
        vendor_advertising = float(
            'doubleclick' in domain_lower or 'adnxs' in domain_lower or
            'ads' in domain_lower
        )
        vendor_analytics = float(
            'google-analytics' in domain_lower or 'analytics' in domain_lower or
            'mixpanel' in domain_lower or 'segment' in domain_lower
        )
        features.append(vendor_first_party)
        features.append(vendor_advertising)
        features.append(vendor_analytics)

        # Tracker signals
        tracker_first_party = float(is_third_party == 0.0)
        tracker_advertising = vendor_advertising
        tracker_analytics = vendor_analytics
        features.append(tracker_first_party)
        features.append(tracker_advertising)
        features.append(tracker_analytics)

        # Known vendor domains
        is_google = float(
            'google' in domain_lower or 'gstatic' in domain_lower or
            'doubleclick' in domain_lower
        )
        is_facebook = float('facebook' in domain_lower or 'fbcdn' in domain_lower)
        is_amazon = float('amazon' in domain_lower or 'aws' in domain_lower)
        is_microsoft = float(
            'microsoft' in domain_lower or 'live' in domain_lower or
            'msn' in domain_lower
        )
        is_linkedin = float('linkedin' in domain_lower)
        features.append(is_google)
        features.append(is_facebook)
        features.append(is_amazon)
        features.append(is_microsoft)
        features.append(is_linkedin)

        # Name prefix features
        features.append(float(name_lower.startswith('_ga')))
        features.append(float(name_lower.startswith('_fb')))
        features.append(float(name_lower.startswith('_utm') or name_lower.startswith('__utm')))

        # Exact expiry values
        features.append(float(expiry_days == 365))
        features.append(float(expiry_days == 730))
        features.append(float(expiry_days == 30))
        features.append(float(expiry_days == 7))

        # Combined features
        vendor_tracker_match = float(
            (vendor_advertising == 1.0 and tracker_advertising == 1.0) or
            (vendor_analytics == 1.0 and tracker_analytics == 1.0)
        )
        features.append(vendor_tracker_match)
        features.append(float(vendor_advertising == 1.0 and tracker_advertising == 1.0))
        features.append(float(vendor_analytics == 1.0 and tracker_analytics == 1.0))

        # Domain depth
        domain_depth = float(len(domain_lower.strip('.').split('.')))
        features.append(domain_depth)

        # Security combinations
        features.append(float(secure and http_only))
        features.append(float(secure and is_third_party == 1.0))

        # More name keyword features
        features.append(float('session' in name_lower))
        features.append(float('analytics' in name_lower or 'analytic' in name_lower))
        features.append(float('consent' in name_lower))

        return np.array(features, dtype=np.float32)


def get_feature_extractor_for_model(model_version: str):
    """
    Get the appropriate feature extractor for a model version.

    Args:
        model_version: Model version string (e.g., "5.0.0", "6.0.0")

    Returns:
        Feature extractor instance
    """
    if model_version.startswith('5.') or model_version.startswith('6.'):
        return FeatureExtractorV5()
    elif model_version.startswith('3.'):
        from .feature_extractor_v3 import FeatureExtractorV3
        return FeatureExtractorV3()
    else:
        from .feature_extractor import FeatureExtractor
        return FeatureExtractor()
