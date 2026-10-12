import asyncio
import json
import logging
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.api.category_routes import router as category_router
from backend.api.ml_routes import router as ml_router
from backend.config import settings
from backend.models import HealthResponse, ScanRequest
from backend.scanner.classifier import CookieClassifier
from backend.scanner.cookie_scanner import CookieScanner
from backend.scanner.parallel import deep_scan_parallel

logger = logging.getLogger(__name__)

router = APIRouter()
router.include_router(category_router, prefix="/categories", tags=["categories"])
router.include_router(ml_router, prefix="/v1/ml", tags=["ml-classification"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
    )


def _quick_scan_result(request: ScanRequest, page_result: dict) -> dict:
    cookies = page_result.get("cookies", [])
    return {
        "scanType": "quick",
        "domain": urlparse(request.url).netloc,
        "scannedUrl": request.url,
        "scannedAt": datetime.now().isoformat(),
        "cookies": cookies,
        "totalCount": page_result.get("cookieCount", 0),
        "statistics": CookieClassifier.aggregate_statistics(cookies),
        "pageResults": [page_result],
        "totalPagesScanned": 1,
        "dataSource": "browser_scan",
    }


@router.post("/scan-stream")
async def scan_website_stream(request: ScanRequest):
    """Stream real browser scan progress. Browser failures are explicit errors."""
    from playwright.async_api import async_playwright

    # Fail before opening an SSE response so clients receive a useful HTTP status.
    try:
        async with async_playwright() as playwright:
            browser_type = getattr(playwright, settings.BROWSER_TYPE.lower())
            browser = await browser_type.launch(headless=True)
            await browser.close()
    except Exception as exc:
        logger.error("Browser preflight failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"Browser scanning unavailable: {exc}",
        ) from exc

    async def real_stream_generator():
        playwright = None
        browser = None
        context = None
        scan_task = None
        try:
            playwright = await async_playwright().start()
            browser_type = getattr(playwright, settings.BROWSER_TYPE.lower())
            browser = await browser_type.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
                ignore_https_errors=True,
                locale="en-US",
                timezone_id="America/New_York",
            )
            context.set_default_timeout(settings.PAGE_TIMEOUT)
            progress_queue = asyncio.Queue()

            async def progress_callback(progress_data):
                await progress_queue.put(progress_data)

            if request.scanType == "deep":
                scan_task = asyncio.create_task(
                    deep_scan_parallel(
                        start_url=request.url,
                        context=context,
                        max_pages=request.maxPages,
                        concurrency=request.concurrency,
                        max_depth=request.maxDepth,
                        include_subdomains=request.includeSubdomains,
                        on_progress=progress_callback,
                    )
                )
            else:
                async def quick_scan():
                    scanner = CookieScanner(context)
                    await progress_callback({
                        "type": "progress",
                        "current": 1,
                        "total": 1,
                        "status": "scanning",
                        "currentUrl": request.url,
                    })
                    page_result = await scanner.scan_page(request.url)
                    if page_result.get("error"):
                        raise RuntimeError(page_result["error"])
                    return _quick_scan_result(request, page_result)

                scan_task = asyncio.create_task(quick_scan())

            while not scan_task.done():
                try:
                    progress = await asyncio.wait_for(progress_queue.get(), timeout=1.0)
                    if progress.get("type") != "complete":
                        yield f"data: {json.dumps(progress)}\n\n"
                except asyncio.TimeoutError:
                    continue

            result = await scan_task
            if request.scanType == "deep":
                result["dataSource"] = "browser_scan"
            yield f"data: {json.dumps({'type': 'complete', 'result': result})}\n\n"
        except Exception as exc:
            logger.error("Streaming scan failed: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'status': 'error', 'message': str(exc)})}\n\n"
        finally:
            if scan_task and not scan_task.done():
                scan_task.cancel()
            if context:
                await context.close()
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()

    return StreamingResponse(
        real_stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/scan")
async def scan_website(request: ScanRequest):
    """Run a real browser scan. Never substitute fabricated cookie data."""
    from backend.scanner.browser import browser_manager

    context = None
    try:
        await browser_manager.start()
        context = await browser_manager.create_context()
        if request.scanType == "deep":
            result = await deep_scan_parallel(
                start_url=request.url,
                context=context,
                max_pages=request.maxPages,
                concurrency=request.concurrency,
                max_depth=request.maxDepth,
                include_subdomains=request.includeSubdomains,
            )
            result["dataSource"] = "browser_scan"
            return result

        scanner = CookieScanner(context)
        page_result = await scanner.scan_page(request.url)
        if page_result.get("error"):
            raise RuntimeError(page_result["error"])
        return _quick_scan_result(request, page_result)
    except Exception as exc:
        logger.error("Browser scan failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"Browser scanning unavailable: {exc}",
        ) from exc
    finally:
        if context:
            await context.close()
