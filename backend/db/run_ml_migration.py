"""
Run ML Classification Database Migration

This script applies the ML classification schema migration to the database.
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'cookie_scanner'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

MIGRATION_FILE = Path(__file__).parent / 'migrations' / '001_ml_classification_schema.sql'


def run_migration():
    """Run the ML classification schema migration."""
    print("=" * 70)
    print("ML Classification Database Migration")
    print("=" * 70)
    
    # Check if migration file exists
    if not MIGRATION_FILE.exists():
        print(f"❌ Migration file not found: {MIGRATION_FILE}")
        sys.exit(1)
    
    print(f"📄 Migration file: {MIGRATION_FILE}")
    print(f"🔗 Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print()
    
    try:
        # Connect to database
        print("🔌 Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        cursor = conn.cursor()
        
        # Read migration SQL
        print("📖 Reading migration SQL...")
        with open(MIGRATION_FILE, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        print("⚙️  Executing migration...")
        cursor.execute(migration_sql)
        
        # Commit transaction
        conn.commit()
        print("✅ Migration committed successfully!")
        print()
        
        # Verify tables were created
        print("🔍 Verifying tables...")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('ml_classifications', 'ml_feedback', 'ml_metrics', 'vendor_database')
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        if len(tables) == 4:
            print("✅ All 4 tables created successfully:")
            for table in tables:
                print(f"   - {table[0]}")
        else:
            print(f"⚠️  Warning: Expected 4 tables, found {len(tables)}")
        
        print()
        
        # Check vendor data
        cursor.execute("SELECT COUNT(*) FROM vendor_database;")
        vendor_count = cursor.fetchone()[0]
        print(f"✅ Seeded {vendor_count} vendors")
        
        print()
        print("=" * 70)
        print("✅ Migration completed successfully!")
        print("=" * 70)
        
        # Close connection
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)


def rollback_migration():
    """Rollback the ML classification schema migration."""
    print("=" * 70)
    print("ML Classification Database Migration Rollback")
    print("=" * 70)
    print()
    
    response = input("⚠️  This will DROP all ML tables and data. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Rollback cancelled")
        return
    
    try:
        # Connect to database
        print("🔌 Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        cursor = conn.cursor()
        
        # Drop tables in reverse order (respecting foreign keys)
        print("⚙️  Dropping tables...")
        cursor.execute("""
            DROP TABLE IF EXISTS ml_feedback CASCADE;
            DROP TABLE IF EXISTS ml_classifications CASCADE;
            DROP TABLE IF EXISTS ml_metrics CASCADE;
            DROP TABLE IF EXISTS vendor_database CASCADE;
            
            DROP FUNCTION IF EXISTS update_vendor_updated_at() CASCADE;
            DROP FUNCTION IF EXISTS calculate_correction_rate(INTEGER, INTEGER) CASCADE;
            DROP FUNCTION IF EXISTS get_classification_stats(TIMESTAMP, TIMESTAMP, VARCHAR) CASCADE;
            DROP FUNCTION IF EXISTS cleanup_old_ml_data() CASCADE;
        """)
        
        # Commit transaction
        conn.commit()
        print("✅ Rollback completed successfully!")
        
        # Close connection
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run ML classification database migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    args = parser.parse_args()
    
    if args.rollback:
        rollback_migration()
    else:
        run_migration()
