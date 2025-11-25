from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.api.routes import router
from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Cookie Scanner API",
    description="Server-side parallel cookie scanning with Playwright",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    logger.info("Starting Cookie Scanner API...")
    logger.info(f"Allowed origins: {settings.allowed_origins_list}")
    logger.info(f"Browser type: {settings.BROWSER_TYPE}")
    logger.info(f"Max concurrent pages: {settings.MAX_CONCURRENT_PAGES}")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Shutting down Cookie Scanner API...")
    from backend.scanner.browser import browser_manager
    await browser_manager.close()


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Cookie Scanner API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/health",
            "scan_stream": "/api/scan-stream",
            "scan": "/api/scan"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
        log_level="info"
    )
