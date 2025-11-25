"""
Similarity Detection Module

Identifies similar cookies for bulk classification operations.
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import Levenshtein
import time
import logging

from .config import (
    SIMILARITY_THRESHOLD,
    SIMILARITY_NAME_WEIGHT,
    SIMILARITY_VENDOR_WEIGHT,
    SIMILARITY_DOMAIN_WEIGHT,
    SIMILARITY_PURPOSE_WEIGHT
)
from .db_service import get_db_service

logger = logging.getLogger(__name__)


@dataclass
class SimilarCookie:
    """Similar cookie with similarity score."""
    cookie_id: str
    cookie_name: str
    cookie_domain: str
    similarity_score: float
    category: str = None


class SimilarityDetector:
    """Detects similar cookies for bulk operations."""
    
    def __init__(self, threshold: float = SIMILARITY_THRESHOLD):
        """
        Initialize similarity detector.
        
        Args:
            threshold: Minimum similarity score (0.0-1.0)
        """
        self.threshold = threshold
    
    def calculate_similarity(
        self,
        cookie_a: Dict[str, Any],
        cookie_b: Dict[str, Any]
    ) -> float:
        """
        Calculate similarity score between two cookies.
        
        Weights:
        - Name similarity (Levenshtein): 40%
        - Vendor match: 30%
        - Domain pattern: 15%
        - Purpose signals: 15%
        
        Args:
            cookie_a: First cookie
            cookie_b: Second cookie
        
        Returns:
            Similarity score between 0.0 and 1.0
        """
        score = 0.0
        
        # Name similarity (40%)
        name_a = cookie_a.get('name', '').lower()
        name_b = cookie_b.get('name', '').lower()
        
        if name_a and name_b:
            name_sim = Levenshtein.ratio(name_a, name_b)
            score += name_sim * SIMILARITY_NAME_WEIGHT
        
        # Vendor match (30%)
        vendor_a = cookie_a.get('vendor', '').lower()
        vendor_b = cookie_b.get('vendor', '').lower()
        
        if vendor_a and vendor_b and vendor_a != 'unknown' and vendor_b != 'unknown':
            if vendor_a == vendor_b:
                score += SIMILARITY_VENDOR_WEIGHT
        
        # Domain pattern (15%)
        domain_a = cookie_a.get('domain', '').lower()
        domain_b = cookie_b.get('domain', '').lower()
        
        if self._same_domain_pattern(domain_a, domain_b):
            score += SIMILARITY_DOMAIN_WEIGHT
        
        # Purpose signals (15%)
        if self._similar_purpose_signals(cookie_a, cookie_b):
            score += SIMILARITY_PURPOSE_WEIGHT
        
        return min(score, 1.0)  # Cap at 1.0
    
    def find_similar(
        self,
        reference_cookie: Dict[str, Any],
        candidate_cookies: List[Dict[str, Any]],
        threshold: float = None
    ) -> List[SimilarCookie]:
        """
        Find similar cookies from candidates.
        
        Args:
            reference_cookie: Cookie to compare against
            candidate_cookies: List of candidate cookies
            threshold: Minimum similarity (uses default if None)
        
        Returns:
            List of SimilarCookie objects above threshold
        """
        if threshold is None:
            threshold = self.threshold
        
        similar = []
        
        for candidate in candidate_cookies:
            # Skip self-comparison
            if candidate.get('id') == reference_cookie.get('id'):
                continue
            
            # Calculate similarity
            score = self.calculate_similarity(reference_cookie, candidate)
            
            # Add if above threshold
            if score >= threshold:
                similar.append(SimilarCookie(
                    cookie_id=candidate.get('id', 'unknown'),
                    cookie_name=candidate.get('name', ''),
                    cookie_domain=candidate.get('domain', ''),
                    similarity_score=score,
                    category=candidate.get('category')
                ))
        
        # Sort by similarity (descending)
        similar.sort(key=lambda x: x.similarity_score, reverse=True)
        
        return similar
    
    def _same_domain_pattern(self, domain_a: str, domain_b: str) -> bool:
        """
        Check if domains follow same pattern.
        
        Args:
            domain_a: First domain
            domain_b: Second domain
        
        Returns:
            True if domains match pattern
        """
        if not domain_a or not domain_b:
            return False
        
        # Exact match
        if domain_a == domain_b:
            return True
        
        # Check if one is subdomain of other
        if domain_a.endswith(domain_b) or domain_b.endswith(domain_a):
            return True
        
        # Check if same base domain
        parts_a = domain_a.split('.')
        parts_b = domain_b.split('.')
        
        if len(parts_a) >= 2 and len(parts_b) >= 2:
            # Compare last 2 parts (e.g., example.com)
            base_a = '.'.join(parts_a[-2:])
            base_b = '.'.join(parts_b[-2:])
            return base_a == base_b
        
        return False
    
    def _similar_purpose_signals(
        self,
        cookie_a: Dict[str, Any],
        cookie_b: Dict[str, Any]
    ) -> bool:
        """
        Check if cookies have similar purpose signals.
        
        Args:
            cookie_a: First cookie
            cookie_b: Second cookie
        
        Returns:
            True if similar purpose signals
        """
        # Check expiry similarity
        expiry_a = cookie_a.get('expiry_days')
        expiry_b = cookie_b.get('expiry_days')
        
        # Both session cookies
        if expiry_a is None and expiry_b is None:
            return True
        
        # Both persistent with similar expiry
        if expiry_a is not None and expiry_b is not None:
            # Within 20% of each other
            if expiry_a > 0 and expiry_b > 0:
                ratio = min(expiry_a, expiry_b) / max(expiry_a, expiry_b)
                if ratio > 0.8:
                    return True
        
        # Check security flags similarity
        http_only_a = cookie_a.get('http_only', False)
        http_only_b = cookie_b.get('http_only', False)
        
        secure_a = cookie_a.get('secure', False)
        secure_b = cookie_b.get('secure', False)
        
        # Similar security profile
        if http_only_a == http_only_b and secure_a == secure_b:
            return True
        
        return False
    
    def group_similar_cookies(
        self,
        cookies: List[Dict[str, Any]],
        threshold: float = None
    ) -> List[List[Dict[str, Any]]]:
        """
        Group cookies into clusters of similar cookies.
        
        Args:
            cookies: List of cookies
            threshold: Minimum similarity
        
        Returns:
            List of cookie groups
        """
        if threshold is None:
            threshold = self.threshold
        
        groups = []
        processed = set()
        
        for i, cookie in enumerate(cookies):
            cookie_id = cookie.get('id', i)
            
            if cookie_id in processed:
                continue
            
            # Find similar cookies
            similar = self.find_similar(cookie, cookies, threshold)
            
            if similar:
                # Create group
                group = [cookie]
                for sim in similar:
                    # Find original cookie
                    for c in cookies:
                        if c.get('id') == sim.cookie_id:
                            group.append(c)
                            processed.add(sim.cookie_id)
                            break
                
                groups.append(group)
                processed.add(cookie_id)
            else:
                # Singleton group
                groups.append([cookie])
                processed.add(cookie_id)
        
        return groups
    
    def find_similar_in_database(
        self,
        cookie_id: str,
        threshold: float = None,
        max_results: int = 100
    ) -> List[SimilarCookie]:
        """
        Find similar cookies in database by cookie ID.
        
        This method:
        1. Retrieves the reference cookie from database
        2. Gets candidate cookies using smart filtering
        3. Calculates similarity for each candidate
        4. Filters by threshold
        5. Returns sorted results
        
        Args:
            cookie_id: ID of reference cookie
            threshold: Minimum similarity score (uses default if None)
            max_results: Maximum number of results to return
        
        Returns:
            List of SimilarCookie objects sorted by similarity (descending)
        
        Raises:
            ValueError: If cookie_id not found in database
        """
        start_time = time.time()
        
        if threshold is None:
            threshold = self.threshold
        
        # Get database service
        db = get_db_service()
        
        # Get reference cookie
        reference_cookie = db.get_cookie_by_id(cookie_id)
        if not reference_cookie:
            raise ValueError(f"Cookie with ID {cookie_id} not found")
        
        logger.info(f"Finding similar cookies for: {reference_cookie.get('name')} "
                   f"(domain: {reference_cookie.get('domain')})")
        
        # Get candidate cookies using smart filtering
        candidates = db.get_candidate_cookies(
            reference_cookie,
            max_candidates=1000  # Pre-filter to reduce search space
        )
        
        logger.info(f"Found {len(candidates)} candidate cookies")
        
        # Calculate similarity for each candidate
        similar = []
        for candidate in candidates:
            # Skip self
            if candidate.get('id') == cookie_id:
                continue
            
            # Calculate similarity
            score = self.calculate_similarity(reference_cookie, candidate)
            
            # Add if above threshold
            if score >= threshold:
                similar.append(SimilarCookie(
                    cookie_id=candidate.get('id', 'unknown'),
                    cookie_name=candidate.get('name', ''),
                    cookie_domain=candidate.get('domain', ''),
                    similarity_score=score,
                    category=candidate.get('category')
                ))
        
        # Sort by similarity (descending)
        similar.sort(key=lambda x: x.similarity_score, reverse=True)
        
        # Limit results
        similar = similar[:max_results]
        
        elapsed = time.time() - start_time
        logger.info(f"Found {len(similar)} similar cookies in {elapsed:.3f}s")
        
        return similar
    
    def find_similar_by_cookie(
        self,
        cookie: Dict[str, Any],
        threshold: float = None,
        max_results: int = 100,
        scan_id: Optional[str] = None
    ) -> List[SimilarCookie]:
        """
        Find similar cookies in database by cookie object.
        
        Useful when the cookie hasn't been stored yet.
        
        Args:
            cookie: Cookie dictionary
            threshold: Minimum similarity score (uses default if None)
            max_results: Maximum number of results to return
            scan_id: Optional scan ID to limit search scope
        
        Returns:
            List of SimilarCookie objects sorted by similarity (descending)
        """
        start_time = time.time()
        
        if threshold is None:
            threshold = self.threshold
        
        # Get database service
        db = get_db_service()
        
        logger.info(f"Finding similar cookies for: {cookie.get('name')} "
                   f"(domain: {cookie.get('domain')})")
        
        # Get candidate cookies
        if scan_id:
            candidates = db.get_all_cookies(scan_id=scan_id, limit=1000)
        else:
            candidates = db.get_candidate_cookies(cookie, max_candidates=1000)
        
        logger.info(f"Found {len(candidates)} candidate cookies")
        
        # Calculate similarity for each candidate
        similar = []
        for candidate in candidates:
            # Skip self if IDs match
            if cookie.get('id') and candidate.get('id') == cookie.get('id'):
                continue
            
            # Calculate similarity
            score = self.calculate_similarity(cookie, candidate)
            
            # Add if above threshold
            if score >= threshold:
                similar.append(SimilarCookie(
                    cookie_id=candidate.get('id', 'unknown'),
                    cookie_name=candidate.get('name', ''),
                    cookie_domain=candidate.get('domain', ''),
                    similarity_score=score,
                    category=candidate.get('category')
                ))
        
        # Sort by similarity (descending)
        similar.sort(key=lambda x: x.similarity_score, reverse=True)
        
        # Limit results
        similar = similar[:max_results]
        
        elapsed = time.time() - start_time
        logger.info(f"Found {len(similar)} similar cookies in {elapsed:.3f}s")
        
        return similar
