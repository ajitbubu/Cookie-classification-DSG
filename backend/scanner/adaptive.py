import asyncio
import time
from typing import Dict
import logging

from backend.config import settings

logger = logging.getLogger(__name__)


class AdaptiveConcurrencyManager:
    """
    Manages dynamic concurrency adjustment based on scan performance.
    Increases concurrency when scans are successful, decreases when errors occur.
    """
    
    def __init__(self, initial_concurrency: int = None):
        self.current_concurrency = initial_concurrency or settings.MAX_CONCURRENT_PAGES
        self.min_concurrency = settings.MIN_CONCURRENT_PAGES
        self.max_concurrency = 500  # Increased from 200 for high-performance scanning
        
        # Performance tracking
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.total_time = 0.0
        self.batch_times = []
        
        # Adaptive settings
        self.enabled = settings.ADAPTIVE_CONCURRENCY
        self.increase_threshold = settings.CONCURRENCY_INCREASE_THRESHOLD
        self.decrease_threshold = settings.CONCURRENCY_DECREASE_THRESHOLD
    
    def record_batch_result(self, success_count: int, failure_count: int, duration: float):
        """Record the results of a batch scan"""
        self.total_scans += success_count + failure_count
        self.successful_scans += success_count
        self.failed_scans += failure_count
        self.total_time += duration
        self.batch_times.append(duration)
        
        # Keep only last 10 batch times for moving average
        if len(self.batch_times) > 10:
            self.batch_times.pop(0)
        
        if self.enabled:
            self._adjust_concurrency()
    
    def _adjust_concurrency(self):
        """Adjust concurrency based on success rate and performance"""
        if self.total_scans < 10:
            # Not enough data yet
            return
        
        success_rate = self.successful_scans / self.total_scans
        avg_batch_time = sum(self.batch_times) / len(self.batch_times) if self.batch_times else 0
        
        old_concurrency = self.current_concurrency
        
        # Increase concurrency if success rate is high and batches are fast
        if success_rate > self.increase_threshold and avg_batch_time < 8.0:
            # Increase by 30% (more aggressive)
            new_concurrency = int(self.current_concurrency * 1.3)
            self.current_concurrency = min(new_concurrency, self.max_concurrency)
        
        # Decrease concurrency if success rate is low
        elif success_rate < self.decrease_threshold:
            # Decrease by 30%
            new_concurrency = int(self.current_concurrency * 0.7)
            self.current_concurrency = max(new_concurrency, self.min_concurrency)
        
        # Decrease if batches are taking too long (potential resource exhaustion)
        elif avg_batch_time > 20.0:
            # Decrease by 25%
            new_concurrency = int(self.current_concurrency * 0.75)
            self.current_concurrency = max(new_concurrency, self.min_concurrency)
        
        if old_concurrency != self.current_concurrency:
            logger.info(
                f"Adjusted concurrency: {old_concurrency} → {self.current_concurrency} "
                f"(success rate: {success_rate:.2%}, avg batch time: {avg_batch_time:.2f}s)"
            )
    
    def get_concurrency(self) -> int:
        """Get current concurrency level"""
        return self.current_concurrency
    
    def get_stats(self) -> Dict:
        """Get performance statistics"""
        success_rate = self.successful_scans / self.total_scans if self.total_scans > 0 else 0
        avg_time = self.total_time / self.total_scans if self.total_scans > 0 else 0
        
        return {
            "current_concurrency": self.current_concurrency,
            "total_scans": self.total_scans,
            "successful_scans": self.successful_scans,
            "failed_scans": self.failed_scans,
            "success_rate": success_rate,
            "average_scan_time": avg_time,
            "total_time": self.total_time
        }
