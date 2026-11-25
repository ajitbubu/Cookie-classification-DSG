import asyncio
import time
from types import SimpleNamespace
from typing import List, Callable, Optional, Set, Tuple
from playwright.async_api import BrowserContext
from urllib.parse import urlparse
import logging

from backend.scanner.cmp_declarations import annotate_cookies
from backend.scanner.cookie_scanner import CookieScanner, site_root
from backend.scanner.adaptive import AdaptiveConcurrencyManager
from backend.config import settings

logger = logging.getLogger(__name__)


async def retry_failed_pages(scanner, page_results: List[dict], error_pages: List[str], start_url: str,
                             on_progress: Optional[Callable] = None, max_pages: int = 0) -> int:
    """Re-scan failed pages sequentially; a success replaces the failed entry. Returns how many recovered."""
    retry = [url for url in dict.fromkeys(error_pages) if url != start_url][:settings.MAX_PAGE_RETRIES]
    recovered = 0
    for index, url in enumerate(retry):
        if on_progress:
            await on_progress({
                "type": "progress", "current": len(page_results), "total": max_pages, "status": "retrying",
                "currentUrl": url, "message": f"Retrying failed page {index + 1} of {len(retry)}...",
            })
        result = await scanner.scan_page(url)
        if result.get("error"):
            continue
        page_results[:] = [r for r in page_results if not (r.get("url") == url and r.get("error"))] + [result]
        error_pages[:] = [u for u in error_pages if u != url]
        recovered += 1
    if retry:
        logger.info(f"Retried {len(retry)} failed pages one at a time: {recovered} recovered, {len(retry) - recovered} still failing")
    return recovered


async def deep_scan_parallel(
    start_url: str,
    context: BrowserContext,
    max_pages: int = 10,
    concurrency: int = 5,
    max_depth: int = 2,
    on_progress: Optional[Callable] = None,
    include_subdomains: bool = False
) -> dict:
    """
    Perform deep scan: a breadth-first crawl that scans each page once.

    Each page's cookies and links come from the same visit. A fixed set of crawl tasks
    takes pages from one queue, so a slow page holds up only its own task, not a batch.
    Pages open at once start at ``concurrency``, capped at START_CONCURRENT_PAGES, and
    adapt up to MAX_CONCURRENT_PAGES as the site copes (AdaptiveConcurrencyManager).

    Args:
        start_url: Starting URL to scan
        context: Playwright browser context
        max_pages: Maximum number of pages to scan
        concurrency: Number of pages to scan concurrently at the start (capped at START_CONCURRENT_PAGES)
        max_depth: Maximum crawl depth
        on_progress: Callback for progress updates
        include_subdomains: Also follow links to the site's subdomains

    Returns:
        Complete scan result with aggregated data
    """

    scanner = CookieScanner(context)
    root = site_root(start_url)
    page_results = []
    declarations = []  # the start page's CMP declaration, applied to every page's cookies
    error_pages = []

    # Adaptive concurrency manager
    concurrency_manager = AdaptiveConcurrencyManager(initial_concurrency=concurrency)

    try:
        # Step 1: Scan the main page (depth 0)
        logger.info(f"Starting deep scan for: {start_url} (max_pages={max_pages}, max_depth={max_depth}, "
                    f"include_subdomains={include_subdomains}, concurrency={concurrency_manager.get_concurrency()})")

        if on_progress:
            await on_progress({
                "type": "progress",
                "current": 0,
                "total": max_pages,
                "status": "starting",
                "message": "Scanning main page..."
            })

        follow_links = max_depth > 0 and max_pages > 1
        try:
            main_result = await scanner.scan_page(start_url, read_cmp=True, links=follow_links, settle=follow_links,
                                                  include_subdomains=include_subdomains, root=root)
            declarations = main_result.pop("_declarations", [])
            start_links = main_result.pop("_links", [])
            page_results.append(main_result)

            if main_result.get("error"):
                error_pages.append(start_url)
                logger.warning(f"Error scanning main page: {main_result.get('error')}")

                # If the main page fails, return early with error
                if len(page_results) == 0 or not main_result.get("cookies"):
                    raise Exception(f"Failed to scan main page: {main_result.get('error')}")
        except Exception as e:
            logger.error(f"Critical error scanning main page {start_url}: {e}")
            raise Exception(f"Failed to scan main page: {str(e)}")

        if not start_links and follow_links:
            # Nothing to follow from the first load (links rendered late, or none in scope):
            # the slower reader waits for the network to settle, then tries the sitemap and
            # common paths. Only the start page gets this second load.
            start_links = await scanner.extract_links(start_url, max_links=settings.BATCH_SIZE,
                                                      include_subdomains=include_subdomains, root=root)

        # Step 2: Breadth-first crawl. Queued URLs are counted against max_pages when queued.
        visited_urls: Set[str] = {start_url}
        queue: "asyncio.Queue[Tuple[str, int]]" = asyncio.Queue()
        depth_of = {start_url: 0}
        active_urls: List[str] = []
        deepest = 0

        def enqueue(links: List[str], depth: int):
            if depth > max_depth:
                return
            for link in links:
                if len(visited_urls) >= max_pages:
                    return
                if link not in visited_urls:
                    visited_urls.add(link)
                    depth_of[link] = depth
                    queue.put_nowait((link, depth))

        async def scan_and_follow(url: str) -> dict:
            """Scan one page and queue its links; used by the crawl and by the retries."""
            depth = depth_of[url]
            # No link reading once the queue holds max_pages URLs: none could be followed.
            # Pages whose links are read also settle, as the old separate link load did
            # (it waited for network idle): late requests set cookies others never see.
            read_links = depth < max_depth and len(visited_urls) < max_pages
            result = await scanner.scan_page(url, links=read_links, settle=read_links,
                                             include_subdomains=include_subdomains, root=root)
            enqueue(result.pop("_links", []), depth + 1)
            return result

        async def scan_one(url: str, depth: int):
            nonlocal deepest
            if on_progress:
                await on_progress({
                    "type": "progress",
                    "current": len(page_results) + 1,
                    "total": max_pages,
                    "currentUrl": url,
                    "activeScanUrls": list(active_urls),
                    "status": "scanning",
                })
            started = time.time()
            result = await scan_and_follow(url)
            page_results.append(result)
            deepest = max(deepest, depth)
            failed = bool(result.get("error"))
            if failed:
                error_pages.append(url)
            concurrency_manager.record_batch_result(0 if failed else 1, 1 if failed else 0, time.time() - started)
            # Minimal delay to prevent overwhelming the target
            await asyncio.sleep(settings.INTER_SCAN_DELAY)

        async def crawl(slot: int):
            while True:
                # Slots above the current concurrency sit out until it rises again
                while slot >= concurrency_manager.get_concurrency():
                    await asyncio.sleep(0.2)
                url, depth = await queue.get()
                if slot >= concurrency_manager.get_concurrency():
                    # Concurrency dropped while this slot waited for work: hand the page back
                    queue.put_nowait((url, depth))
                    queue.task_done()
                    continue
                active_urls.append(url)
                try:
                    await scan_one(url, depth)
                except Exception as e:  # a crawl task must not die: queue.join() would wait forever
                    logger.error(f"Error scanning {url}: {e}")
                    page_results.append({"url": url, "domain": "", "cookies": [], "cookieCount": 0, "error": str(e)})
                    error_pages.append(url)
                finally:
                    active_urls.remove(url)
                    queue.task_done()

        async def crawl_queue():
            crawlers = [asyncio.create_task(crawl(slot)) for slot in range(concurrency_manager.max_concurrency)]
            try:
                await queue.join()
            finally:
                for task in crawlers:
                    task.cancel()
                await asyncio.gather(*crawlers, return_exceptions=True)

        enqueue(start_links, 1)
        await crawl_queue()

        # Step 2b: retry failed pages one at a time. Some sites abort navigations when
        # many of their pages load at once in one browser (exlservice.com: 9 of 12 pages
        # failed at concurrency 8, none at 1), and those pages load fine alone. A recovered
        # page's links are queued too, then crawled (pages failing in that pass stay failed).
        retry_scanner = SimpleNamespace(scan_page=scan_and_follow)
        await retry_failed_pages(retry_scanner, page_results, error_pages, start_url, on_progress, max_pages)
        if not queue.empty():
            await crawl_queue()

        # Step 3: Aggregate results
        if on_progress:
            await on_progress({
                "type": "progress",
                "current": len(page_results),
                "total": max_pages,
                "status": "aggregating",
                "message": "Aggregating results..."
            })

        # Deduplicate cookies, then apply the start page's CMP declaration to every page's cookies
        unique_cookies = scanner.deduplicate_cookies(page_results)
        annotate_cookies(unique_cookies, declarations)

        # Calculate statistics
        from backend.scanner.classifier import CookieClassifier
        statistics = CookieClassifier.aggregate_statistics(unique_cookies)

        # Add performance stats
        perf_stats = concurrency_manager.get_stats()
        statistics["performance"] = perf_stats
        logger.info(f"Deep scan of {start_url} done: {len(page_results)} pages to depth {deepest}, "
                    f"{len(error_pages)} failed, concurrency ended at {perf_stats['current_concurrency']}")

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
            "maxDepthReached": deepest,
            "totalPagesScanned": len(page_results),
            "cmp": page_results[0].get("cmp") if page_results else None,
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
