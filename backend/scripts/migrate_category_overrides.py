#!/usr/bin/env python3
"""
Migration Script: Category Overrides from JSON to Database

This script migrates existing category overrides from JSON files
to the cookie_knowledge_base database table.

Usage:
    python backend/scripts/migrate_category_overrides.py [options]

Options:
    --dry-run           Preview migration without writing to database
    --source-dir PATH   Directory containing JSON override files (default: data/category_overrides)
    --verbose          Enable verbose logging
    --help             Show this help message

Requirements: 7.1, 7.2, 7.3
"""

import asyncio
import asyncpg
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import argparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationStats:
    """Track migration statistics"""
    
    def __init__(self):
        self.files_processed = 0
        self.files_failed = 0
        self.overrides_found = 0
        self.overrides_migrated = 0
        self.overrides_skipped = 0
        self.overrides_failed = 0
        self.errors: List[str] = []
    
    def print_summary(self):
        """Print migration summary"""
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Files processed:       {self.files_processed}")
        print(f"Files failed:          {self.files_failed}")
        print(f"Overrides found:       {self.overrides_found}")
        print(f"Overrides migrated:    {self.overrides_migrated}")
        print(f"Overrides skipped:     {self.overrides_skipped}")
        print(f"Overrides failed:      {self.overrides_failed}")
        
        if self.errors:
            print(f"\nErrors encountered: {len(self.errors)}")
            for i, error in enumerate(self.errors[:5], 1):
                print(f"  {i}. {error}")
            if len(self.errors) > 5:
                print(f"  ... and {len(self.errors) - 5} more")
        
        print("=" * 60)
        
        # Calculate success rate
        if self.overrides_found > 0:
            success_rate = (self.overrides_migrated / self.overrides_found) * 100
            print(f"\nSuccess rate: {success_rate:.1f}%")


class CategoryOverrideMigrator:
    """Migrates category overrides from JSON files to database"""
    
    def __init__(
        self,
        source_dir: str = "data/category_overrides",
        dry_run: bool = False,
        verbose: bool = False
    ):
        """
        Initialize migrator.
        
        Args:
            source_dir: Directory containing JSON override files
            dry_run: If True, preview without writing to database
            verbose: Enable verbose logging
        """
        self.source_dir = Path(source_dir)
        self.dry_run = dry_run
        self.verbose = verbose
        self.stats = MigrationStats()
        self.db_pool: Optional[asyncpg.Pool] = None
        
        if verbose:
            logger.setLevel(logging.DEBUG)
    
    async def connect_database(self) -> bool:
        """
        Connect to database.
        
        Returns:
            bool: True if connected successfully
        """
        try:
            logger.info("Connecting to database...")
            
            self.db_pool = await asyncpg.create_pool(
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                database=settings.DB_NAME,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                min_size=1,
                max_size=5,
                timeout=10
            )
            
            # Test connection
            async with self.db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            
            logger.info("Database connection established")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
    
    async def close_database(self):
        """Close database connection"""
        if self.db_pool:
            await self.db_pool.close()
            logger.info("Database connection closed")
    
    def read_json_files(self) -> List[tuple[str, Dict]]:
        """
        Read all JSON files from source directory.
        
        Returns:
            List of (filename, data) tuples
        """
        if not self.source_dir.exists():
            logger.error(f"Source directory not found: {self.source_dir}")
            return []
        
        json_files = []
        
        for file_path in self.source_dir.glob("*.json"):
            try:
                logger.debug(f"Reading file: {file_path.name}")
                
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                json_files.append((file_path.name, data))
                self.stats.files_processed += 1
                
                logger.debug(f"Loaded {len(data)} overrides from {file_path.name}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in {file_path.name}: {e}")
                self.stats.files_failed += 1
                self.stats.errors.append(f"JSON error in {file_path.name}: {e}")
                
            except Exception as e:
                logger.error(f"Error reading {file_path.name}: {e}")
                self.stats.files_failed += 1
                self.stats.errors.append(f"Read error in {file_path.name}: {e}")
        
        logger.info(f"Read {len(json_files)} JSON files")
        return json_files
    
    def parse_overrides(self, json_files: List[tuple[str, Dict]]) -> List[Dict]:
        """
        Parse overrides from JSON files.
        
        Args:
            json_files: List of (filename, data) tuples
            
        Returns:
            List of override dictionaries
        """
        overrides = []
        
        for filename, data in json_files:
            for override_key, override_data in data.items():
                try:
                    # Validate required fields
                    required_fields = ['cookie_name', 'cookie_domain', 'new_category']
                    missing_fields = [f for f in required_fields if f not in override_data]
                    
                    if missing_fields:
                        logger.warning(
                            f"Skipping override in {filename}: "
                            f"missing fields {missing_fields}"
                        )
                        self.stats.overrides_skipped += 1
                        continue
                    
                    # Extract override data
                    override = {
                        'cookie_name': override_data['cookie_name'],
                        'cookie_domain': override_data['cookie_domain'],
                        'category': override_data['new_category'],
                        'source': 'user_override',
                        'confidence_score': 1.0,
                        'updated_at': override_data.get('updated_at'),
                        'user_id': override_data.get('user_id'),
                        'source_file': filename
                    }
                    
                    overrides.append(override)
                    self.stats.overrides_found += 1
                    
                    logger.debug(
                        f"Parsed override: {override['cookie_name']} @ "
                        f"{override['cookie_domain']} -> {override['category']}"
                    )
                    
                except Exception as e:
                    logger.error(f"Error parsing override in {filename}: {e}")
                    self.stats.overrides_skipped += 1
                    self.stats.errors.append(f"Parse error in {filename}: {e}")
        
        logger.info(f"Parsed {len(overrides)} overrides")
        return overrides
    
    async def migrate_override(self, override: Dict) -> bool:
        """
        Migrate a single override to database.
        
        Args:
            override: Override dictionary
            
        Returns:
            bool: True if migrated successfully
        """
        if self.dry_run:
            logger.info(
                f"[DRY RUN] Would migrate: {override['cookie_name']} @ "
                f"{override['cookie_domain']} -> {override['category']}"
            )
            return True
        
        try:
            async with self.db_pool.acquire() as conn:
                # Use upsert query
                await conn.execute("""
                    INSERT INTO cookie_knowledge_base (
                        cookie_name,
                        cookie_domain,
                        category,
                        source,
                        confidence_score,
                        times_seen,
                        last_seen,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW(), NOW())
                    ON CONFLICT (cookie_name, cookie_domain)
                    DO UPDATE SET
                        category = EXCLUDED.category,
                        source = EXCLUDED.source,
                        confidence_score = EXCLUDED.confidence_score,
                        times_seen = cookie_knowledge_base.times_seen + 1,
                        last_seen = NOW(),
                        updated_at = NOW()
                """, 
                    override['cookie_name'],
                    override['cookie_domain'],
                    override['category'],
                    override['source'],
                    override['confidence_score']
                )
            
            logger.debug(
                f"Migrated: {override['cookie_name']} @ "
                f"{override['cookie_domain']} -> {override['category']}"
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to migrate {override['cookie_name']} @ "
                f"{override['cookie_domain']}: {e}"
            )
            self.stats.errors.append(
                f"Migration error for {override['cookie_name']}: {e}"
            )
            return False
    
    async def migrate_all(self) -> bool:
        """
        Migrate all overrides from JSON files to database.
        
        Returns:
            bool: True if migration completed successfully
        """
        try:
            # Read JSON files
            logger.info(f"Reading JSON files from {self.source_dir}...")
            json_files = self.read_json_files()
            
            if not json_files:
                logger.warning("No JSON files found to migrate")
                return True
            
            # Parse overrides
            logger.info("Parsing overrides...")
            overrides = self.parse_overrides(json_files)
            
            if not overrides:
                logger.warning("No valid overrides found to migrate")
                return True
            
            # Connect to database (skip if dry run)
            if not self.dry_run:
                if not await self.connect_database():
                    logger.error("Cannot proceed without database connection")
                    return False
            
            # Migrate overrides
            logger.info(f"Migrating {len(overrides)} overrides...")
            
            for i, override in enumerate(overrides, 1):
                if self.verbose and i % 10 == 0:
                    logger.info(f"Progress: {i}/{len(overrides)}")
                
                success = await self.migrate_override(override)
                
                if success:
                    self.stats.overrides_migrated += 1
                else:
                    self.stats.overrides_failed += 1
            
            # Close database connection
            if not self.dry_run:
                await self.close_database()
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            self.stats.errors.append(f"Migration failed: {e}")
            return False


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Migrate category overrides from JSON files to database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview migration without writing to database
  python backend/scripts/migrate_category_overrides.py --dry-run
  
  # Migrate with verbose logging
  python backend/scripts/migrate_category_overrides.py --verbose
  
  # Migrate from custom directory
  python backend/scripts/migrate_category_overrides.py --source-dir /path/to/overrides
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview migration without writing to database'
    )
    
    parser.add_argument(
        '--source-dir',
        type=str,
        default='data/category_overrides',
        help='Directory containing JSON override files (default: data/category_overrides)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Print header
    print("\n" + "=" * 60)
    print("CATEGORY OVERRIDE MIGRATION")
    print("=" * 60)
    print(f"Source directory: {args.source_dir}")
    print(f"Dry run:          {args.dry_run}")
    print(f"Verbose:          {args.verbose}")
    print("=" * 60 + "\n")
    
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be written to database\n")
    
    # Create migrator
    migrator = CategoryOverrideMigrator(
        source_dir=args.source_dir,
        dry_run=args.dry_run,
        verbose=args.verbose
    )
    
    # Run migration
    success = await migrator.migrate_all()
    
    # Print summary
    migrator.stats.print_summary()
    
    # Exit with appropriate code
    if success and migrator.stats.overrides_failed == 0:
        print("\n✅ Migration completed successfully!")
        sys.exit(0)
    elif success and migrator.stats.overrides_failed > 0:
        print("\n⚠️  Migration completed with some failures")
        sys.exit(1)
    else:
        print("\n❌ Migration failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
