"""
Distributed Scanner with Redis Queue
Industry-standard distributed scanning architecture
"""
import asyncio
import json
import logging
from typing import Optional, Callable
from datetime import datetime
import redis.asyncio as redis
from urllib.parse import urlparse

from backend.worker.browser_pool import get_browser_pool
from backend.scanner.cookie_scanner import CookieScanner

logger = logging.getLogger(__name__)


class DistributedScanner:
    """
    Distributed scanner using Redis for job queue and result storage.
    Supports horizontal scaling with multiple workers.
    """
    
    def __init__(self, redis_url: str, worker_id: str):
        self.redis_url = redis_url
        self.worker_id = worker_id
        self.redis_client: Optional[redis.Redis] = None
        self.running = False
        
        # Queue names
        self.scan_queue = "scanner:queue:pending"
        self.processing_queue = f"scanner:queue:processing:{worker_id}"
        self.results_key_prefix = "scanner:results:"
        self.visited_urls_key = "scanner:visited:"
        self.progress_key_prefix = "scanner:progress:"
    
    async def connect(self):
        """Connect to Redis"""
        self.redis_client = await redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        logger.info(f"Worker {self.worker_id} connected to Redis")
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()
    
    async def enqueue_scan(
        self,
        scan_id: str,
        start_url: str,
        max_pages: int = 100,
        concurrency: int = 20,
        max_depth: int = 3
    ):
        """Enqueue a new scan job"""
        job = {
            "scan_id": scan_id,
            "start_url": start_url,
            "max_pages": max_pages,
            "concurrency": concurrency,
            "max_depth": max_depth,
            "created_at": datetime.now().isoformat(),
            "status": "pending"
        }
        
        await self.redis_client.lpush(self.scan_queue, json.dumps(job))
        
        # Initialize progress
        await self.redis_client.hset(
            f"{self.progress_key_prefix}{scan_id}",
            mapping={
                "current": 0,
                "total": max_pages,
                "status": "queued"
            }
        )
        
        logger.info(f"Enqueued scan job: {scan_id}")
    
    async def process_jobs(self):
        """Process scan jobs from the queue"""
        self.running = True
        browser_pool = await get_browser_pool()
        
        logger.info(f"Worker {self.worker_id} started processing jobs")
        
        while self.running:
            try:
                # Get job from queue (blocking with timeout)
                job_data = await self.redis_client.brpoplpush(
                    self.scan_queue,
                    self.processing_queue,
                    timeout=5
                )
                
                if not job_data:
                    continue
                
                job = json.loads(job_data)
                scan_id = job["scan_id"]
                
                logger.info(f"Processing scan job: {scan_id}")
                
                # Update status
                await self.update_progress(scan_id, 0, job["max_pages"], "processing")
                
                # Process the scan
                try:
                    result = await self.scan_website(
                        scan_id=scan_id,
                        start_url=job["start_url"],
                        max_pages=job["max_pages"],
                        concurrency=job["concurrency"],
                        max_depth=job["max_depth"],
                        browser_pool=browser_pool
                    )
                    
                    # Store result
                    await self.redis_client.setex(
                        f"{self.results_key_prefix}{scan_id}",
                        3600,  # 1 hour TTL
                        json.dumps(result)
                    )
                    
                    # Update status
                    await self.update_progress(
                        scan_id,
                        result["totalPagesScanned"],
                        job["max_pages"],
                        "complete"
                    )
                    
                    logger.info(f"Scan job {scan_id} completed successfully")
                    
                except Exception as e:
                    logger.error(f"Scan job {scan_id} failed: {e}")
                    await self.update_progress(scan_id, 0, job["max_pages"], "error", str(e))
                
                # Remove from processing queue
                await self.redis_client.lrem(self.processing_queue, 1, job_data)
                
            except Exception as e:
                logger.error(f"Error processing job: {e}")
                await asyncio.sleep(1)
    
    async def scan_website(
        self,
        scan_id: str,
        start_url: str,
        max_pages: int,
        concurrency: int,
        max_depth: int,
        browser_pool
    ) -> dict:
        """Scan a website using the browser pool"""
        
        # Acquire context from pool
        context = await browser_pool.acquire_context()
        
        try:
            scanner = CookieScanner(context)
            page_results = []
            visited_urls = set()
            
            # Check Redis for already visited URLs (distributed deduplication)
            visited_key = f"{self.visited_urls_key}{urlparse(start_url).netloc}"
            
            # Scan main page
            main_result = await scanner.scan_page(start_url)
            page_results.append(main_result)
            visited_urls.add(start_url)
            
            # Mark as visited in Redis
            await self.redis_client.sadd(visited_key, start_url)
            await self.redis_client.expire(visited_key, 3600)  # 1 hour
            
            # Update progress
            await self.update_progress(scan_id, 1, max_pages, "scanning")
            
            # Extract and scan more pages (simplified for now)
            current_depth = 0
            while current_depth < max_depth and len(page_results) < max_pages:
                # Extract links
                links = await scanner.extract_links(start_url, max_links=min(50, max_pages - len(page_results)))
                
                # Filter already visited
                new_links = []
                for link in links:
                    is_visited = await self.redis_client.sismember(visited_key, link)
                    if not is_visited and link not in visited_urls:
                        new_links.append(link)
                        visited_urls.add(link)
                
                if not new_links:
                    break
                
                # Scan new links in parallel
                tasks = []
                for link in new_links[:min(concurrency, max_pages - len(page_results))]:
                    tasks.append(self.scan_page_with_cache(scanner, link, visited_key))
                
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in batch_results:
                    if not isinstance(result, Exception):
                        page_results.append(result)
                
                # Update progress
                await self.update_progress(scan_id, len(page_results), max_pages, "scanning")
                
                current_depth += 1
            
            # Deduplicate cookies
            unique_cookies = scanner.deduplicate_cookies(page_results)
            
            # Build result
            from backend.scanner.classifier import CookieClassifier
            
            result = {
                "scanType": "deep",
                "domain": urlparse(start_url).netloc,
                "scannedUrl": start_url,
                "scannedAt": datetime.now().isoformat(),
                "cookies": unique_cookies,
                "totalCount": len(unique_cookies),
                "statistics": CookieClassifier.aggregate_statistics(unique_cookies),
                "pageResults": page_results,
                "totalPagesScanned": len(page_results),
                "maxDepthReached": current_depth,
                "workerId": self.worker_id
            }
            
            return result
            
        finally:
            # Release context back to pool
            await browser_pool.release_context(context)
    
    async def scan_page_with_cache(self, scanner, url: str, visited_key: str) -> dict:
        """Scan a page and mark as visited"""
        result = await scanner.scan_page(url)
        await self.redis_client.sadd(visited_key, url)
        return result
    
    async def update_progress(
        self,
        scan_id: str,
        current: int,
        total: int,
        status: str,
        error: Optional[str] = None
    ):
        """Update scan progress in Redis"""
        progress = {
            "current": current,
            "total": total,
            "status": status,
            "worker_id": self.worker_id,
            "updated_at": datetime.now().isoformat()
        }
        
        if error:
            progress["error"] = error
        
        await self.redis_client.hset(
            f"{self.progress_key_prefix}{scan_id}",
            mapping=progress
        )
        
        # Publish progress update
        await self.redis_client.publish(
            f"scanner:progress:{scan_id}",
            json.dumps(progress)
        )
    
    async def get_result(self, scan_id: str) -> Optional[dict]:
        """Get scan result from Redis"""
        result_data = await self.redis_client.get(f"{self.results_key_prefix}{scan_id}")
        
        if result_data:
            return json.loads(result_data)
        
        return None
    
    async def get_progress(self, scan_id: str) -> Optional[dict]:
        """Get scan progress from Redis"""
        progress = await self.redis_client.hgetall(f"{self.progress_key_prefix}{scan_id}")
        
        if progress:
            return {
                "current": int(progress.get("current", 0)),
                "total": int(progress.get("total", 0)),
                "status": progress.get("status", "unknown"),
                "worker_id": progress.get("worker_id"),
                "updated_at": progress.get("updated_at")
            }
        
        return None
    
    def stop(self):
        """Stop processing jobs"""
        self.running = False
        logger.info(f"Worker {self.worker_id} stopping...")
