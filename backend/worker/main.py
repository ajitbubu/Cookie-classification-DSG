"""
Worker Main Entry Point
Starts the distributed scanner worker
"""
import asyncio
import logging
import signal
import os
from backend.worker.distributed_scanner import DistributedScanner

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Main worker function"""
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    worker_id = os.getenv('WORKER_ID', 'worker-1')
    
    logger.info(f"Starting worker: {worker_id}")
    
    scanner = DistributedScanner(redis_url, worker_id)
    
    # Connect to Redis
    await scanner.connect()
    
    # Setup signal handlers
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, shutting down...")
        scanner.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start processing jobs
        await scanner.process_jobs()
    except Exception as e:
        logger.error(f"Worker error: {e}")
    finally:
        await scanner.disconnect()
        logger.info(f"Worker {worker_id} stopped")


if __name__ == "__main__":
    asyncio.run(main())
