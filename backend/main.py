from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import logging
import numpy as np
import os
from typing import Any

from backend.api.routes import router
from backend.config import settings


# Custom JSON encoder to handle numpy types
class NumpyEncoder:
    """Custom encoder to convert numpy types to Python types"""
    
    @staticmethod
    def convert(obj: Any) -> Any:
        """Convert numpy types to Python native types"""
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: NumpyEncoder.convert(value) for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [NumpyEncoder.convert(item) for item in obj]
        return obj

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


# Middleware to convert numpy types in responses
@app.middleware("http")
async def convert_numpy_middleware(request, call_next):
    """Convert numpy types in response data"""
    response = await call_next(request)
    return response

# Include API routes
app.include_router(router, prefix="/api")

# Serve built frontend (static files)
_static_dir = os.environ.get("STATIC_DIR", "/tmp/cookie-build")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for all non-API routes"""
        file_path = os.path.join(_static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))


@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    logger.info("Starting Cookie Scanner API...")
    logger.info(f"Allowed origins: {settings.allowed_origins_list}")
    logger.info(f"Browser type: {settings.BROWSER_TYPE}")
    logger.info(f"Max concurrent pages: {settings.MAX_CONCURRENT_PAGES}")
    
    # Initialize database connection
    try:
        from backend.db.database import initialize_database, get_db_manager
        from backend.db.category_manager import CategoryManager, set_category_manager
        
        logger.info("Initializing database connection...")
        db_manager = await initialize_database()
        
        if db_manager and db_manager.pool:
            logger.info("Database connection established successfully")
            
            # Create CategoryManager with database pool
            category_manager = CategoryManager(db_pool=db_manager.pool)
            set_category_manager(category_manager)
            
            # Load patterns into memory cache
            patterns_loaded = await category_manager.load_patterns()
            if patterns_loaded:
                logger.info(f"Loaded {len(category_manager.patterns_cache)} cookie patterns")
            else:
                logger.warning("Failed to load cookie patterns")
        else:
            logger.warning("Database pool not available, using file storage fallback")
            # Create CategoryManager without database pool (file storage only)
            category_manager = CategoryManager(db_pool=None)
            set_category_manager(category_manager)
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.warning("Falling back to file storage for category management")
        
        # Create CategoryManager without database pool (file storage only)
        from backend.db.category_manager import CategoryManager, set_category_manager
        category_manager = CategoryManager(db_pool=None)
        set_category_manager(category_manager)


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Shutting down Cookie Scanner API...")
    
    # Close database connections
    try:
        from backend.db.database import shutdown_database
        logger.info("Closing database connections...")
        await shutdown_database()
        logger.info("Database connections closed successfully")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")
    
    # Close browser manager
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
