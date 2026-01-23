"""
Feature Extraction Module for Model v3.0.0

Extracts features matching the Colab-trained model (24 features).
"""

import re
from typing import Dict, Any
import numpy as np


class FeatureExtractorV3:
    """Extracts 24 features for v3.0.0 model."""
    
    def __init__(self):
        """Initialize feature extractor."""
        # Based on the actual model training, these are the 24 features
        self._feature_names = [
            # Original 10 basic features
            'expiry_days',
            'secure',
            'http_only',
            'is_third_party',
            'cookie_name_len',
            'is_ga_like',
            'is_fb_like',
            'has_prefix_utm',
            'has_consent_kw',
            'has_session_kw',
            # Enhanced features (14 more = 24 total)
            'domain_length',
            'is_subdomain',
            'has_underscore',
            'has_number',
            'has_dash',
            'name_very_short',
            'name_very_long',
            'is_session_cookie',
            'is_short_term',
            'is_long_term',
            'security_score',
            'is_likely_tracker',
            'has_dot_prefix',
            'expiry_category'
        ]
    
    def get_feature_names(self):
        """Return ordered list of feature names."""
        return self._feature_names.copy()
    
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
        # Validate required fields
        if 'name' not in cookie:
            raise ValueError("Cookie must have 'name' field")
        if 'domain' not in cookie and 'cookie_domain' not in cookie:
            raise ValueError("Cookie must have 'domain' or 'cookie_domain' field")
        
        name = cookie.get('name', cookie.get('cookie_name', ''))
        domain = cookie.get('domain', cookie.get('cookie_domain', ''))
        expiry_days = cookie.get('expiry_days', 0)
        secure = int(cookie.get('secure', False))
        http_only = int(cookie.get('http_only', False))
        site_domain = cookie.get('site_domain', '')
        
        # Feature 1: expiry_days
        expiry = float(expiry_days if expiry_days is not None else 0)
        
        # Feature 2: secure
        secure_flag = float(secure)
        
        # Feature 3: http_only
        http_only_flag = float(http_only)
        
        # Feature 4: is_third_party
        is_third_party = self._is_third_party(domain, site_domain)
        
        # Feature 5: cookie_name_len
        cookie_name_len = float(len(name))
        
        # Feature 6: is_ga_like (Google Analytics)
        is_ga_like = self._is_ga_like(name, domain)
        
        # Feature 7: is_fb_like (Facebook)
        is_fb_like = self._is_fb_like(name, domain)
        
        # Feature 8: has_prefix_utm
        has_prefix_utm = float(name.lower().startswith('utm'))
        
        # Feature 9: has_consent_kw
        has_consent_kw = self._has_consent_keyword(name)
        
        # Feature 10: has_session_kw
        has_session_kw = self._has_session_keyword(name)
        
        # Feature 11: domain_length
        domain_length = float(len(domain))
        
        # Feature 12: is_subdomain
        is_subdomain = self._is_subdomain(domain)
        
        # Feature 13: has_underscore
        has_underscore = float('_' in name)
        
        # Feature 14: has_number
        has_number = float(bool(re.search(r'\d', name)))
        
        # Feature 15: has_dash
        has_dash = float('-' in name)
        
        # Feature 16: name_very_short
        name_very_short = float(len(name) <= 3)
        
        # Feature 17: name_very_long
        name_very_long = float(len(name) >= 30)
        
        # Feature 18: is_session_cookie
        is_session_cookie = float(expiry == 0)
        
        # Feature 19: is_short_term
        is_short_term = float(0 < expiry <= 30)
        
        # Feature 20: is_long_term
        is_long_term = float(expiry > 365)
        
        # Feature 21: security_score
        security_score = float(secure + http_only + (1 - is_third_party))
        
        # Feature 22: is_likely_tracker
        is_likely_tracker = float(is_third_party == 1.0 and (is_ga_like == 1.0 or is_fb_like == 1.0))
        
        # Feature 23: has_dot_prefix
        has_dot_prefix = float(domain.startswith('.'))
        
        # Feature 24: expiry_category (0=session, 1=short, 2=medium, 3=long)
        if expiry == 0:
            expiry_category = 0.0
        elif expiry <= 30:
            expiry_category = 1.0
        elif expiry <= 365:
            expiry_category = 2.0
        else:
            expiry_category = 3.0
        
        features = [
            expiry,
            secure_flag,
            http_only_flag,
            is_third_party,
            cookie_name_len,
            is_ga_like,
            is_fb_like,
            has_prefix_utm,
            has_consent_kw,
            has_session_kw,
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
            expiry_category
        ]
        
        return np.array(features, dtype=np.float32)
    
    def _is_third_party(self, cookie_domain: str, site_domain: str) -> float:
        """Check if cookie is third-party."""
        if not site_domain:
            return 0.0
        
        # Remove leading dots
        cookie_domain = cookie_domain.lstrip('.')
        site_domain = site_domain.lstrip('.')
        
        # Check if domains match or cookie domain is subdomain of site
        if cookie_domain == site_domain:
            return 0.0
        if cookie_domain.endswith('.' + site_domain):
            return 0.0
        if site_domain.endswith('.' + cookie_domain):
            return 0.0
        
        return 1.0
    
    def _is_ga_like(self, name: str, domain: str) -> float:
        """Check if cookie matches Google Analytics patterns."""
        name_lower = name.lower()
        domain_lower = domain.lower()
        
        ga_names = ['_ga', '_gid', '_gat', '__utma', '__utmb', '__utmc', '__utmz', '__utmt']
        ga_domains = ['google-analytics.com', 'googletagmanager.com']
        
        # Check name patterns
        for ga_name in ga_names:
            if name_lower.startswith(ga_name):
                return 1.0
        
        # Check domain patterns
        for ga_domain in ga_domains:
            if ga_domain in domain_lower:
                return 1.0
        
        return 0.0
    
    def _is_fb_like(self, name: str, domain: str) -> float:
        """Check if cookie matches Facebook patterns."""
        name_lower = name.lower()
        domain_lower = domain.lower()
        
        fb_names = ['_fb', 'fr', 'sb', 'datr', 'c_user', 'xs']
        fb_domains = ['facebook.com', 'fbcdn.net']
        
        # Check name patterns
        for fb_name in fb_names:
            if name_lower.startswith(fb_name) or name_lower == fb_name:
                return 1.0
        
        # Check domain patterns
        for fb_domain in fb_domains:
            if fb_domain in domain_lower:
                return 1.0
        
        return 0.0
    
    def _has_consent_keyword(self, name: str) -> float:
        """Check if name contains consent-related keywords."""
        name_lower = name.lower()
        consent_keywords = ['consent', 'gdpr', 'cookie', 'privacy', 'accept', 'banner']
        
        for keyword in consent_keywords:
            if keyword in name_lower:
                return 1.0
        
        return 0.0
    
    def _has_session_keyword(self, name: str) -> float:
        """Check if name contains session-related keywords."""
        name_lower = name.lower()
        session_keywords = ['session', 'sess', 'sid', 'jsession', 'phpsess', 'aspsession']
        
        for keyword in session_keywords:
            if keyword in name_lower:
                return 1.0
        
        return 0.0
    
    def _is_subdomain(self, domain: str) -> float:
        """Check if domain is a subdomain (has more than 2 parts)."""
        domain = domain.lstrip('.')
        parts = domain.split('.')
        return float(len(parts) > 2)
