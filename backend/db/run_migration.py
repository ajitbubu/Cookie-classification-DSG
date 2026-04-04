"""
Database Migration Runner
Applies SQL migration files to the database
"""
import asyncio
import asyncpg
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration(migration_file: str, db_config: dict):
    """
    Run a single migration file
    
    Args:
        migration_file: Path to the SQL migration file
        db_config: Database configuration dictionary
    """
    try:
        # Read migration file
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        logger.info(f"Applying migration: {migration_file}")
        
        # Connect to database
        conn = await asyncpg.connect(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password']
        )
        
        try:
            # Execute migration
            await conn.execute(sql)
            logger.info(f"✓ Migration applied successfully: {migration_file}")
            return True
            
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"✗ Migration failed: {migration_file}")
        logger.error(f"Error: {e}")
        return False


async def verify_migration(db_config: dict):
    """
    Verify that migration was applied correctly
    
    Args:
        db_config: Database configuration dictionary
    """
    try:
        conn = await asyncpg.connect(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password']
        )
        
        try:
            # Check if tables exist
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('cookie_knowledge_base', 'ml_feedback', 'cookie_patterns')
            """)
            
            table_names = [row['table_name'] for row in tables]
            
            logger.info("\nVerification Results:")
            logger.info("=" * 50)
            
            # Check each table
            for table in ['cookie_knowledge_base', 'ml_feedback', 'cookie_patterns']:
                if table in table_names:
                    logger.info(f"✓ Table '{table}' exists")
                    
                    # Count rows
                    count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                    logger.info(f"  - Rows: {count}")
                else:
                    logger.error(f"✗ Table '{table}' NOT FOUND")
            
            # Check indexes
            indexes = await conn.fetch("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename IN ('cookie_knowledge_base', 'ml_feedback', 'cookie_patterns')
            """)
            
            logger.info(f"\n✓ Indexes created: {len(indexes)}")
            for idx in indexes:
                logger.info(f"  - {idx['indexname']}")
            
            # Check unique constraint
            constraints = await conn.fetch("""
                SELECT constraint_name, table_name
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                AND constraint_type = 'UNIQUE'
                AND table_name = 'cookie_knowledge_base'
            """)
            
            logger.info(f"\n✓ Unique constraints: {len(constraints)}")
            for constraint in constraints:
                logger.info(f"  - {constraint['constraint_name']} on {constraint['table_name']}")
            
            # Check functions
            functions = await conn.fetch("""
                SELECT routine_name
                FROM information_schema.routines
                WHERE routine_schema = 'public'
                AND routine_name IN ('get_cookie_category', 'upsert_cookie_knowledge')
            """)
            
            logger.info(f"\n✓ Functions created: {len(functions)}")
            for func in functions:
                logger.info(f"  - {func['routine_name']}")
            
            logger.info("\n" + "=" * 50)
            logger.info("Migration verification complete!")
            
            return True
            
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        return False


async def main():
    """Main migration runner"""
    # Get database configuration from environment
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('DB_NAME', 'cookie_scanner'),
        'user': os.getenv('DB_USER', 'scanner'),
        'password': os.getenv('DB_PASSWORD', 'scanner_password')
    }
    
    logger.info("Database Migration Runner")
    logger.info("=" * 50)
    logger.info(f"Host: {db_config['host']}")
    logger.info(f"Port: {db_config['port']}")
    logger.info(f"Database: {db_config['database']}")
    logger.info(f"User: {db_config['user']}")
    logger.info("=" * 50)
    
    # Get migration file path
    migration_file = 'backend/db/migrations/006_cookie_knowledge_base.sql'
    
    if not os.path.exists(migration_file):
        logger.error(f"Migration file not found: {migration_file}")
        sys.exit(1)
    
    # Run migration
    success = await run_migration(migration_file, db_config)
    
    if not success:
        logger.error("Migration failed!")
        sys.exit(1)
    
    # Verify migration
    logger.info("\nVerifying migration...")
    verified = await verify_migration(db_config)
    
    if verified:
        logger.info("\n✓ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("\n✗ Migration verification failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
