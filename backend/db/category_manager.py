"""
Category Manager - Handles cookie category updates and persistence
"""
import logging
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fnmatch import fnmatch
import json
import asyncpg

logger = logging.getLogger(__name__)


class QueryCache:
    """
    Simple in-memory cache for query results with TTL.
    
    Requirements: 9.3
    """
    
    def __init__(self, ttl_seconds: int = 300):
        """
        Initialize cache.
        
        Args:
            ttl_seconds: Time-to-live for cache entries (default: 5 minutes)
        """
        self.cache: Dict[str, tuple[Any, datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache if not expired.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        if key not in self.cache:
            return None
        
        value, timestamp = self.cache[key]
        
        # Check if expired
        if datetime.now() - timestamp > self.ttl:
            del self.cache[key]
            return None
        
        return value
    
    def set(self, key: str, value: Any):
        """
        Set value in cache with current timestamp.
        
        Args:
            key: Cache key
            value: Value to cache
        """
        self.cache[key] = (value, datetime.now())
    
    def invalidate(self, key: str):
        """
        Invalidate a specific cache entry.
        
        Args:
            key: Cache key to invalidate
        """
        if key in self.cache:
            del self.cache[key]
    
    def clear(self):
        """Clear all cache entries"""
        self.cache.clear()
    
    def size(self) -> int:
        """Get number of cached entries"""
        return len(self.cache)


class CategoryManager:
    """
    Manages cookie category updates and persists them to storage.
    Supports both in-memory (localStorage) and database persistence.
    Includes query result caching for performance optimization.
    """
    
    def __init__(
        self,
        db_pool: Optional[asyncpg.Pool] = None,
        cache_ttl: int = 300
    ):
        """
        Initialize CategoryManager with optional database connection pool.
        
        Args:
            db_pool: Optional asyncpg connection pool for database persistence
            cache_ttl: Cache time-to-live in seconds (default: 5 minutes)
        """
        self.category_overrides = {}  # In-memory cache
        self.db_pool = db_pool  # Database connection pool
        self.db_connection = None  # Legacy field for compatibility
        self.patterns_cache = []  # Cache for cookie patterns
        self.patterns_loaded = False  # Flag to track if patterns are loaded
        self.query_cache = QueryCache(ttl_seconds=cache_ttl)  # Query result cache
    
    async def update_category(
        self,
        scan_id: str,
        cookie_name: str,
        cookie_domain: str,
        old_category: str,
        new_category: str,
        ml_confidence: Optional[float] = None,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Update cookie category and persist the change.
        
        This method:
        1. Updates in-memory cache
        2. Updates knowledge base (database)
        3. Records ML feedback if categories differ
        4. Falls back to file storage if database unavailable
        
        Args:
            scan_id: Unique scan identifier
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            old_category: Previous category (ML prediction)
            new_category: New category (user override)
            ml_confidence: Optional ML confidence score
            user_id: Optional user identifier

        Returns:
            dict: Persistence outcome, so callers can tell a durable write from a
                file-only fallback. Previously this returned a bare ``True`` even
                when the database write failed, which made the API report success
                for changes that never reached Postgres.

                ``ok``                the override was recorded somewhere
                ``persisted``         the knowledge base (database) write succeeded
                ``feedback_recorded`` ML feedback row was written
                ``file_fallback``     the change lives only in local file storage
                ``error``             exception text when ``ok`` is False
        """
        try:
            # Create override key
            override_key = f"{cookie_name}|{cookie_domain}"
            
            # Store in memory cache
            if scan_id not in self.category_overrides:
                self.category_overrides[scan_id] = {}
            
            self.category_overrides[scan_id][override_key] = {
                "cookie_name": cookie_name,
                "cookie_domain": cookie_domain,
                "old_category": old_category,
                "new_category": new_category,
                "updated_at": datetime.now().isoformat(),
                "user_id": user_id,
                "ml_confidence": ml_confidence
            }
            
            # Try to persist to database
            db_success = False
            feedback_success = False
            
            if self.db_pool:
                try:
                    # Update knowledge base
                    db_success = await self._update_knowledge_base(
                        cookie_name=cookie_name,
                        cookie_domain=cookie_domain,
                        category=new_category,
                        source="user_override"
                    )
                    
                    # Record ML feedback if categories differ
                    if old_category != new_category:
                        feedback_success = await self._record_ml_feedback(
                            cookie_name=cookie_name,
                            cookie_domain=cookie_domain,
                            scan_id=scan_id,
                            predicted_category=old_category,
                            corrected_category=new_category,
                            ml_confidence=ml_confidence,
                            user_id=user_id
                        )
                    else:
                        feedback_success = True  # No feedback needed
                        
                except Exception as e:
                    logger.error(f"Database operations failed: {e}")
                    db_success = False
                    feedback_success = False
            
            # Fallback to file storage if database unavailable or failed
            file_fallback = False
            if not db_success:
                logger.warning("Database unavailable, using file storage fallback")
                await self._persist_to_file(
                    scan_id, cookie_name, cookie_domain,
                    old_category, new_category, user_id
                )
                file_fallback = True

            logger.info(
                f"Category updated: {cookie_name} @ {cookie_domain} "
                f"from '{old_category}' to '{new_category}' "
                f"(db={db_success}, feedback={feedback_success})"
            )

            return {
                "ok": True,
                "persisted": db_success,
                "feedback_recorded": feedback_success and old_category != new_category,
                "file_fallback": file_fallback,
                "error": None,
            }

        except Exception as e:
            logger.error(f"Error updating category: {e}")
            return {
                "ok": False,
                "persisted": False,
                "feedback_recorded": False,
                "file_fallback": False,
                "error": str(e),
            }
    
    async def _update_knowledge_base(
        self,
        cookie_name: str,
        cookie_domain: str,
        category: str,
        source: str = "user_override"
    ) -> bool:
        """
        Update or insert cookie in knowledge base.
        
        Uses upsert logic to handle conflicts on (cookie_name, cookie_domain).
        Updates times_seen, times_corrected, last_seen, and updated_at.
        Invalidates cache for the updated cookie.
        
        Args:
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            category: Category to store
            source: Source of the categorization (default: "user_override")
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.db_pool:
            logger.warning("Database pool not available, skipping knowledge base update")
            return False
        
        try:
            async with self.db_pool.acquire() as conn:
                # Use upsert query with ON CONFLICT
                await conn.execute("""
                    INSERT INTO cookie_knowledge_base (
                        cookie_name,
                        cookie_domain,
                        category,
                        source,
                        confidence_score,
                        times_seen,
                        last_seen,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, 1.0, 1, NOW(), NOW(), NOW())
                    ON CONFLICT (cookie_name, cookie_domain)
                    DO UPDATE SET
                        category = EXCLUDED.category,
                        times_seen = cookie_knowledge_base.times_seen + 1,
                        times_corrected = CASE
                            WHEN cookie_knowledge_base.category != EXCLUDED.category
                            THEN cookie_knowledge_base.times_corrected + 1
                            ELSE cookie_knowledge_base.times_corrected
                        END,
                        last_seen = NOW(),
                        updated_at = NOW(),
                        source = EXCLUDED.source,
                        confidence_score = 1.0
                """, cookie_name, cookie_domain, category, source)
                
                # Invalidate cache for this cookie
                cache_key = f"kb:{cookie_name}|{cookie_domain}"
                self.query_cache.invalidate(cache_key)
                
                logger.info(
                    f"Knowledge base updated: {cookie_name} @ {cookie_domain} "
                    f"-> {category} (source: {source})"
                )
                return True
                
        except Exception as e:
            logger.error(f"Failed to update knowledge base: {e}")
            return False
    
    async def _record_ml_feedback(
        self,
        cookie_name: str,
        cookie_domain: str,
        scan_id: str,
        predicted_category: str,
        corrected_category: str,
        ml_confidence: Optional[float] = None,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Record ML feedback when user corrects a prediction.
        
        Only records feedback when predicted_category != corrected_category.
        This data is used for model retraining and improvement.
        
        Args:
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            scan_id: Unique scan identifier
            predicted_category: Category predicted by ML model
            corrected_category: Category corrected by user
            ml_confidence: Confidence score from ML prediction
            user_id: Optional user identifier
            
        Returns:
            bool: True if successful, False otherwise
        """
        # Only record feedback if categories differ
        if predicted_category == corrected_category:
            logger.debug(
                f"Skipping feedback for {cookie_name}: "
                f"prediction matches correction ({predicted_category})"
            )
            return True
        
        if not self.db_pool:
            logger.warning("Database pool not available, skipping feedback recording")
            return False
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO ml_feedback (
                        cookie_name,
                        cookie_domain,
                        scan_id,
                        predicted_category,
                        corrected_category,
                        ml_confidence,
                        user_id,
                        feedback_type,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'correction', NOW())
                """, cookie_name, cookie_domain, scan_id, predicted_category,
                    corrected_category, ml_confidence, user_id)
                
                logger.info(
                    f"ML feedback recorded: {cookie_name} @ {cookie_domain} "
                    f"predicted={predicted_category} -> corrected={corrected_category}"
                )
                return True
                
        except Exception as e:
            logger.error(f"Failed to record ML feedback: {e}")
            return False
    
    async def query_knowledge_base(
        self,
        cookie_name: str,
        cookie_domain: str
    ) -> Optional[Dict[str, Any]]:
        """
        Query the knowledge base for a cookie's stored category.
        
        Searches for exact match on both cookie_name and cookie_domain.
        Returns the most recently updated record.
        Uses caching to improve performance for frequently accessed cookies.
        
        Args:
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            
        Returns:
            Dict with category info if found, None otherwise:
            {
                "category": str,
                "confidence": float,
                "source": str,
                "times_seen": int,
                "last_seen": datetime,
                "metadata": Dict
            }
        """
        # Check cache first
        cache_key = f"kb:{cookie_name}|{cookie_domain}"
        cached_result = self.query_cache.get(cache_key)
        
        if cached_result is not None:
            logger.debug(
                f"Cache hit: {cookie_name} @ {cookie_domain} "
                f"-> {cached_result['category']}"
            )
            return cached_result
        
        if not self.db_pool:
            logger.debug("Database pool not available for query")
            return None
        
        try:
            async with self.db_pool.acquire() as conn:
                record = await conn.fetchrow("""
                    SELECT 
                        category,
                        confidence_score,
                        source,
                        times_seen,
                        times_corrected,
                        last_seen,
                        updated_at
                    FROM cookie_knowledge_base
                    WHERE cookie_name = $1 
                      AND cookie_domain = $2
                    ORDER BY updated_at DESC
                    LIMIT 1
                """, cookie_name, cookie_domain)
                
                if not record:
                    logger.debug(
                        f"No knowledge base entry for {cookie_name} @ {cookie_domain}"
                    )
                    # Cache negative result to avoid repeated queries
                    self.query_cache.set(cache_key, None)
                    return None
                
                result = {
                    "category": record['category'],
                    "confidence": float(record['confidence_score']),
                    "source": record['source'],
                    "times_seen": record['times_seen'],
                    "last_seen": record['last_seen'],
                    "metadata": {
                        "times_corrected": record['times_corrected'],
                        "updated_at": record['updated_at']
                    }
                }
                
                # Cache the result
                self.query_cache.set(cache_key, result)
                
                logger.debug(
                    f"Knowledge base hit: {cookie_name} @ {cookie_domain} "
                    f"-> {result['category']} (source: {result['source']})"
                )
                
                return result
                
        except Exception as e:
            logger.error(f"Error querying knowledge base: {e}")
            return None
    
    async def get_category_with_fallback(
        self,
        cookie_name: str,
        cookie_domain: str,
        ml_prediction: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Get category with fallback chain:
        1. Knowledge base (user overrides and pattern matches)
        2. Pattern matching (if not in knowledge base)
        3. ML prediction (if provided)
        4. Explicit Unclassified result
        
        Args:
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            ml_prediction: Optional ML prediction dict with category and confidence
            
        Returns:
            Dict with category information:
            {
                "category": str,
                "confidence": float,
                "source": str,  # "knowledge_base", "pattern_match", "ml_prediction", "default"
                "metadata": Dict
            }
        """
        # Step 1: Check knowledge base
        kb_result = await self.query_knowledge_base(cookie_name, cookie_domain)
        if kb_result:
            # Prioritize user_override and pattern_match sources
            if kb_result['source'] in ['user_override', 'pattern_match']:
                logger.info(
                    f"Using knowledge base: {cookie_name} -> {kb_result['category']} "
                    f"(source: {kb_result['source']})"
                )
                return kb_result
        
        # Step 2: Check pattern matching (will be implemented in Task 6)
        # pattern_result = await self.check_pattern_match(cookie_name)
        # if pattern_result:
        #     return pattern_result
        
        # Step 2: Check pattern matching
        pattern_result = await self.check_pattern_match(cookie_name, cookie_domain)
        if pattern_result:
            # Store pattern match in knowledge base
            await self.store_pattern_match(
                cookie_name=cookie_name,
                cookie_domain=cookie_domain,
                category=pattern_result['category'],
                confidence=pattern_result['confidence'],
                pattern=pattern_result['pattern']
            )
            logger.info(
                f"Using pattern match: {cookie_name} -> {pattern_result['category']} "
                f"(pattern: {pattern_result['pattern']})"
            )
            return pattern_result
        
        # Step 3: Use ML prediction if provided
        if ml_prediction and 'category' in ml_prediction:
            logger.debug(
                f"Using ML prediction: {cookie_name} -> {ml_prediction['category']}"
            )
            return {
                "category": ml_prediction['category'],
                "confidence": ml_prediction.get('confidence', 0.5),
                "source": "ml_prediction",
                "metadata": ml_prediction
            }
        
        # Step 4: Preserve uncertainty when no evidence exists
        logger.warning(
            f"No category found for {cookie_name}, using default"
        )
        return {
            "category": "Unclassified",
            "confidence": 0.0,
            "source": "default",
            "metadata": {}
        }
    
    async def load_patterns(self) -> bool:
        """
        Load cookie patterns from database into memory cache.
        
        Patterns are ordered by priority DESC for efficient matching.
        Only active patterns are loaded.
        
        Returns:
            bool: True if patterns loaded successfully, False otherwise
        """
        if not self.db_pool:
            logger.warning("Database pool not available, cannot load patterns")
            return False
        
        try:
            async with self.db_pool.acquire() as conn:
                patterns = await conn.fetch("""
                    SELECT 
                        pattern,
                        match_type,
                        category,
                        vendor,
                        description,
                        confidence,
                        priority,
                        source,
                        metadata
                    FROM cookie_patterns
                    WHERE is_active = TRUE
                    ORDER BY priority DESC, confidence DESC
                """)
                
                self.patterns_cache = [
                    {
                        "pattern": p['pattern'],
                        "match_type": p.get('match_type') or 'name',
                        "category": p['category'],
                        "vendor": p['vendor'],
                        "description": p['description'],
                        "confidence": float(p['confidence']),
                        "priority": p['priority'],
                        "source": p.get('source'),
                        "metadata": p.get('metadata')
                    }
                    for p in patterns
                ]
                
                self.patterns_loaded = True
                logger.info(f"Loaded {len(self.patterns_cache)} cookie patterns")
                return True
                
        except Exception as e:
            logger.error(f"Error loading patterns: {e}")
            return False
    
    async def check_pattern_match(
        self,
        cookie_name: str,
        cookie_domain: str
    ) -> Optional[Dict[str, Any]]:
        """
        Check if cookie name matches any active patterns.
        
        Returns the first match (highest priority pattern).
        Uses simple string matching (pattern in cookie_name).
        
        Args:
            cookie_name: Name of the cookie to match
            cookie_domain: Domain of the cookie (for context)
            
        Returns:
            Dict with pattern match info if found, None otherwise:
            {
                "category": str,
                "confidence": float,
                "source": "pattern_match",
                "pattern": str,
                "vendor": str,
                "metadata": Dict
            }
        """
        # Load patterns if not already loaded
        if not self.patterns_loaded:
            await self.load_patterns()
        
        if not self.patterns_cache:
            logger.debug("No patterns available for matching")
            return None
        
        # Check each pattern (already sorted by priority)
        for pattern_info in self.patterns_cache:
            pattern = pattern_info['pattern']

            # Simple matching by type
            if self._pattern_matches(pattern_info, cookie_name, cookie_domain):
                logger.debug(
                    f"Pattern match: {cookie_name} matches '{pattern}' "
                    f"-> {pattern_info['category']}"
                )
                
                metadata = {
                    "description": pattern_info['description'],
                    "priority": pattern_info['priority'],
                    "match_type": pattern_info.get('match_type', 'name')
                }
                if pattern_info.get('source'):
                    metadata["pattern_source"] = pattern_info['source']
                if pattern_info.get('metadata'):
                    metadata["pattern_metadata"] = pattern_info['metadata']

                return {
                    "category": pattern_info['category'],
                    "confidence": pattern_info['confidence'],
                    "source": "pattern_match",
                    "pattern": pattern,
                    "vendor": pattern_info['vendor'],
                    "metadata": metadata
                }
        
        logger.debug(f"No pattern match for {cookie_name}")
        return None

    def _pattern_matches(
        self,
        pattern_info: Dict[str, Any],
        cookie_name: str,
        cookie_domain: str
    ) -> bool:
        """Return True if the pattern matches the cookie name or domain."""
        pattern = pattern_info.get('pattern')
        if not pattern:
            return False

        match_type = pattern_info.get('match_type', 'name')
        if match_type == 'domain':
            if not cookie_domain:
                return False
            return self._domain_matches_pattern(pattern, cookie_domain)

        # Generic "session" substring matching can incorrectly exempt tracking
        # cookies such as "marketing_session_tracker" from consent.
        if pattern.lower() == 'session':
            return (cookie_name or '').lower() in {
                'session', 'sessionid', 'session_id', 'sessid'
            }

        # Default: name substring match (backwards compatible)
        return pattern.lower() in (cookie_name or '').lower()

    def _domain_matches_pattern(self, pattern: str, domain: str) -> bool:
        """Match domain with optional glob support."""
        pattern = pattern.lower()
        domain = (domain or '').lower()

        if not domain:
            return False

        # If glob syntax present, use fnmatch
        if any(char in pattern for char in ['*', '?', '[', ']']):
            return fnmatch(domain, pattern)

        # Exact match or subdomain match
        return domain == pattern or domain.endswith(f".{pattern}")
    
    async def store_pattern_match(
        self,
        cookie_name: str,
        cookie_domain: str,
        category: str,
        confidence: float,
        pattern: str
    ) -> bool:
        """
        Store pattern match result in knowledge base.
        
        This allows future queries to retrieve the pattern match
        without re-running pattern matching logic.
        
        Args:
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            category: Category from pattern match
            confidence: Confidence score from pattern
            pattern: The pattern that matched
            
        Returns:
            bool: True if stored successfully, False otherwise
        """
        if not self.db_pool:
            logger.debug("Database pool not available, skipping pattern match storage")
            return False
        
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO cookie_knowledge_base (
                        cookie_name,
                        cookie_domain,
                        category,
                        source,
                        confidence_score,
                        times_seen,
                        last_seen,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, 'pattern_match', $4, 1, NOW(), NOW(), NOW())
                    ON CONFLICT (cookie_name, cookie_domain)
                    DO UPDATE SET
                        times_seen = cookie_knowledge_base.times_seen + 1,
                        last_seen = NOW()
                    WHERE cookie_knowledge_base.source = 'pattern_match'
                """, cookie_name, cookie_domain, category, confidence)
                
                logger.debug(
                    f"Pattern match stored: {cookie_name} @ {cookie_domain} "
                    f"-> {category} (pattern: {pattern})"
                )
                return True
                
        except Exception as e:
            logger.error(f"Error storing pattern match: {e}")
            return False
    
    async def get_patterns(self) -> List[Dict[str, Any]]:
        """
        Get all active patterns.
        
        Returns:
            List of pattern dictionaries
        """
        if not self.patterns_loaded:
            await self.load_patterns()
        
        return self.patterns_cache.copy()
    
    async def _persist_to_database(
        self,
        scan_id: str,
        cookie_name: str,
        cookie_domain: str,
        old_category: str,
        new_category: str,
        user_id: Optional[str]
    ):
        """Persist category change to database"""
        try:
            # This will be implemented when database is available
            # For now, we'll use file-based storage as fallback
            await self._persist_to_file(
                scan_id, cookie_name, cookie_domain,
                old_category, new_category, user_id
            )
        except Exception as e:
            logger.error(f"Database persistence failed: {e}")
    
    async def _persist_to_file(
        self,
        scan_id: str,
        cookie_name: str,
        cookie_domain: str,
        old_category: str,
        new_category: str,
        user_id: Optional[str]
    ):
        """Fallback: persist to JSON file"""
        import os

        # Refuse any scan_id that would resolve outside the overrides folder.
        # Raised outside the try below so the caller reports the write as failed
        # instead of claiming a file fallback that never happened.
        data_dir = "data/category_overrides"
        base = os.path.realpath(data_dir)
        file_path = os.path.realpath(os.path.join(data_dir, f"{scan_id}.json"))
        if os.path.dirname(file_path) != base:
            raise ValueError(f"scan_id escapes the category override folder: {scan_id!r}")

        try:
            import aiofiles

            # Create data directory if it doesn't exist
            os.makedirs(data_dir, exist_ok=True)
            
            # Load existing data
            data = {}
            if os.path.exists(file_path):
                async with aiofiles.open(file_path, 'r') as f:
                    content = await f.read()
                    data = json.loads(content)
            
            # Add new override
            override_key = f"{cookie_name}|{cookie_domain}"
            data[override_key] = {
                "cookie_name": cookie_name,
                "cookie_domain": cookie_domain,
                "old_category": old_category,
                "new_category": new_category,
                "updated_at": datetime.now().isoformat(),
                "user_id": user_id
            }
            
            # Save to file
            async with aiofiles.open(file_path, 'w') as f:
                await f.write(json.dumps(data, indent=2))
            
            logger.info(f"Category override saved to file: {file_path}")
            
        except Exception as e:
            logger.error(f"File persistence failed: {e}")
    
    async def get_category_overrides(self, scan_id: str) -> Dict:
        """
        Get all category overrides for a specific scan.
        
        Args:
            scan_id: Unique scan identifier
            
        Returns:
            Dict: Category overrides
        """
        try:
            # Check memory cache first
            if scan_id in self.category_overrides:
                return self.category_overrides[scan_id]
            
            # Try to load from file
            file_path = f"data/category_overrides/{scan_id}.json"
            if os.path.exists(file_path):
                import aiofiles
                async with aiofiles.open(file_path, 'r') as f:
                    content = await f.read()
                    data = json.loads(content)
                    self.category_overrides[scan_id] = data
                    return data
            
            return {}
            
        except Exception as e:
            logger.error(f"Error loading category overrides: {e}")
            return {}
    
    async def get_category_history(self, scan_id: str) -> List[Dict]:
        """
        Get the history of category changes for a scan.
        
        Args:
            scan_id: Unique scan identifier
            
        Returns:
            List[Dict]: List of category changes
        """
        try:
            overrides = await self.get_category_overrides(scan_id)
            
            # Convert to list and sort by timestamp
            history = list(overrides.values())
            history.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            
            return history
            
        except Exception as e:
            logger.error(f"Error fetching category history: {e}")
            return []
    
    def apply_overrides(self, scan_id: str, cookies: List[Dict]) -> List[Dict]:
        """
        Apply category overrides to a list of cookies.
        
        Args:
            scan_id: Unique scan identifier
            cookies: List of cookie dictionaries
            
        Returns:
            List[Dict]: Cookies with updated categories
        """
        try:
            overrides = self.category_overrides.get(scan_id, {})
            
            if not overrides:
                return cookies
            
            # Apply overrides
            for cookie in cookies:
                override_key = f"{cookie['name']}|{cookie['domain']}"
                if override_key in overrides:
                    override = overrides[override_key]
                    cookie['category'] = override['new_category']
                    cookie['category_modified'] = True
                    cookie['category_modified_at'] = override['updated_at']
            
            return cookies
            
        except Exception as e:
            logger.error(f"Error applying overrides: {e}")
            return cookies


# Global instance
_category_manager: Optional[CategoryManager] = None


def get_category_manager() -> CategoryManager:
    """Get or create the global category manager instance"""
    global _category_manager
    
    if _category_manager is None:
        _category_manager = CategoryManager()
    
    return _category_manager


def set_category_manager(manager: CategoryManager):
    """Set the global category manager instance"""
    global _category_manager
    _category_manager = manager
