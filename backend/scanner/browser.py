from playwright.async_api import async_playwright, Browser, BrowserContext, Playwright
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages Playwright browser instance lifecycle"""
    
    def __init__(self):
        self.playwright: Playwright = None
        self.browser: Browser = None
        self._initialized = False
    
    async def start(self):
        """Initialize Playwright and launch browser"""
        if self._initialized:
            return
        
        try:
            logger.info("Starting Playwright...")
            self.playwright = await async_playwright().start()
            
            # Launch browser based on configuration
            if settings.BROWSER_TYPE.lower() == "firefox":
                logger.info("Launching Firefox browser...")
                self.browser = await self.playwright.firefox.launch(
                    headless=settings.HEADLESS
                )
            else:
                logger.info("Launching Chromium browser...")
                self.browser = await self.playwright.chromium.launch(
                    headless=settings.HEADLESS
                )
            
            self._initialized = True
            logger.info("Browser started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start browser: {e}")
            raise
    
    async def create_context(self) -> BrowserContext:
        """Create isolated browser context for scanning"""
        if not self._initialized:
            await self.start()
        
        try:
            # Check if browser is still connected
            if not self.browser or not self.browser.is_connected():
                logger.warning("Browser disconnected, reinitializing...")
                self._initialized = False
                await self.start()
            
            # Use realistic user agent to avoid bot detection
            context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                ignore_https_errors=True,
                locale="en-US",
                timezone_id="America/New_York",
                permissions=["geolocation"],
                extra_http_headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "DNT": "1",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1"
                }
            )
            
            # Set default timeout
            context.set_default_timeout(settings.PAGE_TIMEOUT)
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to create browser context: {e}")
            # Try to reinitialize browser on failure
            try:
                logger.info("Attempting to reinitialize browser...")
                self._initialized = False
                await self.start()
                # Retry context creation
                context = await self.browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True,
                    locale="en-US",
                    timezone_id="America/New_York",
                    permissions=["geolocation"],
                    extra_http_headers={
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Accept-Encoding": "gzip, deflate, br",
                        "DNT": "1",
                        "Connection": "keep-alive",
                        "Upgrade-Insecure-Requests": "1"
                    }
                )
                context.set_default_timeout(settings.PAGE_TIMEOUT)
                logger.info("Browser reinitialized successfully")
                return context
            except Exception as retry_error:
                logger.error(f"Failed to reinitialize browser: {retry_error}")
                raise
    
    async def close(self):
        """Clean up browser resources"""
        try:
            if self.browser:
                logger.info("Closing browser...")
                await self.browser.close()
            
            if self.playwright:
                logger.info("Stopping Playwright...")
                await self.playwright.stop()
            
            self._initialized = False
            logger.info("Browser closed successfully")
            
        except Exception as e:
            logger.error(f"Error closing browser: {e}")


# Global browser manager instance
browser_manager = BrowserManager()
