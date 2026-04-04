"""
Category Management Routes
Allows users to update cookie categories and persist changes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional
import logging
from datetime import datetime
import re

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid cookie categories
VALID_CATEGORIES = [
    "Strictly Necessary",
    "Functional",
    "Analytics",
    "Marketing",
    "Preferences",
    "Uncategorized",
    "Unknown"  # ML classifier returns "Unknown" for uncertain classifications
]


def validate_category(category: str) -> str:
    """Validate that category is one of the allowed values"""
    if category not in VALID_CATEGORIES:
        raise ValueError(
            f"Invalid category '{category}'. "
            f"Must be one of: {', '.join(VALID_CATEGORIES)}"
        )
    return category


def validate_cookie_name(name: str) -> str:
    """Validate cookie name format"""
    if not name or len(name.strip()) == 0:
        raise ValueError("Cookie name cannot be empty")
    
    if len(name) > 255:
        raise ValueError("Cookie name too long (max 255 characters)")
    
    # Check for valid characters (alphanumeric, underscore, hyphen, dot)
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', name):
        raise ValueError(
            "Cookie name contains invalid characters. "
            "Only alphanumeric, underscore, hyphen, and dot allowed"
        )
    
    return name


def validate_domain(domain: str) -> str:
    """Validate domain format"""
    if not domain or len(domain.strip()) == 0:
        return domain  # Empty domain is allowed (NULL in database)
    
    if len(domain) > 255:
        raise ValueError("Domain too long (max 255 characters)")
    
    # Basic domain validation (simplified)
    if not re.match(r'^[a-zA-Z0-9\-\.]+$', domain):
        raise ValueError(
            "Domain contains invalid characters. "
            "Only alphanumeric, hyphen, and dot allowed"
        )
    
    return domain


class CategoryUpdateRequest(BaseModel):
    """Request model for updating cookie category"""
    scan_id: str
    cookie_name: str
    cookie_domain: str
    old_category: str
    new_category: str
    ml_confidence: Optional[float] = None  # ML confidence score
    user_id: Optional[str] = None
    
    @validator('cookie_name')
    def validate_cookie_name_field(cls, v):
        return validate_cookie_name(v)
    
    @validator('cookie_domain')
    def validate_domain_field(cls, v):
        return validate_domain(v)
    
    @validator('old_category', 'new_category')
    def validate_category_field(cls, v):
        return validate_category(v)
    
    @validator('ml_confidence')
    def validate_confidence(cls, v):
        if v is not None and (v < 0 or v > 1):
            raise ValueError("ML confidence must be between 0 and 1")
        return v


class KnowledgeBaseQueryRequest(BaseModel):
    """Request model for querying knowledge base"""
    cookie_name: str
    cookie_domain: str
    
    @validator('cookie_name')
    def validate_cookie_name_field(cls, v):
        return validate_cookie_name(v)
    
    @validator('cookie_domain')
    def validate_domain_field(cls, v):
        return validate_domain(v)


class CategoryUpdateResponse(BaseModel):
    """Response model for category update"""
    success: bool
    message: str
    cookie_name: str
    old_category: str
    new_category: str
    updated_at: str
    knowledge_base_updated: bool = False  # Flag indicating KB update
    feedback_recorded: bool = False  # Flag indicating feedback recorded


@router.post("/update-category", response_model=CategoryUpdateResponse)
async def update_cookie_category(request: CategoryUpdateRequest):
    """
    Update the category of a specific cookie in a scan.
    This creates a category override that persists across sessions.
    
    The update will:
    1. Store the override in the knowledge base (database)
    2. Record ML feedback if the category differs from ML prediction
    3. Fall back to file storage if database is unavailable
    """
    try:
        from backend.db.category_manager import get_category_manager
        
        manager = get_category_manager()
        
        # Update category with ML confidence
        success = await manager.update_category(
            scan_id=request.scan_id,
            cookie_name=request.cookie_name,
            cookie_domain=request.cookie_domain,
            old_category=request.old_category,
            new_category=request.new_category,
            ml_confidence=request.ml_confidence,
            user_id=request.user_id
        )
        
        if success:
            # Check if knowledge base was updated
            kb_updated = manager.db_pool is not None
            
            # Check if feedback was recorded (only if categories differ)
            feedback_recorded = (
                kb_updated and 
                request.old_category != request.new_category
            )
            
            logger.info(
                f"Category updated: {request.cookie_name} "
                f"from {request.old_category} to {request.new_category} "
                f"(KB: {kb_updated}, Feedback: {feedback_recorded})"
            )
            
            return CategoryUpdateResponse(
                success=True,
                message="Category updated successfully",
                cookie_name=request.cookie_name,
                old_category=request.old_category,
                new_category=request.new_category,
                updated_at=datetime.now().isoformat(),
                knowledge_base_updated=kb_updated,
                feedback_recorded=feedback_recorded
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to update category")
            
    except Exception as e:
        logger.error(f"Error updating category: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category-history/{scan_id}")
async def get_category_history(scan_id: str):
    """
    Get the history of category changes for a specific scan.
    """
    try:
        from backend.db.category_manager import CategoryManager
        
        manager = CategoryManager()
        history = await manager.get_category_history(scan_id)
        
        return {
            "scan_id": scan_id,
            "changes": history,
            "total_changes": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error fetching category history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-categories")
async def get_available_categories():
    """
    Get list of available cookie categories.
    """
    return {
        "categories": [
            {
                "value": "Strictly Necessary",
                "label": "Strictly Necessary",
                "description": "Essential for website functionality",
                "color": "#00C4A8"
            },
            {
                "value": "Functional",
                "label": "Functional",
                "description": "Enhance website features",
                "color": "#3D8BFF"
            },
            {
                "value": "Analytics",
                "label": "Analytics",
                "description": "Track website usage and performance",
                "color": "#FFBC32"
            },
            {
                "value": "Marketing",
                "label": "Marketing",
                "description": "Advertising and targeting",
                "color": "#FF4D4D"
            },
            {
                "value": "Preferences",
                "label": "Preferences",
                "description": "Remember user settings",
                "color": "#9B59B6"
            },
            {
                "value": "Uncategorized",
                "label": "Uncategorized",
                "description": "Not yet classified",
                "color": "#95A5A6"
            },
            {
                "value": "Unknown",
                "label": "Unknown",
                "description": "Unable to classify with confidence",
                "color": "#7F8C8D"
            }
        ]
    }


@router.post("/bulk-update-categories")
async def bulk_update_categories(updates: list[CategoryUpdateRequest]):
    """
    Update multiple cookie categories at once.
    """
    try:
        from backend.db.category_manager import get_category_manager
        
        manager = get_category_manager()
        results = []
        
        for update in updates:
            success = await manager.update_category(
                scan_id=update.scan_id,
                cookie_name=update.cookie_name,
                cookie_domain=update.cookie_domain,
                old_category=update.old_category,
                new_category=update.new_category,
                ml_confidence=update.ml_confidence,
                user_id=update.user_id
            )
            
            results.append({
                "cookie_name": update.cookie_name,
                "success": success
            })
        
        successful = sum(1 for r in results if r["success"])
        
        return {
            "total": len(updates),
            "successful": successful,
            "failed": len(updates) - successful,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in bulk update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class KnowledgeBaseQueryRequest(BaseModel):
    """Request model for querying knowledge base"""
    cookie_name: str
    cookie_domain: str


@router.post("/query-knowledge-base")
async def query_knowledge_base(request: KnowledgeBaseQueryRequest):
    """
    Query the knowledge base for a cookie's stored category.
    
    Returns the stored category if found, or indicates not found.
    Useful for checking if a cookie has a user override or pattern match.
    """
    try:
        from backend.db.category_manager import get_category_manager
        
        manager = get_category_manager()
        
        result = await manager.query_knowledge_base(
            cookie_name=request.cookie_name,
            cookie_domain=request.cookie_domain
        )
        
        if result:
            return {
                "found": True,
                "cookie_name": request.cookie_name,
                "cookie_domain": request.cookie_domain,
                "category": result['category'],
                "confidence": result['confidence'],
                "source": result['source'],
                "times_seen": result['times_seen'],
                "last_seen": result['last_seen'].isoformat() if result['last_seen'] else None,
                "metadata": result['metadata']
            }
        else:
            return {
                "found": False,
                "cookie_name": request.cookie_name,
                "cookie_domain": request.cookie_domain,
                "message": "No knowledge base entry found for this cookie"
            }
            
    except Exception as e:
        logger.error(f"Error querying knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns")
async def get_cookie_patterns():
    """
    Get all active cookie patterns.
    
    Returns the list of patterns used for automatic categorization,
    including pattern, category, vendor, and priority information.
    """
    try:
        from backend.db.category_manager import get_category_manager
        
        manager = get_category_manager()
        
        patterns = await manager.get_patterns()
        
        return {
            "total": len(patterns),
            "patterns": patterns
        }
        
    except Exception as e:
        logger.error(f"Error fetching patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))
