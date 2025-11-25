"""
Browser Instance Pool Manager
Reuses browser instances for better performance
"""
import asyncio
import logging
from typing import List, Optional
from playwright.async_api import Browser, BrowserContext, async_playwright
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class BrowserInstance:
    """Browser instance wrapper"""
    browser: Browser
    contexts: List[BrowserContext]
    created_at: datetime
    last_used: datetime
    usage_count: int = 0
    max_contexts: int = 10


class BrowserPool:
    """
    Browser instance pool for efficient resource management.
    Industry-standard approach for high-performance scanning.
    """
    
    def __init__(
        self,
        pool_size: int = 10,
        browser_type: str = "chromium",
        max_contexts_per_browser: int = 10
    ):
        self.pool_size = pool_size
        self.browser_type = browser_type
        self.max_contexts_per_browser = max_contexts_per_browser
        
        self.pool: List[BrowserInstance] = []
        self.available_browsers: asyncio.Queue = asyncio.Queue()
        self.playwright = None
        self.lock = asyncio.Lock()
        
        self._initialized = False
    
    async def initialize(self):
        """Initialize the browser pool"""
        if self._initialized:
            return
        
        logger.info(f"Initializing browser pool: {self.pool_size} instances")
        
        self.playwright = await async_playwright().start()
        
        # Get browser launcher
        if self.browser_type == "chromium":
            launcher = self.playwright.chromium
        elif self.browser_type == "firefox":
            launcher = self.playwright.firefox
        else:
            launcher = self.playwright.webkit
        
        # Create browser instances
        for i in range(self.pool_size):
            try:
                browser = await launcher.launch(
                    headless=True,
                    args=[
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-gpu',
                        '--disable-software-rasterizer',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-sync',
                        '--metrics-recording-only',
                        '--mute-audio',
                        '--no-first-run',
                        '--disable-default-apps',
                        '--disable-background-timer-throttling',
                        '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows',
                    ]
                )
                
                instance = BrowserInstance(
                    browser=browser,
                    contexts=[],
                    created_at=datetime.now(),
                    last_used=datetime.now(),
                    max_contexts=self.max_contexts_per_browser
                )
                
                self.pool.append(instance)
                await self.available_browsers.put(instance)
                
                logger.info(f"Browser instance {i+1}/{self.pool_size} created")
                
            except Exception as e:
                logger.error(f"Failed to create browser instance {i+1}: {e}")
        
        self._initialized = True
        logger.info(f"Browser pool initialized with {len(self.pool)} instances")
    
    async def acquire_context(self) -> BrowserContext:
        """Acquire a browser context from the pool"""
        if not self._initialized:
            await self.initialize()
        
        # Get available browser instance
        instance = await self.available_browsers.get()
        
        try:
            # Create new context
            context = await instance.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ignore_https_errors=True,
                java_script_enabled=True
            )
            
            instance.contexts.append(context)
            instance.last_used = datetime.now()
            instance.usage_count += 1
            
            # Return browser to pool if not at max contexts
            if len(instance.contexts) < instance.max_contexts:
                await self.available_browsers.put(instance)
            
            logger.debug(f"Context acquired. Instance has {len(instance.contexts)} contexts")
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to create context: {e}")
            # Return browser to pool
            await self.available_browsers.put(instance)
            raise
    
    async def release_context(self, context: BrowserContext):
        """Release a browser context back to the pool"""
        try:
            await context.close()
            
            # Find the instance this context belongs to
            async with self.lock:
                for instance in self.pool:
                    if context in instance.contexts:
                        instance.contexts.remove(context)
                        
                        # If instance was at max, return it to available pool
                        if len(instance.contexts) == instance.max_contexts - 1:
                            await self.available_browsers.put(instance)
                        
                        logger.debug(f"Context released. Instance has {len(instance.contexts)} contexts")
                        break
                        
        except Exception as e:
            logger.error(f"Error releasing context: {e}")
    
    async def close(self):
        """Close all browser instances"""
        logger.info("Closing browser pool...")
        
        for instance in self.pool:
            try:
                # Close all contexts
                for context in instance.contexts:
                    await context.close()
                
                # Close browser
                await instance.browser.close()
                
            except Exception as e:
                logger.error(f"Error closing browser instance: {e}")
        
        if self.playwright:
            await self.playwright.stop()
        
        self.pool.clear()
        self._initialized = False
        
        logger.info("Browser pool closed")
    
    def get_stats(self) -> dict:
        """Get pool statistics"""
        total_contexts = sum(len(inst.contexts) for inst in self.pool)
        
        return {
            "pool_size": len(self.pool),
            "total_contexts": total_contexts,
            "available_browsers": self.available_browsers.qsize(),
            "total_usage": sum(inst.usage_count for inst in self.pool),
            "avg_contexts_per_browser": total_contexts / len(self.pool) if self.pool else 0
        }


# Global browser pool instance
_browser_pool: Optional[BrowserPool] = None


async def get_browser_pool() -> BrowserPool:
    """Get or create the global browser pool"""
    global _browser_pool
    
    if _browser_pool is None:
        import os
        pool_size = int(os.getenv('BROWSER_POOL_SIZE', '10'))
        browser_type = os.getenv('BROWSER_TYPE', 'chromium')
        
        _browser_pool = BrowserPool(
            pool_size=pool_size,
            browser_type=browser_type
        )
        await _browser_pool.initialize()
    
    return _browser_pool
