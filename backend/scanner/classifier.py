from typing import Dict, List
import re
from concurrent.futures import ThreadPoolExecutor
import asyncio


class CookieClassifier:
    """Classifies cookies by category, type, and purpose"""
    
    # Cookie classification patterns
    CATEGORIES = {
        "Strictly Necessary": [
            "session", "csrf", "xsrf", "auth", "login", "security",
            "consent", "cookie-consent", "gdpr", "essential"
        ],
        "Analytics": [
            "analytics", "_ga", "_gid", "_gat", "utm", "tracking",
            "stats", "metrics", "measure", "visitor"
        ],
        "Marketing": [
            "ad", "ads", "advertising", "doubleclick", "facebook",
            "twitter", "linkedin", "marketing", "campaign", "affiliate"
        ],
        "Functional": [
            "preference", "settings", "language", "locale", "theme",
            "currency", "region", "timezone", "layout"
        ],
        "Social Media": [
            "facebook", "twitter", "linkedin", "instagram", "youtube",
            "social", "share", "like", "tweet", "pin"
        ]
    }
    
    # Third-party domains
    THIRD_PARTY_DOMAINS = [
        "google-analytics.com", "googletagmanager.com", "doubleclick.net",
        "facebook.com", "twitter.com", "linkedin.com", "youtube.com",
        "amazon-adsystem.com", "googlesyndication.com", "adnxs.com"
    ]
    
    @classmethod
    def classify(cls, cookie: Dict, page_domain: str) -> Dict:
        """Classify a single cookie"""
        name = cookie.get("name", "").lower()
        domain = cookie.get("domain", "").lower()
        
        # Determine category
        category = cls._determine_category(name)
        
        # Determine if third-party
        is_third_party = cls._is_third_party(domain, page_domain)
        
        # Determine type
        cookie_type = cls._determine_type(cookie)
        
        # Determine purpose
        purpose = cls._determine_purpose(name, category)
        
        # Determine if consent required
        requires_consent = category not in ["Strictly Necessary"]
        
        # Calculate size
        size = len(cookie.get("value", ""))
        
        return {
            **cookie,
            "category": category,
            "type": cookie_type,
            "purpose": purpose,
            "isThirdParty": is_third_party,
            "requiresConsent": requires_consent,
            "size": size
        }
    
    @classmethod
    def classify_parallel(cls, cookies: List[Dict], page_domain: str, max_workers: int = 10) -> List[Dict]:
        """
        Classify multiple cookies in parallel using ThreadPoolExecutor.

        For CPU-bound cookie classification tasks, this provides true parallelism
        by utilizing multiple CPU cores via threads.

        Args:
            cookies: List of cookie dictionaries to classify
            page_domain: Domain of the page being scanned
            max_workers: Maximum number of worker threads (default: 10)

        Returns:
            List of classified cookies
        """
        if not cookies:
            return []

        # For small batches, use sequential processing (overhead not worth it)
        if len(cookies) < 5:
            return [cls.classify(cookie, page_domain) for cookie in cookies]

        # Use thread pool for larger batches
        def classify_single(cookie: Dict) -> Dict:
            """Helper function for thread pool execution"""
            return cls.classify(cookie, page_domain)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(classify_single, cookies))

        return results

    @classmethod
    async def classify_parallel_async(cls, cookies: List[Dict], page_domain: str, max_workers: int = 10) -> List[Dict]:
        """
        Async wrapper for parallel cookie classification.

        Runs the CPU-bound classification in a thread pool without blocking
        the asyncio event loop.

        Args:
            cookies: List of cookie dictionaries to classify
            page_domain: Domain of the page being scanned
            max_workers: Maximum number of worker threads (default: 10)

        Returns:
            List of classified cookies
        """
        # Use get_running_loop() instead of get_event_loop() for Python 3.10+
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # Fallback for older Python versions or when no loop is running
            loop = asyncio.get_event_loop()

        return await loop.run_in_executor(
            None,
            lambda: cls.classify_parallel(cookies, page_domain, max_workers)
        )

    @classmethod
    def _determine_category(cls, name: str) -> str:
        """Determine cookie category based on name"""
        for category, patterns in cls.CATEGORIES.items():
            for pattern in patterns:
                if pattern in name:
                    return category
        return "Uncategorized"
    
    @classmethod
    def _is_third_party(cls, cookie_domain: str, page_domain: str) -> bool:
        """Check if cookie is from third-party domain"""
        # Remove leading dot from cookie domain
        cookie_domain = cookie_domain.lstrip(".")
        page_domain = page_domain.lstrip(".")
        
        # Check if cookie domain is different from page domain
        if cookie_domain != page_domain and not page_domain.endswith(cookie_domain):
            return True
        
        # Check against known third-party domains
        for third_party in cls.THIRD_PARTY_DOMAINS:
            if third_party in cookie_domain:
                return True
        
        return False
    
    @classmethod
    def _determine_type(cls, cookie: Dict) -> str:
        """Determine cookie type (Session/Persistent)"""
        expires = cookie.get("expires")
        
        if expires is None or expires == -1:
            return "Session"
        return "Persistent"
    
    @classmethod
    def _determine_purpose(cls, name: str, category: str) -> str:
        """Determine cookie purpose based on name and category"""
        purposes = {
            "Strictly Necessary": "Essential for website functionality",
            "Analytics": "Tracks user behavior and site performance",
            "Marketing": "Used for advertising and marketing campaigns",
            "Functional": "Remembers user preferences and settings",
            "Social Media": "Enables social media sharing and integration",
            "Uncategorized": "Purpose not identified"
        }
        
        return purposes.get(category, "Unknown")
    
    @classmethod
    def aggregate_statistics(cls, cookies: List[Dict], use_parallel: bool = True, max_workers: int = 10) -> Dict:
        """
        Calculate aggregate statistics for cookies.

        For large cookie sets, can use ThreadPoolExecutor for parallel aggregation.

        Args:
            cookies: List of classified cookies
            use_parallel: Whether to use parallel processing (default: True for >100 cookies)
            max_workers: Maximum number of worker threads

        Returns:
            Statistics dictionary with counts and breakdowns
        """
        if not cookies:
            return {
                "totalCount": 0,
                "byCategory": {},
                "byType": {},
                "thirdPartyCount": 0,
                "requiresConsentCount": 0
            }

        # For large datasets, use parallel processing
        if use_parallel and len(cookies) > 100:
            return cls._aggregate_statistics_parallel(cookies, max_workers)

        # Sequential processing for smaller datasets
        stats = {
            "totalCount": len(cookies),
            "byCategory": {},
            "byType": {},
            "thirdPartyCount": 0,
            "requiresConsentCount": 0
        }

        for cookie in cookies:
            # Count by category
            category = cookie.get("category", "Uncategorized")
            stats["byCategory"][category] = stats["byCategory"].get(category, 0) + 1

            # Count by type
            cookie_type = cookie.get("type", "Unknown")
            stats["byType"][cookie_type] = stats["byType"].get(cookie_type, 0) + 1

            # Count third-party
            if cookie.get("isThirdParty"):
                stats["thirdPartyCount"] += 1

            # Count requiring consent
            if cookie.get("requiresConsent"):
                stats["requiresConsentCount"] += 1

        return stats

    @classmethod
    def _aggregate_statistics_parallel(cls, cookies: List[Dict], max_workers: int = 10) -> Dict:
        """
        Calculate aggregate statistics using ThreadPoolExecutor for large datasets.

        Divides cookies into chunks and processes them in parallel, then merges results.
        """
        from collections import defaultdict

        def process_chunk(chunk: List[Dict]) -> Dict:
            """Process a chunk of cookies and return partial statistics"""
            chunk_stats = {
                "byCategory": defaultdict(int),
                "byType": defaultdict(int),
                "thirdPartyCount": 0,
                "requiresConsentCount": 0
            }

            for cookie in chunk:
                category = cookie.get("category", "Uncategorized")
                chunk_stats["byCategory"][category] += 1

                cookie_type = cookie.get("type", "Unknown")
                chunk_stats["byType"][cookie_type] += 1

                if cookie.get("isThirdParty"):
                    chunk_stats["thirdPartyCount"] += 1

                if cookie.get("requiresConsent"):
                    chunk_stats["requiresConsentCount"] += 1

            return chunk_stats

        # Divide cookies into chunks for parallel processing
        chunk_size = max(1, len(cookies) // max_workers)
        chunks = [cookies[i:i + chunk_size] for i in range(0, len(cookies), chunk_size)]

        # Process chunks in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            chunk_results = list(executor.map(process_chunk, chunks))

        # Merge results from all chunks
        merged_stats = {
            "totalCount": len(cookies),
            "byCategory": {},
            "byType": {},
            "thirdPartyCount": 0,
            "requiresConsentCount": 0
        }

        for chunk_stat in chunk_results:
            # Merge category counts
            for category, count in chunk_stat["byCategory"].items():
                merged_stats["byCategory"][category] = merged_stats["byCategory"].get(category, 0) + count

            # Merge type counts
            for cookie_type, count in chunk_stat["byType"].items():
                merged_stats["byType"][cookie_type] = merged_stats["byType"].get(cookie_type, 0) + count

            # Sum third-party and consent counts
            merged_stats["thirdPartyCount"] += chunk_stat["thirdPartyCount"]
            merged_stats["requiresConsentCount"] += chunk_stat["requiresConsentCount"]

        return merged_stats
