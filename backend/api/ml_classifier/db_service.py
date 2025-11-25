"""
Database Service for ML Classifier

Provides database operations for similarity detection and cookie queries.
"""

import os
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    """Database service for ML classifier operations."""
    
    def __init__(self):
        """Initialize database connection parameters."""
        self.db_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'cookie_scanner'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }
    
    @contextmanager
    def get_connection(self):
        """
        Get database connection context manager.
        
        Yields:
            psycopg2 connection
        """
        conn = None
        try:
            conn = psycopg2.connect(**self.db_params)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def get_all_cookies(
        self,
        scan_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all cookies from database.
        
        Args:
            scan_id: Optional scan ID to filter by
            limit: Optional limit on number of results
        
        Returns:
            List of cookie dictionaries
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        id,
                        name,
                        domain,
                        path,
                        expires,
                        http_only,
                        secure,
                        same_site,
                        category,
                        type,
                        purpose,
                        is_third_party,
                        size,
                        value
                    FROM cookies
                """
                
                params = []
                if scan_id:
                    query += " WHERE scan_id = %s"
                    params.append(scan_id)
                
                if limit:
                    query += f" LIMIT {limit}"
                
                cur.execute(query, params)
                results = cur.fetchall()
                
                # Convert to list of dicts
                cookies = []
                for row in results:
                    cookie = dict(row)
                    # Calculate expiry_days if expires is set
                    if cookie.get('expires'):
                        from datetime import datetime
                        try:
                            expiry_date = datetime.fromtimestamp(cookie['expires'])
                            now = datetime.now()
                            expiry_days = (expiry_date - now).days
                            cookie['expiry_days'] = max(0, expiry_days)
                        except:
                            cookie['expiry_days'] = None
                    else:
                        cookie['expiry_days'] = None
                    
                    cookies.append(cookie)
                
                return cookies
    
    def get_cookie_by_id(self, cookie_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single cookie by ID.
        
        Args:
            cookie_id: Cookie UUID
        
        Returns:
            Cookie dictionary or None
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        id,
                        name,
                        domain,
                        path,
                        expires,
                        http_only,
                        secure,
                        same_site,
                        category,
                        type,
                        purpose,
                        is_third_party,
                        size,
                        value
                    FROM cookies
                    WHERE id = %s
                """, (cookie_id,))
                
                row = cur.fetchone()
                if not row:
                    return None
                
                cookie = dict(row)
                
                # Calculate expiry_days
                if cookie.get('expires'):
                    from datetime import datetime
                    try:
                        expiry_date = datetime.fromtimestamp(cookie['expires'])
                        now = datetime.now()
                        expiry_days = (expiry_date - now).days
                        cookie['expiry_days'] = max(0, expiry_days)
                    except:
                        cookie['expiry_days'] = None
                else:
                    cookie['expiry_days'] = None
                
                return cookie
    
    def get_cookies_by_domain(
        self,
        domain: str,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get cookies by domain pattern.
        
        Args:
            domain: Domain to search for
            limit: Optional limit on results
        
        Returns:
            List of cookie dictionaries
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        id,
                        name,
                        domain,
                        path,
                        expires,
                        http_only,
                        secure,
                        same_site,
                        category,
                        type,
                        purpose,
                        is_third_party,
                        size,
                        value
                    FROM cookies
                    WHERE domain LIKE %s OR domain LIKE %s
                """
                
                params = [f"%{domain}%", f"%.{domain}"]
                
                if limit:
                    query += f" LIMIT {limit}"
                
                cur.execute(query, params)
                results = cur.fetchall()
                
                cookies = []
                for row in results:
                    cookie = dict(row)
                    # Calculate expiry_days
                    if cookie.get('expires'):
                        from datetime import datetime
                        try:
                            expiry_date = datetime.fromtimestamp(cookie['expires'])
                            now = datetime.now()
                            expiry_days = (expiry_date - now).days
                            cookie['expiry_days'] = max(0, expiry_days)
                        except:
                            cookie['expiry_days'] = None
                    else:
                        cookie['expiry_days'] = None
                    
                    cookies.append(cookie)
                
                return cookies
    
    def get_cookies_by_name_pattern(
        self,
        name_pattern: str,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get cookies by name pattern.
        
        Args:
            name_pattern: Name pattern to search for
            limit: Optional limit on results
        
        Returns:
            List of cookie dictionaries
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        id,
                        name,
                        domain,
                        path,
                        expires,
                        http_only,
                        secure,
                        same_site,
                        category,
                        type,
                        purpose,
                        is_third_party,
                        size,
                        value
                    FROM cookies
                    WHERE name ILIKE %s
                """
                
                params = [f"%{name_pattern}%"]
                
                if limit:
                    query += f" LIMIT {limit}"
                
                cur.execute(query, params)
                results = cur.fetchall()
                
                cookies = []
                for row in results:
                    cookie = dict(row)
                    # Calculate expiry_days
                    if cookie.get('expires'):
                        from datetime import datetime
                        try:
                            expiry_date = datetime.fromtimestamp(cookie['expires'])
                            now = datetime.now()
                            expiry_days = (expiry_date - now).days
                            cookie['expiry_days'] = max(0, expiry_days)
                        except:
                            cookie['expiry_days'] = None
                    else:
                        cookie['expiry_days'] = None
                    
                    cookies.append(cookie)
                
                return cookies
    
    def get_candidate_cookies(
        self,
        reference_cookie: Dict[str, Any],
        max_candidates: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Get candidate cookies for similarity comparison.
        
        Uses smart filtering to reduce the search space:
        - Same or similar domain
        - Similar name prefix
        - Same vendor (if available)
        
        Args:
            reference_cookie: Cookie to find similar matches for
            max_candidates: Maximum number of candidates to return
        
        Returns:
            List of candidate cookie dictionaries
        """
        name = reference_cookie.get('name', '')
        domain = reference_cookie.get('domain', '')
        vendor = reference_cookie.get('vendor', '')
        
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Build smart query with multiple filters
                query = """
                    SELECT 
                        id,
                        name,
                        domain,
                        path,
                        expires,
                        http_only,
                        secure,
                        same_site,
                        category,
                        type,
                        purpose,
                        is_third_party,
                        size,
                        value
                    FROM cookies
                    WHERE id != %s
                    AND (
                        -- Similar domain
                        domain LIKE %s
                        OR domain LIKE %s
                        -- Similar name prefix (first 3 chars)
                        OR name ILIKE %s
                        -- Exact vendor match (if available)
                        OR (type = %s AND %s != '')
                    )
                    LIMIT %s
                """
                
                # Extract domain parts
                domain_parts = domain.split('.')
                base_domain = '.'.join(domain_parts[-2:]) if len(domain_parts) >= 2 else domain
                
                # Extract name prefix (first 3 chars)
                name_prefix = name[:3] if len(name) >= 3 else name
                
                params = [
                    reference_cookie.get('id', ''),
                    f"%{base_domain}%",
                    f"%.{base_domain}",
                    f"{name_prefix}%",
                    vendor,
                    vendor,
                    max_candidates
                ]
                
                cur.execute(query, params)
                results = cur.fetchall()
                
                cookies = []
                for row in results:
                    cookie = dict(row)
                    # Calculate expiry_days
                    if cookie.get('expires'):
                        from datetime import datetime
                        try:
                            expiry_date = datetime.fromtimestamp(cookie['expires'])
                            now = datetime.now()
                            expiry_days = (expiry_date - now).days
                            cookie['expiry_days'] = max(0, expiry_days)
                        except:
                            cookie['expiry_days'] = None
                    else:
                        cookie['expiry_days'] = None
                    
                    # Add vendor from type field (temporary until vendor field exists)
                    cookie['vendor'] = cookie.get('type', 'Unknown')
                    
                    cookies.append(cookie)
                
                return cookies
    
    def store_similar_cookies_feedback(
        self,
        cookie_id: str,
        similar_cookie_ids: List[str],
        corrected_label: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Store feedback about similar cookies bulk update.
        
        Args:
            cookie_id: Original cookie ID
            similar_cookie_ids: List of similar cookie IDs
            corrected_label: The corrected category
            user_id: Optional user ID
        
        Returns:
            True if successful
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # This would integrate with ml_feedback table
                # For now, just log the operation
                logger.info(
                    f"Bulk update: Cookie {cookie_id} -> {corrected_label}, "
                    f"applied to {len(similar_cookie_ids)} similar cookies"
                )
                return True


# Singleton instance
_db_service = None


def get_db_service() -> DatabaseService:
    """Get singleton database service instance."""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service
