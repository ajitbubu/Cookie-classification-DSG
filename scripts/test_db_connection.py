#!/usr/bin/env python3
"""Test database connection and check vendor_database table."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ psycopg2 not installed. Installing...")
    os.system("pip3 install psycopg2-binary")
    import psycopg2
    from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

# Database configuration
db_config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'cookie_scanner'),
    'user': os.getenv('DB_USER', 'scanner'),
    'password': os.getenv('DB_PASSWORD', 'scanner_password')
}

print("=" * 70)
print("Database Connection Test")
print("=" * 70)
print(f"\nConnection Details:")
print(f"  Host: {db_config['host']}")
print(f"  Port: {db_config['port']}")
print(f"  Database: {db_config['database']}")
print(f"  User: {db_config['user']}")
print()

try:
    # Test connection
    print("Testing connection...")
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("✅ Connection successful!")
    print()

    # Check if vendor_database table exists
    print("Checking vendor_database table...")
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'vendor_database'
        );
    """)
    table_exists = cursor.fetchone()['exists']

    if table_exists:
        print("✅ vendor_database table exists")

        # Count existing vendors
        cursor.execute("SELECT COUNT(*) as count FROM vendor_database;")
        count = cursor.fetchone()['count']
        print(f"   Current vendors: {count}")

        if count > 0:
            # Show existing vendors
            cursor.execute("""
                SELECT vendor_name, typical_category, confidence_score
                FROM vendor_database
                ORDER BY vendor_name;
            """)
            vendors = cursor.fetchall()
            print()
            print("Existing Vendors:")
            for v in vendors:
                print(f"  - {v['vendor_name']}: {v['typical_category']} ({v['confidence_score']:.2f})")
    else:
        print("⚠️  vendor_database table does not exist")
        print("   You need to run the schema migration first:")
        print("   backend/db/migrations/001_ml_classification_schema.sql")

    cursor.close()
    conn.close()

    print()
    print("=" * 70)
    print("✅ Database is ready for vendor patterns!")
    print("=" * 70)

except psycopg2.OperationalError as e:
    print(f"❌ Connection failed: {e}")
    print()
    print("Possible solutions:")
    print("1. Make sure PostgreSQL is running:")
    print("   brew services start postgresql")
    print("   # or")
    print("   pg_ctl -D /usr/local/var/postgres start")
    print()
    print("2. Check if database exists:")
    print("   createdb cookie_scanner")
    print()
    print("3. Check credentials in .env file")
    sys.exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
