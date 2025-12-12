#!/usr/bin/env python3
"""
Load Vendor Patterns from JSON

Loads vendor patterns from data/vendor_patterns.json into the database.
Works even when PostgreSQL is not running - stores patterns for later use.

Usage:
    python3 scripts/load_vendor_patterns.py [--dry-run]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

def load_from_json(json_file: str = "data/vendor_patterns.json"):
    """Load vendor patterns from JSON file."""
    json_path = Path(__file__).parent.parent / json_file

    if not json_path.exists():
        print(f"❌ File not found: {json_path}")
        return None

    with open(json_path, 'r') as f:
        data = json.load(f)

    return data


def load_to_database(vendors, db_config, dry_run=False):
    """Load vendors into the database."""
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not installed. Installing...")
        os.system("pip3 install -q psycopg2-binary")
        import psycopg2

    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made to database")
        print()

    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()

        # Check if vendor_database table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'vendor_database'
            );
        """)
        table_exists = cursor.fetchone()[0]

        if not table_exists:
            print("❌ vendor_database table does not exist!")
            print("   Please run the schema migration first:")
            print("   backend/db/migrations/001_ml_classification_schema.sql")
            return False

        success_count = 0
        error_count = 0

        for vendor in vendors:
            try:
                if dry_run:
                    print(f"Would add: {vendor['vendor_name']}")
                    success_count += 1
                else:
                    cursor.execute("""
                        INSERT INTO vendor_database (
                            vendor_name,
                            vendor_domain,
                            typical_category,
                            cookie_name_patterns,
                            domain_patterns,
                            confidence_score,
                            source
                        ) VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
                        ON CONFLICT (vendor_name) DO UPDATE SET
                            vendor_domain = EXCLUDED.vendor_domain,
                            typical_category = EXCLUDED.typical_category,
                            cookie_name_patterns = EXCLUDED.cookie_name_patterns,
                            domain_patterns = EXCLUDED.domain_patterns,
                            confidence_score = EXCLUDED.confidence_score,
                            updated_at = CURRENT_TIMESTAMP;
                    """, (
                        vendor['vendor_name'],
                        vendor['vendor_domain'],
                        vendor['typical_category'],
                        json.dumps(vendor['cookie_name_patterns']),
                        json.dumps(vendor['domain_patterns']),
                        vendor['confidence_score'],
                        vendor['source']
                    ))
                    success_count += 1
                    print(f"✅ Added: {vendor['vendor_name']}")

            except Exception as e:
                error_count += 1
                print(f"❌ Error adding {vendor['vendor_name']}: {e}")

        if not dry_run:
            conn.commit()

        cursor.close()
        conn.close()

        print()
        print("=" * 70)
        print(f"✅ Successfully processed {success_count} vendors")
        if error_count > 0:
            print(f"❌ Failed: {error_count} vendors")
        print("=" * 70)

        return True

    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        print()
        print("PostgreSQL is not running or not accessible.")
        print("See DATABASE_SETUP_GUIDE.md for installation instructions.")
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Load vendor patterns from JSON to database')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be loaded without making changes')
    parser.add_argument('--json-file', default='data/vendor_patterns.json', help='Path to JSON file')
    args = parser.parse_args()

    print("=" * 70)
    print("Vendor Patterns Loader")
    print("=" * 70)
    print()

    # Load JSON
    print(f"Loading vendors from {args.json_file}...")
    data = load_from_json(args.json_file)

    if not data:
        sys.exit(1)

    vendors = data.get('vendors', [])
    metadata = data.get('metadata', {})

    print(f"✅ Loaded {len(vendors)} vendors")
    print(f"   Version: {metadata.get('version', 'unknown')}")
    categories_str = ', '.join([f"{k}={v}" for k, v in metadata.get('categories', {}).items()])
    print(f"   Categories: {categories_str}")
    print()

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

    print(f"Database: {db_config['user']}@{db_config['host']}:{db_config['port']}/{db_config['database']}")
    print()

    # Load to database
    success = load_to_database(vendors, db_config, dry_run=args.dry_run)

    if not success:
        print()
        print("💡 TIP: The vendor patterns are saved in data/vendor_patterns.json")
        print("   You can load them later when the database is ready.")
        sys.exit(1)


if __name__ == "__main__":
    main()
