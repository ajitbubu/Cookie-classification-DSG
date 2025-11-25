from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import logging

from backend.models import ScanRequest, HealthResponse
from backend.api.streaming import scan_stream_generator
from backend.api.category_routes import router as category_router
from backend.api.ml_routes import router as ml_router

logger = logging.getLogger(__name__)

router = APIRouter()

# Include category management routes
router.include_router(category_router, prefix="/categories", tags=["categories"])

# Include ML classification routes
router.include_router(ml_router, prefix="/v1/ml", tags=["ml-classification"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )


@router.post("/scan-stream")
async def scan_website_stream(request: ScanRequest):
    """
    Stream scan progress using Server-Sent Events.
    
    This endpoint provides real-time updates as the scan progresses,
    including batch information and parallel scanning status.
    """
    try:
        logger.info(f"Starting {request.scanType} scan for: {request.url}")
        logger.info(f"Config: maxPages={request.maxPages}, concurrency={request.concurrency}")
        
        return StreamingResponse(
            scan_stream_generator(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
        
    except Exception as e:
        logger.error(f"Error starting scan stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan")
async def scan_website(request: ScanRequest):
    """
    Regular HTTP endpoint for scanning (non-streaming).
    
    Returns the complete scan result after all pages are scanned.
    """
    try:
        from backend.scanner.browser import browser_manager
        from backend.scanner.parallel import deep_scan_parallel
        from backend.scanner.cookie_scanner import CookieScanner
        
        logger.info(f"Starting {request.scanType} scan for: {request.url}")
        
        # Start browser
        await browser_manager.start()
        context = await browser_manager.create_context()
        
        try:
            if request.scanType == "deep":
                result = await deep_scan_parallel(
                    start_url=request.url,
                    context=context,
                    max_pages=request.maxPages,
                    concurrency=request.concurrency,
                    max_depth=request.maxDepth
                )
            else:
                # Quick scan
                scanner = CookieScanner(context)
                page_result = await scanner.scan_page(request.url)
                
                from urllib.parse import urlparse
                from backend.scanner.classifier import CookieClassifier
                
                result = {
                    "scanType": "quick",
                    "domain": urlparse(request.url).netloc,
                    "scannedUrl": request.url,
                    "scannedAt": datetime.now().isoformat(),
                    "cookies": page_result.get("cookies", []),
                    "totalCount": page_result.get("cookieCount", 0),
                    "statistics": CookieClassifier.aggregate_statistics(page_result.get("cookies", [])),
                    "pageResults": [page_result]
                }
            
            return result
            
        finally:
            await context.close()
            
    except Exception as e:
        logger.error(f"Error during scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))
