"""
Feature Extraction Module for Model v3.0.0

Extracts features matching the Colab-trained model (24 features).
"""

import re
from typing import Dict, Any
import numpy as np


class FeatureExtractorV3:
    """Feature extractor for model v3.0.0 — produces 24 features."""

    def __init__(self):
        """Initialize feature extractor."""
        self._feature_names = (
            'expiry_days', 'secure', 'http_only', 'is_third_party',
            'cookie_name_len', 'is_ga_like', 'is_fb_like', 'has_prefix_utm',
            'has_consent_kw', 'has_session_kw', 'domain_length', 'is_subdomain',
            'has_underscore', 'has_number', 'has_dash', 'name_very_short',
            'name_very_long', 'is_session_cookie', 'is_short_term', 'is_long_term',
            'security_score', 'is_likely_tracker', 'has_dot_prefix', 'expiry_category'
        )

    def get_feature_names(self):
        """Return ordered list of feature names."""
        return list(self._feature_names)

    def extract_features(self, cookie: Dict[str, Any]) -> np.ndarray:
        """
        Extract 24 features from cookie metadata.

        Args:
            cookie: Dictionary with cookie metadata
                Required: name, domain
                Optional: expiry_days, secure, http_only, site_domain

        Returns:
            numpy array of shape (24,) with extracted features
        """
        if 'name' not in cookie:
            raise ValueError("Cookie must have 'name' field")

        domain = cookie.get('domain') or cookie.get('cookie_domain')
        if not domain:
            raise ValueError("Cookie must have 'domain' or 'cookie_domain' field")

        name = cookie.get('cookie_name') or cookie.get('name', '')
        expiry_days = int(cookie.get('expiry_days', 0) or 0)
        secure = bool(cookie.get('secure', False))
        http_only = bool(cookie.get('http_only', False))
        site_domain = cookie.get('site_domain', None)

        name_lower = name.lower()

        is_third_party = self._is_third_party(domain, site_domain)
        cookie_name_len = len(name)
        is_ga_like = self._is_ga_like(name, domain)
        is_fb_like = self._is_fb_like(name, domain)
        has_prefix_utm = float(name_lower.startswith('utm') or name_lower.startswith('_utm'))
        has_consent_kw = self._has_consent_keyword(name)
        has_session_kw = self._has_session_keyword(name)

        domain_length = float(len(domain))
        is_subdomain = float(self._is_subdomain(domain))
        has_underscore = float('_' in name)
        has_number = float(bool(re.search(r'\d', name)))
        has_dash = float('-' in name)
        name_very_short = float(len(name) <= 3)
        name_very_long = float(len(name) >= 30)

        is_session_cookie = float(expiry_days == 0)
        is_short_term = float(0 < expiry_days <= 30)
        is_long_term = float(expiry_days > 365)

        security_score = float(int(secure) + int(http_only))
        is_likely_tracker = float(bool(is_ga_like or is_fb_like or has_prefix_utm))
        has_dot_prefix = float(domain.startswith('.'))

        if expiry_days == 0:
            expiry_category = 0.0
        elif expiry_days <= 30:
            expiry_category = 1.0
        elif expiry_days <= 365:
            expiry_category = 2.0
        else:
            expiry_category = 3.0

        features = [
            float(expiry_days),
            float(secure),
            float(http_only),
            float(is_third_party),
            float(cookie_name_len),
            float(is_ga_like),
            float(is_fb_like),
            float(has_prefix_utm),
            float(has_consent_kw),
            float(has_session_kw),
            domain_length,
            is_subdomain,
            has_underscore,
            has_number,
            has_dash,
            name_very_short,
            name_very_long,
            is_session_cookie,
            is_short_term,
            is_long_term,
            security_score,
            is_likely_tracker,
            has_dot_prefix,
            expiry_category,
        ]

        return np.array(features, dtype=np.float32)

    def _is_third_party(self, cookie_domain: str, site_domain) -> float:
        """Check if cookie is third-party."""
        if not site_domain:
            return 0.0
        cookie_domain = cookie_domain.lstrip('.')
        site_domain = site_domain.lstrip('.')
        if cookie_domain == site_domain or cookie_domain.endswith('.' + site_domain):
            return 0.0
        if site_domain.endswith('.' + cookie_domain):
            return 0.0
        return 1.0

    def _is_ga_like(self, name: str, domain: str) -> float:
        """Check if cookie matches Google Analytics patterns."""
        name_lower = name.lower()
        domain_lower = domain.lower()
        ga_names = ('_ga', '_gid', '_gat', '__utma', '__utmb', '__utmc', '__utmz', '__utmt')
        ga_domains = ('google-analytics.com', 'googletagmanager.com')
        for ga_name in ga_names:
            if name_lower.startswith(ga_name):
                return 1.0
        for ga_domain in ga_domains:
            if ga_domain in domain_lower:
                return 1.0
        return 0.0

    def _is_fb_like(self, name: str, domain: str) -> float:
        """Check if cookie matches Facebook patterns."""
        name_lower = name.lower()
        domain_lower = domain.lower()
        fb_names = ('_fb', 'fr', 'sb', 'datr', 'c_user', 'xs')
        fb_domains = ('facebook.com', 'fbcdn.net')
        for fb_name in fb_names:
            if name_lower.startswith(fb_name):
                return 1.0
        for fb_domain in fb_domains:
            if fb_domain in domain_lower:
                return 1.0
        return 0.0

    def _has_consent_keyword(self, name: str) -> float:
        """Check if name contains consent-related keywords."""
        name_lower = name.lower()
        consent_keywords = ('consent', 'gdpr', 'cookie', 'privacy', 'accept', 'banner')
        for keyword in consent_keywords:
            if keyword in name_lower:
                return 1.0
        return 0.0

    def _has_session_keyword(self, name: str) -> float:
        """Check if name contains session-related keywords."""
        name_lower = name.lower()
        session_keywords = ('session', 'sess', 'sid', 'jsession', 'phpsess', 'aspsession')
        for keyword in session_keywords:
            if keyword in name_lower:
                return 1.0
        return 0.0

    def _is_subdomain(self, domain: str) -> bool:
        """Check if domain is a subdomain (has more than 2 parts)."""
        parts = domain.lstrip('.').split('.')
        return len(parts) > 2
