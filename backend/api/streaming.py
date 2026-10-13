import json
import asyncio
from typing import AsyncGenerator
import logging

from backend.models import ScanRequest, ScanProgress
from backend.scanner.browser import browser_manager
from backend.scanner.parallel import deep_scan_parallel
from backend.scanner.cookie_scanner import CookieScanner

logger = logging.getLogger(__name__)


async def scan_stream_generator(request: ScanRequest) -> AsyncGenerator[str, None]:
    """
    Generate Server-Sent Events stream for scan progress.
    
    Yields SSE-formatted messages with scan progress and results.
    """
    
    context = None
    
    try:
        # Start browser if not already started
        await browser_manager.start()
        
        # Create browser context
        context = await browser_manager.create_context()
        
        # Progress callback queue
        progress_queue = asyncio.Queue()
        
        async def progress_callback(progress_data: dict):
            """Callback to send progress updates"""
            await progress_queue.put(progress_data)
        
        # Start scan task
        if request.scanType == "deep":
            scan_task = asyncio.create_task(
                deep_scan_parallel(
                    start_url=request.url,
                    context=context,
                    max_pages=request.maxPages,
                    concurrency=request.concurrency,
                    max_depth=request.maxDepth,
                    on_progress=progress_callback,
                    include_subdomains=request.includeSubdomains
                )
            )
        else:
            # Quick scan - just scan the main page
            scanner = CookieScanner(context)
            scan_task = asyncio.create_task(scanner.scan_page(request.url))
        
        # Stream progress updates
        scan_complete = False
        result = None
        
        while not scan_complete:
            try:
                # Wait for progress update with timeout
                progress_data = await asyncio.wait_for(
                    progress_queue.get(),
                    timeout=0.5
                )
                
                # Send progress as SSE (but not if it's the complete message - we'll send that with the result)
                if progress_data.get("type") != "complete":
                    yield f"data: {json.dumps(progress_data)}\n\n"

                # Check if scan is complete
                if progress_data.get("type") == "complete":
                    # Wait for the scan task to get the actual result
                    try:
                        result = await scan_task
                    except Exception as e:
                        logger.error(f"Scan task failed: {e}")
                        error_data = {
                            "type": "error",
                            "message": str(e),
                            "status": "error"
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                    scan_complete = True
                elif progress_data.get("type") == "error":
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    scan_complete = True

            except asyncio.TimeoutError:
                # Check if scan task is done
                if scan_task.done():
                    try:
                        result = await scan_task
                        scan_complete = True
                    except Exception as e:
                        logger.error(f"Scan task failed: {e}")
                        error_data = {
                            "type": "error",
                            "message": str(e),
                            "status": "error"
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                        scan_complete = True

        # Send final result if we have one
        logger.info(f"Checking final result: result={result is not None}, type={type(result).__name__ if result else 'None'}")

        if result and not isinstance(result, dict):
            # For quick scan, format the result
            from datetime import datetime
            from urllib.parse import urlparse
            from backend.scanner.classifier import CookieClassifier

            logger.info("Sending quick scan result")
            final_result = {
                "type": "complete",
                "result": {
                    "scanType": "quick",
                    "domain": urlparse(request.url).netloc,
                    "scannedUrl": request.url,
                    "scannedAt": datetime.now().isoformat(),
                    "cookies": result.get("cookies", []),
                    "totalCount": result.get("cookieCount", 0),
                    "statistics": CookieClassifier.aggregate_statistics(result.get("cookies", [])),
                    "pageResults": [result]
                },
                "status": "complete"
            }
            yield f"data: {json.dumps(final_result)}\n\n"
        elif result:
            # Deep scan result
            logger.info(f"Sending deep scan result with {len(result.get('cookies', []))} cookies")
            final_result = {
                "type": "complete",
                "result": result,
                "status": "complete"
            }
            yield f"data: {json.dumps(final_result)}\n\n"
        else:
            logger.warning("No result to send!")
        
    except Exception as e:
        logger.error(f"Stream error: {e}")
        error_data = {
            "type": "error",
            "message": str(e),
            "status": "error"
        }
        yield f"data: {json.dumps(error_data)}\n\n"

    finally:
        # Cancel scan task if still running
        if 'scan_task' in locals() and not scan_task.done():
            scan_task.cancel()
            try:
                await scan_task
            except asyncio.CancelledError:
                logger.info("Scan task cancelled")
            except Exception as e:
                logger.error(f"Error cancelling scan task: {e}")

        # Clean up context - wrap in try/except to handle already closed contexts
        if context:
            try:
                await context.close()
            except Exception as e:
                logger.warning(f"Context close error (may be already closed): {e}")
