"""
Feature Extraction Module

Extracts 25+ features from cookie metadata for ML classification.
"""

import re
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse
import numpy as np
from datetime import datetime

from .config import MIN_FEATURES_COUNT


class FeatureExtractor:
    """Extracts features from cookie metadata for ML classification."""
    
    def __init__(self, vendor_db_manager=None):
        """
        Initialize feature extractor.
        
        Args:
            vendor_db_manager: Optional database manager for vendor lookups
        """
        self.vendor_db_manager = vendor_db_manager
        self._feature_names = self._initialize_feature_names()
    
    def _initialize_feature_names(self) -> List[str]:
        """Initialize ordered list of feature names."""
        return [
            # Name features (5)
            'name_length',
            'name_has_underscore',
            'name_has_uuid',
            'name_has_digits',
            'name_special_char_count',
            
            # Domain features (5)
            'domain_is_first_party',
            'domain_is_subdomain',
            'domain_length',
            'domain_has_hyphen',
            'domain_level_count',
            
            # Expiry features (3)
            'expiry_days',
            'expiry_is_session',
            'expiry_category_encoded',  # 0=session, 1=short, 2=medium, 3=long
            
            # Security features (3)
            'http_only',
            'secure',
            'same_site_encoded',  # 0=None, 1=Lax, 2=Strict
            
            # Path features (2)
            'path_is_root',
            'path_length',
            
            # Value features (3)
            'value_length',
            'value_has_uuid',
            'value_has_base64',
            
            # Vendor features (3)
            'vendor_detected',
            'vendor_confidence',
            'vendor_category_encoded',  # 0=Unknown, 1=Analytics, 2=Marketing, 3=Functional, 4=Necessary
            
            # Script context features (2)
            'script_is_third_party',
            'script_domain_length',
            
            # Pattern matching features (5)
            'pattern_google_analytics',
            'pattern_facebook',
            'pattern_advertising',
            'pattern_tracking',
            'pattern_functional',
            
            # Historical features (2)
            'has_historical_data',
            'historical_correction_count'
        ]
    
    def get_feature_names(self) -> List[str]:
        """Return ordered list of feature names."""
        return self._feature_names.copy()
    
    def extract_features(self, cookie: Dict[str, Any]) -> np.ndarray:
        """
        Extract feature vector from cookie metadata.
        
        Args:
            cookie: Dictionary with cookie metadata
                Required keys: name, domain
                Optional keys: path, expiry_days, http_only, secure, same_site,
                              value_sample, initiated_by, scan_id
        
        Returns:
            numpy array of shape (37,) with extracted features
        
        Raises:
            ValueError: If required fields are missing
        """
        # Validate required fields
        if 'name' not in cookie or 'domain' not in cookie:
            raise ValueError("Cookie must have 'name' and 'domain' fields")
        
        # Extract with defaults for missing values
        name = cookie.get('name', '')
        domain = cookie.get('domain', '')
        path = cookie.get('path', '/')
        expiry_days = cookie.get('expiry_days')
        http_only = cookie.get('http_only', False)
        secure = cookie.get('secure', False)
        same_site = cookie.get('same_site')
        value_sample = cookie.get('value_sample', '')
        initiated_by = cookie.get('initiated_by')
        
        # Extract features
        features = []
        
        # Name features
        features.extend(self._extract_name_features(name))
        
        # Domain features
        features.extend(self._extract_domain_features(domain, cookie.get('site_domain')))
        
        # Expiry features
        features.extend(self._extract_expiry_features(expiry_days))
        
        # Security features
        features.extend(self._extract_security_features(http_only, secure, same_site))
        
        # Path features
        features.extend(self._extract_path_features(path))
        
        # Value features
        features.extend(self._extract_value_features(value_sample, cookie))
        
        # Vendor features
        features.extend(self._extract_vendor_features(name, domain))
        
        # Script context features
        features.extend(self._extract_script_features(initiated_by, domain))
        
        # Pattern matching features
        features.extend(self._extract_pattern_features(name, domain))
        
        # Historical features
        features.extend(self._extract_historical_features(cookie))
        
        # Verify feature count
        if len(features) < MIN_FEATURES_COUNT:
            raise ValueError(f"Expected at least {MIN_FEATURES_COUNT} features, got {len(features)}")
        
        return np.array(features, dtype=np.float32)
    
    def _extract_name_features(self, name: str) -> List[float]:
        """Extract features from cookie name."""
        return [
            float(len(name)),
            float(name.startswith('_')),
            float(self._contains_uuid(name)),
            float(bool(re.search(r'\d', name))),
            float(len(re.findall(r'[^a-zA-Z0-9_]', name)))
        ]
    
    def _extract_domain_features(self, domain: str, site_domain: Optional[str] = None) -> List[float]:
        """Extract features from cookie domain."""
        # Determine if first-party
        is_first_party = 0.0
        if site_domain:
            is_first_party = float(domain.endswith(site_domain) or site_domain.endswith(domain))
        
        # Count domain levels
        domain_parts = domain.strip('.').split('.')
        
        return [
            is_first_party,
            float(len(domain_parts) > 2),  # is subdomain
            float(len(domain)),
            float('-' in domain),
            float(len(domain_parts))
        ]
    
    def _extract_expiry_features(self, expiry_days: Optional[int]) -> List[float]:
        """Extract features from cookie expiry."""
        if expiry_days is None or expiry_days == 0:
            # Session cookie
            return [0.0, 1.0, 0.0]
        
        # Categorize expiry
        if expiry_days < 1:
            expiry_category = 0.0  # session
        elif expiry_days <= 30:
            expiry_category = 1.0  # short (up to 1 month)
        elif expiry_days <= 365:
            expiry_category = 2.0  # medium (up to 1 year)
        else:
            expiry_category = 3.0  # long (over 1 year)
        
        return [
            float(expiry_days),
            0.0,  # not session
            expiry_category
        ]
    
    def _extract_security_features(
        self,
        http_only: bool,
        secure: bool,
        same_site: Optional[str]
    ) -> List[float]:
        """Extract security-related features."""
        # Encode SameSite
        same_site_map = {
            None: 0.0,
            'None': 0.0,
            'Lax': 1.0,
            'Strict': 2.0
        }
        same_site_encoded = same_site_map.get(same_site, 0.0)
        
        return [
            float(http_only),
            float(secure),
            same_site_encoded
        ]
    
    def _extract_path_features(self, path: str) -> List[float]:
        """Extract features from cookie path."""
        return [
            float(path == '/'),
            float(len(path))
        ]
    
    def _extract_value_features(
        self,
        value: Optional[str],
        cookie: Optional[Dict[str, Any]] = None
    ) -> List[float]:
        """Extract features from cookie value.

        Clients derive these three numbers in the browser and send them instead
        of the raw value, so session tokens never reach this service. Falls back
        to deriving them from ``value_sample`` for older clients that still send
        it. The derived path must produce identical values to the fallback path.
        """
        if cookie is not None and cookie.get('value_length') is not None:
            return [
                float(cookie.get('value_length') or 0),
                float(bool(cookie.get('value_is_uuid'))),
                float(bool(cookie.get('value_is_base64')))
            ]

        if value is None:
            value = ''
        return [
            float(len(value)),
            float(self._contains_uuid(value)),
            float(self._is_base64(value))
        ]
    
    def _extract_vendor_features(self, name: str, domain: str) -> List[float]:
        """Extract vendor-related features."""
        # Try to detect vendor
        vendor_detected = 0.0
        vendor_confidence = 0.0
        vendor_category = 0.0  # Unknown
        
        if self.vendor_db_manager:
            try:
                vendors = self.vendor_db_manager.search_vendors(name, domain)
                if vendors:
                    vendor = vendors[0]  # Take highest confidence match
                    vendor_detected = 1.0
                    vendor_confidence = float(vendor.get('confidence_score', 0.0))
                    
                    # Encode vendor category
                    category_map = {
                        'Unknown': 0.0,
                        'Analytics': 1.0,
                        'Marketing': 2.0,
                        'Functional': 3.0,
                        'Strictly Necessary': 4.0
                    }
                    vendor_category = category_map.get(vendor.get('typical_category'), 0.0)
            except Exception:
                pass  # Vendor lookup failed, use defaults
        
        return [vendor_detected, vendor_confidence, vendor_category]
    
    def _extract_script_features(self, initiated_by: Optional[str], cookie_domain: str) -> List[float]:
        """Extract features from initiating script."""
        if not initiated_by:
            return [0.0, 0.0]
        
        try:
            parsed = urlparse(initiated_by)
            script_domain = parsed.netloc
            
            # Check if third-party
            is_third_party = float(not cookie_domain.endswith(script_domain) and 
                                  not script_domain.endswith(cookie_domain))
            
            return [is_third_party, float(len(script_domain))]
        except Exception:
            return [0.0, 0.0]
    
    def _extract_pattern_features(self, name: str, domain: str) -> List[float]:
        """Extract pattern matching features."""
        name_lower = name.lower()
        domain_lower = domain.lower()
        
        # Google Analytics patterns
        ga_pattern = float(
            name_lower.startswith('_ga') or
            name_lower.startswith('_gid') or
            name_lower.startswith('_gat') or
            'google-analytics' in domain_lower or
            'googletagmanager' in domain_lower
        )
        
        # Facebook patterns
        fb_pattern = float(
            name_lower.startswith('_fb') or
            name_lower in ['fr', 'sb', 'datr'] or
            'facebook' in domain_lower
        )
        
        # Advertising patterns
        ad_pattern = float(
            'ad' in name_lower or
            'advert' in name_lower or
            'doubleclick' in domain_lower or
            'adsense' in domain_lower
        )
        
        # Tracking patterns
        track_pattern = float(
            'track' in name_lower or
            'analytics' in name_lower or
            'pixel' in name_lower or
            'beacon' in name_lower
        )
        
        # Functional patterns
        func_pattern = float(
            'session' in name_lower or
            'auth' in name_lower or
            'login' in name_lower or
            'csrf' in name_lower or
            'xsrf' in name_lower
        )
        
        return [ga_pattern, fb_pattern, ad_pattern, track_pattern, func_pattern]
    
    def _extract_historical_features(self, cookie: Dict[str, Any]) -> List[float]:
        """Extract historical features if available."""
        has_history = float('historical_category' in cookie)
        correction_count = float(cookie.get('correction_count', 0))
        
        return [has_history, correction_count]
    
    # Helper methods
    
    def _contains_uuid(self, text: str) -> bool:
        """Check if text contains UUID pattern."""
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        return bool(re.search(uuid_pattern, text.lower()))
    
    def _is_base64(self, text: str) -> bool:
        """Check if text looks like base64 encoding."""
        if len(text) < 4:
            return False
        # Base64 uses A-Z, a-z, 0-9, +, /, and = for padding
        base64_pattern = r'^[A-Za-z0-9+/]+=*$'
        return bool(re.match(base64_pattern, text)) and len(text) % 4 == 0
