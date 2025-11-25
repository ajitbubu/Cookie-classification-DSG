import asyncio
import time
from typing import List, Callable, Optional, Set
from playwright.async_api import BrowserContext
from urllib.parse import urlparse
import logging

from backend.scanner.cookie_scanner import CookieScanner
from backend.scanner.adaptive import AdaptiveConcurrencyManager
from backend.config import settings

logger = logging.getLogger(__name__)


async def scan_pages_parallel(
    urls: List[str],
    context: BrowserContext,
    max_concurrent: int = 5,
    on_progress: Optional[Callable] = None,
    batch_number: int = 1,
    total_batches: int = 1,
    scanned_count: int = 0,
    max_pages: int = 100
) -> List[dict]:
    """
    Scan multiple pages concurrently using asyncio with semaphore control.
    
    Args:
        urls: List of URLs to scan
        context: Playwright browser context
        max_concurrent: Maximum number of concurrent scans
        on_progress: Callback function for progress updates
        batch_number: Current batch number
        total_batches: Total number of batches
        scanned_count: Number of pages already scanned
        max_pages: Maximum total pages to scan (for progress calculation)
    
    Returns:
        List of scan results
    """
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(max_concurrent)
    scanner = CookieScanner(context)
    results = []
    
    async def scan_with_semaphore(url: str, index: int):
        """Scan a single page with semaphore control"""
        async with semaphore:
            try:
                # Progress callback before scanning
                if on_progress:
                    await on_progress({
                        "type": "progress",
                        "current": scanned_count + index + 1,
                        "total": max_pages,
                        "currentBatch": batch_number,
                        "totalBatches": total_batches,
                        "currentUrl": url,
                        "activeScanUrls": urls[:max_concurrent],  # Show first N active URLs
                        "status": "scanning",
                        "batchProgress": index + 1,
                        "batchSize": len(urls)
                    })
                
                # Scan the page
                result = await scanner.scan_page(url)
                
                # Minimal delay to prevent overwhelming the target
                await asyncio.sleep(settings.INTER_SCAN_DELAY)
                
                return result
                
            except Exception as e:
                logger.error(f"Error scanning {url}: {e}")
                return {
                    "url": url,
                    "domain": "",
                    "cookies": [],
                    "cookieCount": 0,
                    "error": str(e)
                }
    
    # Create tasks for all URLs
    tasks = [scan_with_semaphore(url, i) for i, url in enumerate(urls)]
    
    # Execute all tasks concurrently with error handling
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions and convert to list
    valid_results = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Task failed with exception: {result}")
        else:
            valid_results.append(result)
    
    return valid_results


async def deep_scan_parallel(
    start_url: str,
    context: BrowserContext,
    max_pages: int = 10,
    concurrency: int = 5,
    max_depth: int = 2,
    on_progress: Optional[Callable] = None
) -> dict:
    """
    Perform deep scan with parallel page scanning and depth tracking.
    Industry-grade: supports up to 20K pages and depth 500.
    
    Args:
        start_url: Starting URL to scan
        context: Playwright browser context
        max_pages: Maximum number of pages to scan
        concurrency: Number of pages to scan concurrently
        max_depth: Maximum crawl depth
        on_progress: Callback for progress updates
    
    Returns:
        Complete scan result with aggregated data
    """
    
    scanner = CookieScanner(context)
    page_results = []
    error_pages = []
    
    # Adaptive concurrency manager
    concurrency_manager = AdaptiveConcurrencyManager(initial_concurrency=concurrency)
    
    # Track visited URLs and URLs by depth
    visited_urls: Set[str] = set()
    urls_by_depth = {0: [start_url]}  # depth -> [urls]
    
    try:
        # Step 1: Scan the main page (depth 0)
        logger.info(f"Starting deep scan for: {start_url} (max_pages={max_pages}, max_depth={max_depth})")

        if on_progress:
            await on_progress({
                "type": "progress",
                "current": 0,
                "total": max_pages,
                "status": "starting",
                "message": "Scanning main page..."
            })

        try:
            main_result = await scanner.scan_page(start_url)
            page_results.append(main_result)
            visited_urls.add(start_url)

            if main_result.get("error"):
                error_pages.append(start_url)
                logger.warning(f"Error scanning main page: {main_result.get('error')}")

                # If the main page fails, return early with error
                if len(page_results) == 0 or not main_result.get("cookies"):
                    raise Exception(f"Failed to scan main page: {main_result.get('error')}")
        except Exception as e:
            logger.error(f"Critical error scanning main page {start_url}: {e}")
            raise Exception(f"Failed to scan main page: {str(e)}")
        
        # Step 2: Breadth-first crawl with depth tracking
        current_depth = 0
        
        while current_depth < max_depth and len(page_results) < max_pages:
            # Get URLs at current depth
            current_level_urls = urls_by_depth.get(current_depth, [])
            
            if not current_level_urls:
                logger.info(f"No more URLs at depth {current_depth}, stopping crawl")
                break
            
            # Extract links from current level in parallel
            next_level_urls = []
            
            if on_progress:
                await on_progress({
                    "type": "progress",
                    "current": len(page_results),
                    "total": max_pages,
                    "status": "extracting",
                    "message": f"Extracting links from depth {current_depth}..."
                })
            
            # Extract links from multiple pages in parallel
            # Extract from more pages to find more URLs (up to 50 pages per depth level)
            pages_to_extract_from = min(50, len(current_level_urls), max_pages - len(page_results))
            link_extraction_tasks = [
                scanner.extract_links(url, max_links=settings.BATCH_SIZE)
                for url in current_level_urls[:pages_to_extract_from]
            ]
            
            all_extracted_links = await asyncio.gather(*link_extraction_tasks, return_exceptions=True)
            
            # Collect all links
            for links in all_extracted_links:
                if isinstance(links, Exception):
                    logger.error(f"Link extraction failed: {links}")
                    continue
                
                # Add unvisited links to next level
                for link in links:
                    if link not in visited_urls and len(next_level_urls) < max_pages:
                        next_level_urls.append(link)
                        visited_urls.add(link)
                
                if len(next_level_urls) >= max_pages:
                    break
            
            # Store next level URLs
            if next_level_urls:
                urls_by_depth[current_depth + 1] = next_level_urls
                
                # Scan next level URLs in batches
                urls_to_scan = next_level_urls[:max_pages - len(page_results)]
                
                if urls_to_scan:
                    # Get current concurrency level
                    current_concurrency = concurrency_manager.get_concurrency()
                    
                    # Calculate batches
                    batch_size = min(current_concurrency, settings.BATCH_SIZE)
                    total_batches = (len(urls_to_scan) + batch_size - 1) // batch_size
                    
                    logger.info(
                        f"Scanning depth {current_depth + 1}: {len(urls_to_scan)} URLs "
                        f"in {total_batches} batches (concurrency={current_concurrency})"
                    )
                    
                    for batch_idx in range(total_batches):
                        if len(page_results) >= max_pages:
                            break
                        
                        start_idx = batch_idx * batch_size
                        end_idx = min(start_idx + batch_size, len(urls_to_scan))
                        batch_urls = urls_to_scan[start_idx:end_idx]
                        
                        # Scan batch in parallel
                        batch_start_time = time.time()
                        
                        batch_results = await scan_pages_parallel(
                            urls=batch_urls,
                            context=context,
                            max_concurrent=current_concurrency,
                            on_progress=on_progress,
                            batch_number=batch_idx + 1,
                            total_batches=total_batches,
                            scanned_count=len(page_results),
                            max_pages=max_pages
                        )
                        
                        batch_duration = time.time() - batch_start_time
                        
                        # Collect results and track performance
                        success_count = 0
                        failure_count = 0
                        
                        for result in batch_results:
                            page_results.append(result)
                            if result.get("error"):
                                error_pages.append(result["url"])
                                failure_count += 1
                            else:
                                success_count += 1
                        
                        # Update adaptive concurrency
                        concurrency_manager.record_batch_result(
                            success_count, failure_count, batch_duration
                        )
                        
                        # Log performance stats
                        stats = concurrency_manager.get_stats()
                        logger.info(
                            f"Batch {batch_idx + 1}/{total_batches} complete: "
                            f"{success_count} success, {failure_count} failures, "
                            f"{batch_duration:.2f}s (success rate: {stats['success_rate']:.2%})"
                        )
            
            # Move to next depth
            current_depth += 1
        
        # Step 3: Aggregate results
        if on_progress:
            await on_progress({
                "type": "progress",
                "current": len(page_results),
                "total": max_pages,
                "status": "aggregating",
                "message": "Aggregating results..."
            })
        
        # Deduplicate cookies
        unique_cookies = scanner.deduplicate_cookies(page_results)
        
        # Calculate statistics
        from backend.scanner.classifier import CookieClassifier
        statistics = CookieClassifier.aggregate_statistics(unique_cookies)
        
        # Add performance stats
        perf_stats = concurrency_manager.get_stats()
        statistics["performance"] = perf_stats
        
        # Build final result
        from datetime import datetime
        
        result = {
            "scanType": "deep",
            "domain": urlparse(start_url).netloc,
            "scannedUrl": start_url,
            "scannedAt": datetime.now().isoformat(),
            "cookies": unique_cookies,
            "totalCount": len(unique_cookies),
            "statistics": statistics,
            "pageResults": page_results,
            "errorPages": error_pages if error_pages else None,
            "maxDepthReached": current_depth,
            "totalPagesScanned": len(page_results)
        }
        
        # Final progress update
        if on_progress:
            await on_progress({
                "type": "complete",
                "current": len(page_results),
                "total": max_pages,
                "status": "complete",
                "message": f"Scan complete! Found {len(unique_cookies)} unique cookies across {len(page_results)} pages"
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Deep scan failed: {e}")
        
        if on_progress:
            await on_progress({
                "type": "error",
                "current": len(page_results),
                "total": max_pages,
                "status": "error",
                "message": str(e)
            })
        
        raise

