"""MongoDB store for scan data.

Holds what the frontend used to keep in each browser's localStorage:
scans (results + history), published versions per domain, scheduled jobs and
review-queue approvals. Postgres keeps the cookie knowledge base and ML data.

Collections (all keyed by the app's own ids):
    scans       _id = scan id; domain, timestamp (ISO), summary fields, fullResults
    published   _id = domain; id (published scan id), publishedAt
    schedules   _id = job id; url, unit, interval, scheduleTime, startDate, ...
    approvals   _id = cookieKey ("<domain>:<cookie name>"); approval fields
"""
import logging
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from backend.config import settings

logger = logging.getLogger(__name__)

MAX_SCANS = 500  # newest scans returned in one list call


def _to_doc(record: Dict[str, Any], key: str) -> Dict[str, Any]:
    """App record -> Mongo document (the record's id becomes _id)."""
    doc = {k: v for k, v in record.items() if k != key}
    doc["_id"] = record[key]
    return doc


def strip_cookie_values(scan: Dict[str, Any]) -> bool:
    """Drop cookie values from a stored scan in place; True if any were removed.

    Values can hold session tokens and personal data, and nothing reads them back.
    """
    results = scan.get("fullResults")
    if not isinstance(results, dict):
        return False
    lists = [results.get("cookies")] + [page.get("cookies") for page in results.get("pageResults") or [] if isinstance(page, dict)]
    removed = False
    for cookies in lists:
        for cookie in cookies if isinstance(cookies, list) else []:
            if isinstance(cookie, dict) and "value" in cookie:
                del cookie["value"]
                removed = True
    return removed


def _from_doc(doc: Dict[str, Any], key: str) -> Dict[str, Any]:
    """Mongo document -> app record."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    out[key] = doc["_id"]
    return out


class ScanStore:
    """Async access to the scan collections."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def ensure_indexes(self) -> None:
        await self.db.scans.create_index([("timestamp", -1)])
        await self.db.scans.create_index([("domain", 1), ("timestamp", -1)])

    async def remove_stored_cookie_values(self) -> int:
        """One-off clean of scans saved before values were dropped; returns scans changed."""
        query = {"$or": [{"fullResults.cookies.value": {"$exists": True}},
                         {"fullResults.pageResults.cookies.value": {"$exists": True}}]}
        changed = 0
        async for doc in self.db.scans.find(query):
            if strip_cookie_values(doc):
                await self.db.scans.replace_one({"_id": doc["_id"]}, doc)
                changed += 1
        return changed

    # ── Scans ─────────────────────────────────────────────
    async def list_scans(self, limit: int = MAX_SCANS, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        query = {"domain": domain} if domain else {}
        cursor = self.db.scans.find(query).sort("timestamp", -1).limit(max(1, min(limit, MAX_SCANS)))
        return [_from_doc(d, "id") async for d in cursor]

    async def upsert_scan(self, scan: Dict[str, Any]) -> None:
        """Insert a scan, or replace it when the same id is saved again (ML-corrected save)."""
        strip_cookie_values(scan)
        await self.db.scans.replace_one({"_id": scan["id"]}, _to_doc(scan, "id"), upsert=True)

    async def delete_scan(self, scan_id: str) -> bool:
        result = await self.db.scans.delete_one({"_id": scan_id})
        return result.deleted_count == 1

    async def clear_scans(self) -> int:
        result = await self.db.scans.delete_many({})
        return result.deleted_count

    # ── Published versions ───────────────────────────────
    async def list_published(self) -> Dict[str, Dict[str, Any]]:
        return {d["_id"]: {"id": d["id"], "publishedAt": d.get("publishedAt")} async for d in self.db.published.find({})}

    async def set_published(self, domain: str, scan_id: str, published_at: Optional[str]) -> None:
        await self.db.published.replace_one(
            {"_id": domain}, {"_id": domain, "id": scan_id, "publishedAt": published_at}, upsert=True
        )

    # ── Schedules ─────────────────────────────────────────
    async def list_schedules(self) -> List[Dict[str, Any]]:
        return [_from_doc(d, "id") async for d in self.db.schedules.find({}).sort("createdAt", 1)]

    async def upsert_schedule(self, job: Dict[str, Any]) -> None:
        await self.db.schedules.replace_one({"_id": job["id"]}, _to_doc(job, "id"), upsert=True)

    async def delete_schedule(self, job_id: str) -> bool:
        result = await self.db.schedules.delete_one({"_id": job_id})
        return result.deleted_count == 1

    # ── Review approvals ─────────────────────────────────
    async def list_approvals(self) -> List[Dict[str, Any]]:
        return [_from_doc(d, "cookieKey") async for d in self.db.approvals.find({})]

    async def upsert_approval(self, approval: Dict[str, Any]) -> None:
        await self.db.approvals.replace_one(
            {"_id": approval["cookieKey"]}, _to_doc(approval, "cookieKey"), upsert=True
        )

    # ── One-time import of a browser's saved data ────────
    async def import_all(self, scans, published, schedules, approvals) -> Dict[str, int]:
        for scan in scans:
            await self.upsert_scan(scan)
        for domain, rec in published.items():
            await self.set_published(domain, rec["id"], rec.get("publishedAt"))
        for job in schedules:
            await self.upsert_schedule(job)
        for approval in approvals:
            await self.upsert_approval(approval)
        return {"scans": len(scans), "published": len(published), "schedules": len(schedules), "approvals": len(approvals)}


_client: Optional[AsyncIOMotorClient] = None
_store: Optional[ScanStore] = None


def get_scan_store() -> Optional[ScanStore]:
    """The connected store, or None when MongoDB was unreachable at startup."""
    return _store


async def initialize_scan_store() -> Optional[ScanStore]:
    """Connect to MongoDB and create indexes. Returns None (and logs) when unreachable."""
    global _client, _store
    try:
        _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS)
        await _client.admin.command("ping")
        _store = ScanStore(_client[settings.MONGODB_DB])
        await _store.ensure_indexes()
        try:  # a failed clean must not take the store offline
            cleaned = await _store.remove_stored_cookie_values()
            if cleaned:
                logger.info(f"Removed cookie values from {cleaned} stored scans")
        except Exception as e:
            logger.error(f"Could not remove stored cookie values: {e}")
        logger.info(f"MongoDB scan store connected (db={settings.MONGODB_DB})")
        return _store
    except Exception as e:
        logger.error(f"MongoDB scan store unavailable: {e}")
        _store = None
        return None


async def shutdown_scan_store() -> None:
    global _client, _store
    if _client is not None:
        _client.close()
    _client = None
    _store = None
