"""
Category Manager - Handles cookie category updates and persistence
"""
import logging
import os
from typing import Optional, List, Dict
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class CategoryManager:
    """
    Manages cookie category updates and persists them to storage.
    Supports both in-memory (localStorage) and database persistence.
    """
    
    def __init__(self):
        self.category_overrides = {}  # In-memory cache
        self.db_connection = None
    
    async def update_category(
        self,
        scan_id: str,
        cookie_name: str,
        cookie_domain: str,
        old_category: str,
        new_category: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Update cookie category and persist the change.
        
        Args:
            scan_id: Unique scan identifier
            cookie_name: Name of the cookie
            cookie_domain: Domain of the cookie
            old_category: Previous category
            new_category: New category
            user_id: Optional user identifier
            
        Returns:
            bool: True if successful, False otherwise
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
                "user_id": user_id
            }
            
            # Persist to database if available
            if self.db_connection:
                await self._persist_to_database(
                    scan_id, cookie_name, cookie_domain,
                    old_category, new_category, user_id
                )
            
            logger.info(
                f"Category updated: {cookie_name} @ {cookie_domain} "
                f"from '{old_category}' to '{new_category}'"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating category: {e}")
            return False
    
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
        try:
            import os
            import aiofiles
            
            # Create data directory if it doesn't exist
            data_dir = "data/category_overrides"
            os.makedirs(data_dir, exist_ok=True)
            
            file_path = f"{data_dir}/{scan_id}.json"
            
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
