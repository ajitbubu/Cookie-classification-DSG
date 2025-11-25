"""
Quick test for SimilarityDetector functionality
"""

from backend.api.ml_classifier.similarity import SimilarityDetector

# Test basic functionality
detector = SimilarityDetector()

# Test identical cookies
cookie_a = {
    'id': '1',
    'name': '_ga',
    'domain': 'example.com',
    'vendor': 'Google LLC',
    'expiry_days': 730,
    'http_only': False,
    'secure': True
}

cookie_b = {
    'id': '2',
    'name': '_ga',
    'domain': 'example.com',
    'vendor': 'Google LLC',
    'expiry_days': 730,
    'http_only': False,
    'secure': True
}

score = detector.calculate_similarity(cookie_a, cookie_b)
print(f'Identical cookies similarity: {score:.2f}')
assert score >= 0.95, f"Expected high similarity for identical cookies, got {score}"

# Test different cookies
cookie_c = {
    'id': '3',
    'name': '_fbp',
    'domain': 'facebook.com',
    'vendor': 'Facebook',
    'expiry_days': 90,
    'http_only': True,
    'secure': True
}

score2 = detector.calculate_similarity(cookie_a, cookie_c)
print(f'Different cookies similarity: {score2:.2f}')
assert score2 < 0.5, f"Expected low similarity for different cookies, got {score2}"

# Test find_similar
candidates = [cookie_b, cookie_c]
similar = detector.find_similar(cookie_a, candidates, threshold=0.75)
print(f'Found {len(similar)} similar cookies')
for s in similar:
    print(f'  - {s.cookie_name} (score: {s.similarity_score:.2f})')

assert len(similar) == 1, f"Expected 1 similar cookie, got {len(similar)}"
assert similar[0].cookie_name == '_ga', f"Expected _ga, got {similar[0].cookie_name}"

# Test similarity score range
cookie_d = {
    'id': '4',
    'name': 'test_cookie',
    'domain': 'test.com',
    'vendor': 'Test Vendor',
    'expiry_days': 365
}

score3 = detector.calculate_similarity(cookie_a, cookie_d)
print(f'Random cookies similarity: {score3:.2f}')
assert 0.0 <= score3 <= 1.0, f"Similarity score must be between 0 and 1, got {score3}"

print('\n✓ All SimilarityDetector tests passed!')
