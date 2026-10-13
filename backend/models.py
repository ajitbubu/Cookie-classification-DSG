from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime


class ScanRequest(BaseModel):
    """Request model for cookie scanning"""
    url: str
    scanType: str = "quick"  # "quick" or "deep"
    maxPages: int = 20000  # Industry-grade: 20K pages
    concurrency: int = 50  # High-performance parallel scanning
    maxDepth: int = 500  # Industry-grade: deep crawling
    includeSubdomains: bool = False  # Deep Scan "Follow internal + subdomain links"
    
    @field_validator('scanType')
    @classmethod
    def validate_scan_type(cls, v):
        if v not in ['quick', 'deep']:
            raise ValueError('scanType must be "quick" or "deep"')
        return v
    
    @field_validator('maxPages')
    @classmethod
    def validate_max_pages(cls, v):
        if v < 1 or v > 20000:  # Industry-grade: up to 20K pages
            raise ValueError('maxPages must be between 1 and 20000')
        return v
    
    @field_validator('concurrency')
    @classmethod
    def validate_concurrency(cls, v):
        if v < 1 or v > 200:  # Allow up to 200 concurrent pages
            raise ValueError('concurrency must be between 1 and 200')
        return v
    
    @field_validator('maxDepth')
    @classmethod
    def validate_max_depth(cls, v):
        if v < 1 or v > 500:  # Industry-grade: up to depth 500
            raise ValueError('maxDepth must be between 1 and 500')
        return v


class Cookie(BaseModel):
    """Cookie model"""
    name: str
    value: str
    domain: str
    path: str
    expires: Optional[float] = None
    httpOnly: bool = False
    secure: bool = False
    sameSite: Optional[str] = None
    category: str = "Unclassified"
    type: str = "Unknown"
    purpose: str = "Unknown"
    requiresConsent: bool = False
    isThirdParty: bool = False
    size: int = 0


class ScanProgress(BaseModel):
    """Progress update model for streaming"""
    type: str  # "progress", "complete", "error"
    current: int
    total: int
    currentBatch: Optional[int] = None
    totalBatches: Optional[int] = None
    currentUrl: Optional[str] = None
    activeScanUrls: Optional[List[str]] = None
    status: str = "scanning"
    message: Optional[str] = None


class PageResult(BaseModel):
    """Result from scanning a single page"""
    url: str
    domain: str
    cookies: List[Cookie]
    cookieCount: int
    error: Optional[str] = None
    scannedAt: str


class ScanResult(BaseModel):
    """Complete scan result"""
    scanType: str
    domain: str
    scannedUrl: str
    scannedAt: str
    cookies: List[Cookie]
    totalCount: int
    statistics: Dict[str, Any]
    pageResults: Optional[List[PageResult]] = None
    errorPages: Optional[List[str]] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str = "1.0.0"


# ── MongoDB scan store (/api/store) ─────────────────────────────────────────
# Records keep the frontend's own shape; extra fields (fullResults, counts,
# schedule settings) are stored as sent. Ids are restricted so they are safe
# as Mongo _id values and URL path segments.
STORE_ID_PATTERN = r"^[A-Za-z0-9_.:@|-]{1,200}$"


class StoredScan(BaseModel):
    """One scan as the app saves it (history entry with fullResults)."""
    model_config = ConfigDict(extra="allow")
    id: str = Field(pattern=STORE_ID_PATTERN)
    domain: str = Field(min_length=1, max_length=253)
    timestamp: str = Field(min_length=1, max_length=40)


class PublishedVersion(BaseModel):
    """Which stored scan is the published version of a domain."""
    id: str = Field(pattern=STORE_ID_PATTERN)
    publishedAt: Optional[str] = None


class StoredSchedule(BaseModel):
    """A scheduled scan job."""
    model_config = ConfigDict(extra="allow")
    id: str = Field(pattern=STORE_ID_PATTERN)
    url: str = Field(min_length=1, max_length=2048)
    unit: str


class StoredApproval(BaseModel):
    """A review-queue approval, keyed by "<domain>:<cookie name>"."""
    model_config = ConfigDict(extra="allow")
    cookieKey: str = Field(min_length=1, max_length=600)


class StoreImportRequest(BaseModel):
    """One browser's saved data, uploaded once when the app first uses the store."""
    scans: List[StoredScan] = []
    published: Dict[str, PublishedVersion] = {}
    schedules: List[StoredSchedule] = []
    approvals: List[StoredApproval] = []
