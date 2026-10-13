"""Scan data store (MongoDB): scans, published versions, schedules, approvals.

Mounted at /api/store. Thin: validation in backend.models, data access in
backend.db.scan_store. When MongoDB is unreachable every route answers 503
so the frontend can show "Couldn't load" with Retry.
"""
import logging
import time
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Path, Query

from backend.db.scan_store import ScanStore, get_scan_store, initialize_scan_store
from backend.models import (
    STORE_ID_PATTERN, PublishedVersion, StoredApproval, StoredScan, StoredSchedule, StoreImportRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_RETRY_SECONDS = 10
_last_attempt = 0.0


async def _store() -> ScanStore:
    """The connected store; reconnects (at most every 10 s) if MongoDB came up after the API."""
    global _last_attempt
    store = get_scan_store()
    if store is None and time.monotonic() - _last_attempt > _RETRY_SECONDS:
        _last_attempt = time.monotonic()
        store = await initialize_scan_store()
    if store is None:
        raise HTTPException(status_code=503, detail="Scan store (MongoDB) is unavailable")
    return store


def _dump(model) -> dict:
    return model.model_dump(mode="json")


# ── Scans ──────────────────────────────────────────────
@router.get("/scans")
async def list_scans(limit: int = Query(200, ge=1, le=500), domain: str = Query(None, max_length=253)) -> Dict[str, List[dict]]:
    return {"scans": await (await _store()).list_scans(limit=limit, domain=domain)}


@router.put("/scans/{scan_id}")
async def save_scan(scan: StoredScan, scan_id: str = Path(pattern=STORE_ID_PATTERN)) -> Dict[str, str]:
    if scan.id != scan_id:
        raise HTTPException(status_code=400, detail="Scan id in the path and body differ")
    await (await _store()).upsert_scan(_dump(scan))
    logger.info(f"Stored scan {scan_id} for {scan.domain}")
    return {"id": scan_id}


@router.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str = Path(pattern=STORE_ID_PATTERN)) -> Dict[str, bool]:
    if not await (await _store()).delete_scan(scan_id):
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"deleted": True}


@router.delete("/scans")
async def clear_scans() -> Dict[str, int]:
    return {"deleted": await (await _store()).clear_scans()}


# ── Published versions ────────────────────────────────
@router.get("/published")
async def list_published() -> Dict[str, Dict[str, dict]]:
    return {"published": await (await _store()).list_published()}


@router.put("/published/{domain}")
async def set_published(version: PublishedVersion, domain: str = Path(min_length=1, max_length=253)) -> Dict[str, str]:
    await (await _store()).set_published(domain, version.id, version.publishedAt)
    return {"domain": domain, "id": version.id}


# ── Schedules ─────────────────────────────────────────
@router.get("/schedules")
async def list_schedules() -> Dict[str, List[dict]]:
    return {"schedules": await (await _store()).list_schedules()}


@router.put("/schedules/{job_id}")
async def save_schedule(job: StoredSchedule, job_id: str = Path(pattern=STORE_ID_PATTERN)) -> Dict[str, str]:
    if job.id != job_id:
        raise HTTPException(status_code=400, detail="Schedule id in the path and body differ")
    await (await _store()).upsert_schedule(_dump(job))
    return {"id": job_id}


@router.delete("/schedules/{job_id}")
async def delete_schedule(job_id: str = Path(pattern=STORE_ID_PATTERN)) -> Dict[str, bool]:
    if not await (await _store()).delete_schedule(job_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": True}


# ── Review approvals ─────────────────────────────────
@router.get("/approvals")
async def list_approvals() -> Dict[str, List[dict]]:
    return {"approvals": await (await _store()).list_approvals()}


@router.post("/approvals")
async def save_approval(approval: StoredApproval) -> Dict[str, str]:
    await (await _store()).upsert_approval(_dump(approval))
    return {"cookieKey": approval.cookieKey}


# ── One-time import ──────────────────────────────────
@router.post("/import")
async def import_browser_data(data: StoreImportRequest) -> Dict[str, int]:
    counts = await (await _store()).import_all(
        [_dump(s) for s in data.scans],
        {d: _dump(v) for d, v in data.published.items()},
        [_dump(j) for j in data.schedules],
        [_dump(a) for a in data.approvals],
    )
    logger.info(f"Imported browser data into the scan store: {counts}")
    return counts
