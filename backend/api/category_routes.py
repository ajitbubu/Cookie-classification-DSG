"""
Category Management Routes
Allows users to update cookie categories and persist changes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()


class CategoryUpdateRequest(BaseModel):
    """Request model for updating cookie category"""
    scan_id: str
    cookie_name: str
    cookie_domain: str
    old_category: str
    new_category: str
    user_id: Optional[str] = None


class CategoryUpdateResponse(BaseModel):
    """Response model for category update"""
    success: bool
    message: str
    cookie_name: str
    old_category: str
    new_category: str
    updated_at: str


@router.post("/update-category", response_model=CategoryUpdateResponse)
async def update_cookie_category(request: CategoryUpdateRequest):
    """
    Update the category of a specific cookie in a scan.
    This creates a category override that persists across sessions.
    """
    try:
        from backend.db.category_manager import CategoryManager
        
        manager = CategoryManager()
        
        # Update category in database
        success = await manager.update_category(
            scan_id=request.scan_id,
            cookie_name=request.cookie_name,
            cookie_domain=request.cookie_domain,
            old_category=request.old_category,
            new_category=request.new_category,
            user_id=request.user_id
        )
        
        if success:
            logger.info(
                f"Category updated: {request.cookie_name} "
                f"from {request.old_category} to {request.new_category}"
            )
            
            return CategoryUpdateResponse(
                success=True,
                message="Category updated successfully",
                cookie_name=request.cookie_name,
                old_category=request.old_category,
                new_category=request.new_category,
                updated_at=datetime.now().isoformat()
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
            }
        ]
    }


@router.post("/bulk-update-categories")
async def bulk_update_categories(updates: list[CategoryUpdateRequest]):
    """
    Update multiple cookie categories at once.
    """
    try:
        from backend.db.category_manager import CategoryManager
        
        manager = CategoryManager()
        results = []
        
        for update in updates:
            success = await manager.update_category(
                scan_id=update.scan_id,
                cookie_name=update.cookie_name,
                cookie_domain=update.cookie_domain,
                old_category=update.old_category,
                new_category=update.new_category,
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
