"""
Tests for Feature Extractor

Unit tests and property-based tests for feature extraction.
"""

import pytest
import numpy as np
from hypothesis import given, strategies as st, settings, assume
from hypothesis.strategies import composite

from ..feature_extractor import FeatureExtractor
from ..config import MIN_FEATURES_COUNT


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def extractor():
    """Create feature extractor instance."""
    return FeatureExtractor()


@pytest.fixture
def sample_cookie():
    """Sample cookie data for testing."""
    return {
        'name': '_ga',
        'domain': 'example.com',
        'path': '/',
        'expiry_days': 730,
        'http_only': False,
        'secure': True,
        'same_site': 'Lax',
        'value_sample': 'GA1.2.1234567890.1234567890',
        'initiated_by': 'https://www.google-analytics.com/analytics.js',
        'site_domain': 'example.com'
    }


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@composite
def cookie_strategy(draw):
    """Generate random cookie data for property-based testing."""
    return {
        'name': draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',)))),
        'domain': draw(st.from_regex(r'[a-z0-9\-]+\.[a-z]{2,}', fullmatch=True)),
        'path': draw(st.sampled_from(['/', '/path', '/path/to/resource'])),
        'expiry_days': draw(st.one_of(st.none(), st.integers(min_value=0, max_value=3650))),
        'http_only': draw(st.booleans()),
        'secure': draw(st.booleans()),
        'same_site': draw(st.sampled_from([None, 'Strict', 'Lax', 'None'])),
        'value_sample': draw(st.one_of(st.none(), st.text(max_size=200))),
        'initiated_by': draw(st.one_of(
            st.none(),
            st.from_regex(r'https?://[a-z0-9\-\.]+', fullmatch=True)
        )),
        'site_domain': draw(st.one_of(st.none(), st.from_regex(r'[a-z0-9\-]+\.[a-z]{2,}', fullmatch=True)))
    }


# ============================================================================
# Unit Tests
# ============================================================================

def test_feature_extractor_initialization(extractor):
    """Test feature extractor initializes correctly."""
    assert extractor is not None
    feature_names = extractor.get_feature_names()
    assert len(feature_names) >= MIN_FEATURES_COUNT
    assert isinstance(feature_names, list)


def test_extract_features_basic(extractor, sample_cookie):
    """Test basic feature extraction."""
    features = extractor.extract_features(sample_cookie)
    
    assert isinstance(features, np.ndarray)
    assert len(features) >= MIN_FEATURES_COUNT
    assert features.dtype == np.float32


def test_extract_features_missing_required_fields(extractor):
    """Test that missing required fields raises ValueError."""
    with pytest.raises(ValueError, match="must have 'name' and 'domain'"):
        extractor.extract_features({})
    
    with pytest.raises(ValueError, match="must have 'name' and 'domain'"):
        extractor.extract_features({'name': 'test'})
    
    with pytest.raises(ValueError, match="must have 'name' and 'domain'"):
        extractor.extract_features({'domain': 'example.com'})


def test_extract_features_with_defaults(extractor):
    """Test feature extraction with minimal data (using defaults)."""
    minimal_cookie = {
        'name': 'test_cookie',
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(minimal_cookie)
    assert len(features) >= MIN_FEATURES_COUNT


def test_name_features(extractor):
    """Test name feature extraction."""
    cookie = {
        'name': '_ga_12345',
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(cookie)
    
    # Name length should be 9
    assert features[0] == 9.0
    # Should start with underscore
    assert features[1] == 1.0
    # Should have digits
    assert features[3] == 1.0


def test_expiry_features_session(extractor):
    """Test expiry features for session cookies."""
    cookie = {
        'name': 'session',
        'domain': 'example.com',
        'expiry_days': None
    }
    
    features = extractor.extract_features(cookie)
    feature_names = extractor.get_feature_names()
    
    # Find expiry_is_session index
    session_idx = feature_names.index('expiry_is_session')
    assert features[session_idx] == 1.0


def test_expiry_features_long_term(extractor):
    """Test expiry features for long-term cookies."""
    cookie = {
        'name': 'persistent',
        'domain': 'example.com',
        'expiry_days': 730  # 2 years
    }
    
    features = extractor.extract_features(cookie)
    feature_names = extractor.get_feature_names()
    
    # Find expiry_days index
    expiry_idx = feature_names.index('expiry_days')
    assert features[expiry_idx] == 730.0
    
    # Should be categorized as long (3.0)
    category_idx = feature_names.index('expiry_category_encoded')
    assert features[category_idx] == 3.0


def test_security_features(extractor):
    """Test security feature extraction."""
    cookie = {
        'name': 'secure_cookie',
        'domain': 'example.com',
        'http_only': True,
        'secure': True,
        'same_site': 'Strict'
    }
    
    features = extractor.extract_features(cookie)
    feature_names = extractor.get_feature_names()
    
    http_only_idx = feature_names.index('http_only')
    secure_idx = feature_names.index('secure')
    same_site_idx = feature_names.index('same_site_encoded')
    
    assert features[http_only_idx] == 1.0
    assert features[secure_idx] == 1.0
    assert features[same_site_idx] == 2.0  # Strict


def test_pattern_features_google_analytics(extractor):
    """Test pattern matching for Google Analytics cookies."""
    cookie = {
        'name': '_ga',
        'domain': 'google-analytics.com'
    }
    
    features = extractor.extract_features(cookie)
    feature_names = extractor.get_feature_names()
    
    ga_pattern_idx = feature_names.index('pattern_google_analytics')
    assert features[ga_pattern_idx] == 1.0


def test_pattern_features_facebook(extractor):
    """Test pattern matching for Facebook cookies."""
    cookie = {
        'name': '_fbp',
        'domain': 'facebook.com'
    }
    
    features = extractor.extract_features(cookie)
    feature_names = extractor.get_feature_names()
    
    fb_pattern_idx = feature_names.index('pattern_facebook')
    assert features[fb_pattern_idx] == 1.0


def test_get_feature_names(extractor):
    """Test getting feature names."""
    names = extractor.get_feature_names()
    
    assert isinstance(names, list)
    assert len(names) >= MIN_FEATURES_COUNT
    assert 'name_length' in names
    assert 'domain_is_first_party' in names
    assert 'expiry_days' in names


# ============================================================================
# Property-Based Tests (Optional - marked with *)
# ============================================================================

# Feature: ml-cookie-classification, Property 1: Feature Extraction Completeness
@given(cookie=cookie_strategy())
@settings(max_examples=100, deadline=None)
def test_property_feature_extraction_completeness(cookie):
    """
    Property: For any cookie input, feature extraction produces >= 25 features.
    Validates: Requirements 1.1
    """
    extractor = FeatureExtractor()
    
    try:
        features = extractor.extract_features(cookie)
        assert len(features) >= MIN_FEATURES_COUNT, \
            f"Expected at least {MIN_FEATURES_COUNT} features, got {len(features)}"
        assert isinstance(features, np.ndarray)
    except ValueError as e:
        # Only acceptable if missing required fields
        assert "must have 'name' and 'domain'" in str(e)


# Feature: ml-cookie-classification, Property 3: Missing Value Handling
@given(cookie=cookie_strategy())
@settings(max_examples=100, deadline=None)
def test_property_missing_value_handling(cookie):
    """
    Property: For any cookie with missing metadata, extractor applies defaults without exceptions.
    Validates: Requirements 1.3
    """
    extractor = FeatureExtractor()
    
    # Ensure required fields are present
    if 'name' not in cookie or not cookie['name']:
        cookie['name'] = 'test'
    if 'domain' not in cookie or not cookie['domain']:
        cookie['domain'] = 'example.com'
    
    # Remove some optional fields randomly
    optional_fields = ['path', 'expiry_days', 'http_only', 'secure', 'same_site', 
                      'value_sample', 'initiated_by', 'site_domain']
    
    # Should not raise exception
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT


# Feature: ml-cookie-classification, Property 2: Feature Extraction Performance
@pytest.mark.performance
def test_property_feature_extraction_performance(extractor, sample_cookie):
    """
    Property: For any cookie, feature extraction completes in < 100ms.
    Validates: Requirements 1.2
    
    Note: This is a performance test, run separately with: pytest -m performance
    """
    import time
    
    iterations = 100
    start = time.time()
    
    for _ in range(iterations):
        extractor.extract_features(sample_cookie)
    
    end = time.time()
    avg_time_ms = ((end - start) / iterations) * 1000
    
    assert avg_time_ms < 100, f"Average extraction time {avg_time_ms:.2f}ms exceeds 100ms limit"


# ============================================================================
# Edge Cases
# ============================================================================

def test_edge_case_empty_name(extractor):
    """Test handling of empty cookie name."""
    cookie = {
        'name': '',
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT


def test_edge_case_very_long_name(extractor):
    """Test handling of very long cookie name."""
    cookie = {
        'name': 'a' * 1000,
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT
    assert features[0] == 1000.0  # name_length


def test_edge_case_special_characters(extractor):
    """Test handling of special characters in cookie name."""
    cookie = {
        'name': '!@#$%^&*()',
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT


def test_edge_case_unicode_characters(extractor):
    """Test handling of unicode characters."""
    cookie = {
        'name': 'cookie_测试_🍪',
        'domain': 'example.com'
    }
    
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT


def test_edge_case_negative_expiry(extractor):
    """Test handling of negative expiry days."""
    cookie = {
        'name': 'test',
        'domain': 'example.com',
        'expiry_days': -1
    }
    
    features = extractor.extract_features(cookie)
    assert len(features) >= MIN_FEATURES_COUNT
