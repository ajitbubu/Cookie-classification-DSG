#!/usr/bin/env python3
"""
Load Vendor Packages

Interactive tool to load industry-specific and regional vendor packages.
Allows selective loading of vendor collections based on your use case.

Usage:
    python3 scripts/load_vendor_packages.py [--package PACKAGE_NAME]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))


def load_packages_file(json_file: str = "data/vendor_packages_all.json") -> Dict:
    """Load vendor packages from JSON file."""
    json_path = Path(__file__).parent.parent / json_file

    if not json_path.exists():
        print(f"❌ File not found: {json_path}")
        return None

    with open(json_path, 'r') as f:
        data = json.load(f)

    return data


def display_packages(packages_data: Dict):
    """Display available packages."""
    print("\n" + "=" * 70)
    print("Available Vendor Packages")
    print("=" * 70)
    print()

    packages = packages_data.get('packages', {})
    metadata = packages_data.get('metadata', {})

    for i, (package_id, package) in enumerate(packages.items(), 1):
        vendor_count = len(package.get('vendors', []))
        print(f"{i}. {package['name']}")
        print(f"   ID: {package_id}")
        print(f"   Vendors: {vendor_count}")
        print(f"   {package['description']}")
        print()

    print(f"Total packages: {len(packages)}")
    print(f"Total vendors across all packages: {metadata.get('total_vendors', 0)}")
    print()


def load_package_to_db(package_id: str, vendors: List[Dict], db_config: Dict) -> bool:
    """Load a specific package to the database."""
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not installed. Installing...")
        os.system("pip3 install -q psycopg2-binary")
        import psycopg2

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
        updated_count = 0

        for vendor in vendors:
            try:
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
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING (xmax = 0) AS inserted;
                """, (
                    vendor['vendor_name'],
                    vendor['vendor_domain'],
                    vendor['typical_category'],
                    json.dumps(vendor['cookie_name_patterns']),
                    json.dumps(vendor['domain_patterns']),
                    vendor['confidence_score'],
                    vendor['source']
                ))

                result = cursor.fetchone()
                if result and result[0]:
                    success_count += 1
                    print(f"✅ Added: {vendor['vendor_name']}")
                else:
                    updated_count += 1
                    print(f"🔄 Updated: {vendor['vendor_name']}")

            except Exception as e:
                error_count += 1
                print(f"❌ Error adding {vendor['vendor_name']}: {e}")

        conn.commit()
        cursor.close()
        conn.close()

        print()
        print("=" * 70)
        print(f"Package '{package_id}' Loading Complete")
        print("=" * 70)
        print(f"✅ New vendors added: {success_count}")
        print(f"🔄 Existing vendors updated: {updated_count}")
        if error_count > 0:
            print(f"❌ Failed: {error_count}")
        print()

        return True

    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        print()
        print("PostgreSQL is not running or not accessible.")
        print("See DATABASE_SETUP_GUIDE.md for installation instructions.")
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Load vendor packages to database')
    parser.add_argument('--package', type=str, help='Specific package ID to load (e.g., ecommerce, saas)')
    parser.add_argument('--all', action='store_true', help='Load all packages')
    parser.add_argument('--list', action='store_true', help='List available packages')
    args = parser.parse_args()

    print("=" * 70)
    print("Vendor Package Loader")
    print("=" * 70)
    print()

    # Load packages file
    packages_data = load_packages_file()
    if not packages_data:
        sys.exit(1)

    packages = packages_data.get('packages', {})

    # If --list flag, just display packages and exit
    if args.list:
        display_packages(packages_data)
        sys.exit(0)

    # Display available packages
    display_packages(packages_data)

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

    # Determine which packages to load
    packages_to_load = []

    if args.all:
        packages_to_load = list(packages.keys())
        print(f"Loading ALL {len(packages_to_load)} packages...")
        print()
    elif args.package:
        if args.package in packages:
            packages_to_load = [args.package]
        else:
            print(f"❌ Package '{args.package}' not found!")
            print(f"Available packages: {', '.join(packages.keys())}")
            sys.exit(1)
    else:
        # Interactive mode
        print("Select packages to load:")
        print("Enter package IDs separated by commas (e.g., ecommerce,saas)")
        print("Or enter 'all' to load all packages")
        print()

        choice = input("Your choice: ").strip().lower()

        if choice == 'all':
            packages_to_load = list(packages.keys())
        else:
            selected = [p.strip() for p in choice.split(',')]
            for package_id in selected:
                if package_id in packages:
                    packages_to_load.append(package_id)
                else:
                    print(f"⚠️  Warning: Package '{package_id}' not found, skipping")

    if not packages_to_load:
        print("❌ No valid packages selected")
        sys.exit(1)

    # Load selected packages
    total_added = 0
    for package_id in packages_to_load:
        package = packages[package_id]
        vendors = package.get('vendors', [])

        print()
        print("=" * 70)
        print(f"Loading Package: {package['name']}")
        print(f"Vendors: {len(vendors)}")
        print("=" * 70)
        print()

        success = load_package_to_db(package_id, vendors, db_config)
        if success:
            total_added += len(vendors)

    # Final summary
    print()
    print("=" * 70)
    print("All Packages Loaded Successfully!")
    print("=" * 70)
    print(f"Total packages processed: {len(packages_to_load)}")
    print(f"Total vendors in selected packages: {total_added}")
    print()
    print("Next steps:")
    print("1. Verify vendors: docker exec cookie-scanner-db psql -U scanner -d cookie_scanner -c 'SELECT COUNT(*) FROM vendor_database;'")
    print("2. Retrain ML model with enhanced vendor features")
    print()


if __name__ == "__main__":
    main()
