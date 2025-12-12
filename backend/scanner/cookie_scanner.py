from playwright.async_api import BrowserContext, Page
from urllib.parse import urlparse, urljoin
from typing import List, Dict, Optional
from datetime import datetime
import logging
import asyncio

from backend.scanner.classifier import CookieClassifier
from backend.config import settings

logger = logging.getLogger(__name__)


class CookieScanner:
    """Core cookie scanning functionality using Playwright"""
    
    def __init__(self, context: BrowserContext):
        self.context = context
        self.classifier = CookieClassifier()
    
    async def scan_page(self, url: str) -> Dict:
        """Scan a single page for cookies"""
        page: Page = None
        
        try:
            logger.info(f"Scanning page: {url}")
            page = await self.context.new_page()
            
            # Navigate to URL with faster loading strategy
            await page.goto(url, wait_until="domcontentloaded", timeout=settings.PAGE_TIMEOUT)
            
            # Reduced wait time for cookies to be set
            await asyncio.sleep(settings.COOKIE_WAIT_TIME)
            
            # Get all cookies from the context
            cookies = await self.context.cookies()
            
            # Get page domain
            parsed_url = urlparse(url)
            domain = parsed_url.netloc

            # Classify cookies using parallel processing for CPU-bound operations
            classified_cookies = await self.classifier.classify_parallel_async(
                cookies, domain, max_workers=20
            )
            
            logger.info(f"Found {len(classified_cookies)} cookies on {url}")
            
            return {
                "url": url,
                "domain": domain,
                "cookies": classified_cookies,
                "cookieCount": len(classified_cookies),
                "scannedAt": datetime.now().isoformat(),
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error scanning {url}: {e}")
            return {
                "url": url,
                "domain": urlparse(url).netloc,
                "cookies": [],
                "cookieCount": 0,
                "scannedAt": datetime.now().isoformat(),
                "error": str(e)
            }
            
        finally:
            if page:
                await page.close()
    
    async def extract_links(self, url: str, max_links: int = 50) -> List[str]:
        """Extract links from a page for deep scanning"""
        page: Page = None
        
        try:
            logger.info(f"Extracting links from: {url}")
            page = await self.context.new_page()
            
            # Wait for network to be mostly idle to ensure dynamic content loads
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as e:
                logger.warning(f"Network idle timeout for {url}, trying load: {e}")
                try:
                    await page.goto(url, wait_until="load", timeout=30000)
                except Exception as e2:
                    logger.warning(f"Load timeout for {url}, trying domcontentloaded: {e2}")
                    await page.goto(url, wait_until="domcontentloaded", timeout=settings.PAGE_TIMEOUT)
            
            # Wait longer for dynamic content and JavaScript to render links
            await asyncio.sleep(3.0)  # Increased wait time for JS-heavy sites
            
            # Scroll to trigger lazy loading
            try:
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1.0)
            except Exception:
                pass
            
            # Debug: Check page content
            page_info = await page.evaluate("""
                () => {
                    return {
                        title: document.title,
                        bodyLength: document.body ? document.body.innerHTML.length : 0,
                        anchorCount: document.querySelectorAll('a').length,
                        anchorWithHrefCount: document.querySelectorAll('a[href]').length
                    };
                }
            """)
            logger.info(f"Page info for {url}: {page_info}")
            
            # Extract all links - use JavaScript evaluation for reliability
            try:
                links = await page.evaluate("""
                    () => {
                        const links = [];
                        const anchors = document.querySelectorAll('a');
                        anchors.forEach(a => {
                            const href = a.getAttribute('href') || a.href;
                            if (href) {
                                links.push(href);
                            }
                        });
                        return links;
                    }
                """)
                logger.info(f"Found {len(links)} raw links on {url}")
            except Exception as e:
                logger.error(f"Error extracting links: {e}")
                links = []
            
            # Filter and clean links
            parsed_base = urlparse(url)
            base_domain = parsed_base.netloc
            
            unique_links = set()
            for link in links:
                try:
                    parsed_link = urlparse(link)
                    
                    # Only include same-origin links
                    if parsed_link.netloc == base_domain or parsed_link.netloc == '':
                        # Handle relative URLs
                        if parsed_link.netloc == '':
                            link = urljoin(url, link)
                            parsed_link = urlparse(link)
                        
                        # Remove fragment
                        clean_url = f"{parsed_link.scheme}://{parsed_link.netloc}{parsed_link.path}"
                        if parsed_link.query:
                            clean_url += f"?{parsed_link.query}"
                        
                        # Skip common non-page URLs
                        if not any(ext in clean_url.lower() for ext in ['.pdf', '.jpg', '.png', '.gif', '.zip', '.mp4', '.mp3', 'javascript:', 'mailto:', 'tel:']):
                            unique_links.add(clean_url)
                    
                    if len(unique_links) >= max_links:
                        break
                        
                except Exception as e:
                    logger.debug(f"Error parsing link {link}: {e}")
                    continue
            
            result = list(unique_links)[:max_links]
            logger.info(f"Extracted {len(result)} unique same-origin links from {url} (from {len(links)} total links found)")
            
            # If no links found, try to get sitemap URLs
            if len(result) == 0:
                logger.warning(f"No same-origin links found on {url} (found {len(links)} total links), trying sitemap")
                sitemap_urls = await self._extract_from_sitemap(url, max_links)
                if sitemap_urls:
                    result.extend(sitemap_urls)
                    logger.info(f"Extracted {len(sitemap_urls)} URLs from sitemap")
                else:
                    # Generate common paths as last resort
                    logger.warning(f"No sitemap found, generating common paths")
                    common_paths = [
                        '/about', '/contact', '/products', '/services', '/blog', 
                        '/news', '/support', '/help', '/faq', '/privacy', 
                        '/terms', '/careers', '/team', '/pricing', '/features'
                    ]
                    for path in common_paths[:max_links]:
                        try:
                            full_url = urljoin(url, path)
                            result.append(full_url)
                        except Exception:
                            continue
                    logger.info(f"Generated {len(result)} common paths to scan")
            
            return result
            
        except Exception as e:
            logger.error(f"Error extracting links from {url}: {e}")
            # Return some common paths as fallback
            common_paths = ['/about', '/contact', '/products', '/services', '/blog']
            result = []
            for path in common_paths:
                try:
                    full_url = urljoin(url, path)
                    result.append(full_url)
                except Exception:
                    continue
            return result
            
        finally:
            if page:
                await page.close()
    
    async def _extract_from_sitemap(self, url: str, max_urls: int = 100) -> List[str]:
        """Try to extract URLs from sitemap.xml using Playwright"""
        try:
            parsed_url = urlparse(url)
            base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
            
            # Try common sitemap locations
            sitemap_urls = [
                f"{base_url}/sitemap.xml",
                f"{base_url}/sitemap_index.xml",
                f"{base_url}/sitemap-index.xml"
            ]
            
            page = None
            try:
                page = await self.context.new_page()
                
                for sitemap_url in sitemap_urls:
                    try:
                        response = await page.goto(sitemap_url, wait_until="domcontentloaded", timeout=10000)
                        if response and response.status == 200:
                            content = await page.content()
                            
                            # Parse XML sitemap
                            import re
                            urls = re.findall(r'<loc>(.+?)</loc>', content)
                            
                            # Filter same-origin URLs
                            same_origin_urls = []
                            for found_url in urls:
                                try:
                                    parsed = urlparse(found_url)
                                    if parsed.netloc == parsed_url.netloc:
                                        same_origin_urls.append(found_url)
                                        if len(same_origin_urls) >= max_urls:
                                            break
                                except Exception:
                                    continue
                            
                            if same_origin_urls:
                                logger.info(f"Found {len(same_origin_urls)} URLs in sitemap {sitemap_url}")
                                return same_origin_urls[:max_urls]
                    except Exception as e:
                        logger.debug(f"Failed to fetch sitemap {sitemap_url}: {e}")
                        continue
                
                return []
            finally:
                if page:
                    await page.close()
        except Exception as e:
            logger.error(f"Error extracting from sitemap: {e}")
            return []
    
    def deduplicate_cookies(self, page_results: List[Dict]) -> List[Dict]:
        """Deduplicate cookies across multiple pages"""
        cookie_map = {}
        
        for page_result in page_results:
            for cookie in page_result.get("cookies", []):
                # Use name + domain as unique key
                key = f"{cookie['name']}|{cookie['domain']}"
                
                if key not in cookie_map:
                    cookie_map[key] = {
                        **cookie,
                        "foundOnPages": [page_result["url"]]
                    }
                else:
                    # Add page to foundOnPages list
                    if page_result["url"] not in cookie_map[key]["foundOnPages"]:
                        cookie_map[key]["foundOnPages"].append(page_result["url"])
        
        return list(cookie_map.values())
