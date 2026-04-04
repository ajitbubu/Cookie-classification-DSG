"""
Database Manager - Handles PostgreSQL connection pooling and management
"""
import asyncpg
import logging
import os
from typing import Optional
import asyncio
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Manages PostgreSQL database connections with connection pooling,
    retry logic, and graceful error handling.
    """
    
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        min_size: int = 5,
        max_size: int = 20,
        timeout: float = 5.0
    ):
        """
        Initialize DatabaseManager with connection parameters.
        
        Args:
            host: Database host
            port: Database port
            database: Database name
            user: Database user
            password: Database password
            min_size: Minimum pool size (default: 5)
            max_size: Maximum pool size (default: 20)
            timeout: Connection timeout in seconds (default: 5.0)
        """
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.min_size = min_size
        self.max_size = max_size
        self.timeout = timeout
        self.pool: Optional[asyncpg.Pool] = None
        self._is_connected = False
    
    async def connect(self, max_retries: int = 3) -> bool:
        """
        Establish database connection pool with retry logic.
        
        Args:
            max_retries: Maximum number of connection attempts (default: 3)
            
        Returns:
            bool: True if connection successful, False otherwise
        """
        retry_delays = [1, 2, 4]  # Exponential backoff: 1s, 2s, 4s
        
        for attempt in range(max_retries):
            try:
                logger.info(
                    f"Attempting database connection (attempt {attempt + 1}/{max_retries})..."
                )
                
                self.pool = await asyncpg.create_pool(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    min_size=self.min_size,
                    max_size=self.max_size,
                    timeout=self.timeout,
                    command_timeout=self.timeout
                )
                
                # Validate connection
                async with self.pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                
                self._is_connected = True
                logger.info(
                    f"Database connection established successfully "
                    f"(pool size: {self.min_size}-{self.max_size})"
                )
                return True
                
            except Exception as e:
                logger.error(
                    f"Database connection attempt {attempt + 1} failed: {e}"
                )
                
                if attempt < max_retries - 1:
                    delay = retry_delays[attempt]
                    logger.info(f"Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "All database connection attempts failed. "
                        "Application will continue with fallback storage."
                    )
                    return False
        
        return False
    
    async def disconnect(self):
        """
        Close database connection pool gracefully.
        Waits for pending queries to complete.
        """
        if self.pool:
            try:
                logger.info("Closing database connection pool...")
                await self.pool.close()
                self._is_connected = False
                logger.info("Database connection pool closed successfully")
            except Exception as e:
                logger.error(f"Error closing database connection pool: {e}")
    
    @asynccontextmanager
    async def acquire(self):
        """
        Context manager for acquiring a database connection from the pool.
        
        Usage:
            async with db_manager.acquire() as conn:
                result = await conn.fetch("SELECT * FROM table")
        
        Yields:
            asyncpg.Connection: Database connection
        """
        if not self.pool:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        
        async with self.pool.acquire() as connection:
            yield connection
    
    async def execute(self, query: str, *args) -> str:
        """
        Execute a query that doesn't return results (INSERT, UPDATE, DELETE).
        
        Args:
            query: SQL query with $1, $2, etc. placeholders
            *args: Query parameters
            
        Returns:
            str: Query execution status
        """
        if not self.is_connected:
            raise RuntimeError("Database not connected")
        
        async with self.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args):
        """
        Execute a query and fetch all results.
        
        Args:
            query: SQL query with $1, $2, etc. placeholders
            *args: Query parameters
            
        Returns:
            List[asyncpg.Record]: Query results
        """
        if not self.is_connected:
            raise RuntimeError("Database not connected")
        
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args):
        """
        Execute a query and fetch a single row.
        
        Args:
            query: SQL query with $1, $2, etc. placeholders
            *args: Query parameters
            
        Returns:
            Optional[asyncpg.Record]: Single row or None
        """
        if not self.is_connected:
            raise RuntimeError("Database not connected")
        
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetchval(self, query: str, *args):
        """
        Execute a query and fetch a single value.
        
        Args:
            query: SQL query with $1, $2, etc. placeholders
            *args: Query parameters
            
        Returns:
            Any: Single value or None
        """
        if not self.is_connected:
            raise RuntimeError("Database not connected")
        
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)
    
    async def validate_connection(self) -> bool:
        """
        Validate that the database connection is working.
        
        Returns:
            bool: True if connection is valid, False otherwise
        """
        try:
            if not self.pool:
                return False
            
            async with self.acquire() as conn:
                await conn.fetchval("SELECT 1")
            
            return True
            
        except Exception as e:
            logger.error(f"Connection validation failed: {e}")
            return False
    
    @property
    def is_connected(self) -> bool:
        """Check if database is connected"""
        return self._is_connected and self.pool is not None
    
    @classmethod
    def from_env(cls) -> "DatabaseManager":
        """
        Create DatabaseManager instance from environment variables.
        
        Environment variables:
            DB_HOST: Database host
            DB_PORT: Database port
            DB_NAME: Database name
            DB_USER: Database user
            DB_PASSWORD: Database password
            DB_POOL_MIN_SIZE: Minimum pool size (optional, default: 5)
            DB_POOL_MAX_SIZE: Maximum pool size (optional, default: 20)
            DB_TIMEOUT: Connection timeout (optional, default: 5.0)
        
        Returns:
            DatabaseManager: Configured instance
        """
        return cls(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "cookie_scanner"),
            user=os.getenv("DB_USER", "scanner"),
            password=os.getenv("DB_PASSWORD", "scanner_password"),
            min_size=int(os.getenv("DB_POOL_MIN_SIZE", "5")),
            max_size=int(os.getenv("DB_POOL_MAX_SIZE", "20")),
            timeout=float(os.getenv("DB_TIMEOUT", "5.0"))
        )


# Global instance
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> Optional[DatabaseManager]:
    """Get the global database manager instance"""
    global _db_manager
    return _db_manager


def set_db_manager(manager: DatabaseManager):
    """Set the global database manager instance"""
    global _db_manager
    _db_manager = manager


async def initialize_database() -> Optional[DatabaseManager]:
    """
    Initialize the global database manager and establish connection.
    
    Returns:
        Optional[DatabaseManager]: Connected database manager or None if failed
    """
    try:
        manager = DatabaseManager.from_env()
        connected = await manager.connect()
        
        if connected:
            set_db_manager(manager)
            logger.info("Database initialized successfully")
            return manager
        else:
            logger.warning(
                "Database connection failed. Application will use fallback storage."
            )
            return None
            
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        return None


async def shutdown_database():
    """Shutdown the global database manager"""
    manager = get_db_manager()
    if manager:
        await manager.disconnect()
        set_db_manager(None)
