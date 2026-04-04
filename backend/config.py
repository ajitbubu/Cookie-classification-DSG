from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Server configuration
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 1001
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:1001,http://cookie-scanner-frontend:5173,*"
    
    # Database configuration
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "cookie_scanner"
    DB_USER: str = "scanner"
    DB_PASSWORD: str = "scanner_password"
    DB_MIN_POOL_SIZE: int = 5
    DB_MAX_POOL_SIZE: int = 20
    DB_TIMEOUT: int = 5
    
    # Scanning configuration - Industry Grade
    MAX_CONCURRENT_PAGES: int = 100  # Increased from 50 for faster scanning
    MIN_CONCURRENT_PAGES: int = 10   # Increased from 5
    MAX_PAGES_PER_SCAN: int = 20000  # Industry-grade: 20K pages
    MAX_DEPTH: int = 500  # Maximum crawl depth
    PAGE_TIMEOUT: int = 60000  # 60 seconds timeout for complex pages
    
    # Performance tuning
    BATCH_SIZE: int = 150  # Increased from 100 for larger batches
    ADAPTIVE_CONCURRENCY: bool = True  # Adjust concurrency based on performance
    CONCURRENCY_INCREASE_THRESHOLD: float = 0.85  # Increased from 0.8 - more aggressive scaling
    CONCURRENCY_DECREASE_THRESHOLD: float = 0.5  # If success rate < 50%, decrease concurrency
    
    # Speed optimizations
    COOKIE_WAIT_TIME: float = 0.5  # Reduced from 1s - wait for cookies to be set
    LINK_EXTRACTION_WAIT: float = 0.5  # Reduced from 2s - wait for dynamic content
    INTER_SCAN_DELAY: float = 0.05  # Reduced from 0.1s - delay between scans
    
    # Browser configuration
    BROWSER_TYPE: str = "chromium"  # or "firefox"
    HEADLESS: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields like VITE_* from .env
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS string into list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
