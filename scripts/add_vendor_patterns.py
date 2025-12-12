#!/usr/bin/env python3
"""
Add Vendor Patterns Script

Utility script to add new vendor patterns to the vendor_database table.
Makes it easy to extend the cookie classification system with new vendors.

Usage:
    python3 scripts/add_vendor_patterns.py

Or programmatically:
    from scripts.add_vendor_patterns import VendorManager
    manager = VendorManager()
    manager.add_vendor(...)
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))


class VendorManager:
    """Manages vendor patterns in the database."""

    def __init__(self, db_config: Optional[dict] = None):
        """Initialize with database configuration."""
        if db_config is None:
            load_dotenv()
            db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'cookie_scanner'),
                'user': os.getenv('DB_USER', 'scanner'),
                'password': os.getenv('DB_PASSWORD', 'scanner_password')
            }
        self.db_config = db_config

    def add_vendor(
        self,
        vendor_name: str,
        vendor_domain: str,
        typical_category: str,
        cookie_name_patterns: List[str],
        domain_patterns: List[str],
        confidence_score: float = 0.90,
        source: str = 'manual'
    ) -> bool:
        """
        Add a new vendor to the database.

        Args:
            vendor_name: Name of the vendor (e.g., "HubSpot")
            vendor_domain: Primary domain (e.g., "hubspot.com")
            typical_category: One of: "Strictly Necessary", "Analytics", "Marketing", "Functional"
            cookie_name_patterns: List of cookie name patterns (supports glob: "_ga*", "exact_name")
            domain_patterns: List of domain patterns (supports glob: "*.google.com")
            confidence_score: Confidence score 0.0-1.0 (default: 0.90)
            source: Source of pattern (default: 'manual')

        Returns:
            bool: True if successful
        """
        # Validate category
        valid_categories = ['Strictly Necessary', 'Analytics', 'Marketing', 'Functional', 'Unknown']
        if typical_category not in valid_categories:
            print(f"❌ Invalid category: {typical_category}")
            print(f"   Valid categories: {', '.join(valid_categories)}")
            return False

        # Validate confidence score
        if not (0.0 <= confidence_score <= 1.0):
            print(f"❌ Confidence score must be between 0.0 and 1.0")
            return False

        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor()

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
                RETURNING id;
            """, (
                vendor_name,
                vendor_domain,
                typical_category,
                json.dumps(cookie_name_patterns),
                json.dumps(domain_patterns),
                confidence_score,
                source
            ))

            vendor_id = cursor.fetchone()[0]
            conn.commit()

            print(f"✅ Added vendor: {vendor_name}")
            print(f"   Category: {typical_category}")
            print(f"   Cookie patterns: {len(cookie_name_patterns)}")
            print(f"   Domain patterns: {len(domain_patterns)}")
            print(f"   Confidence: {confidence_score:.2f}")
            print(f"   ID: {vendor_id}")

            return True

        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding vendor: {e}")
            return False

        finally:
            cursor.close()
            conn.close()

    def list_vendors(self) -> List[dict]:
        """List all vendors in the database."""
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    vendor_name,
                    vendor_domain,
                    typical_category,
                    cookie_name_patterns,
                    domain_patterns,
                    confidence_score,
                    source,
                    created_at,
                    updated_at
                FROM vendor_database
                ORDER BY vendor_name;
            """)

            return [dict(row) for row in cursor.fetchall()]

        finally:
            cursor.close()
            conn.close()

    def search_vendor(self, cookie_name: str, domain: str) -> List[dict]:
        """Search for matching vendors."""
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    vendor_name,
                    typical_category,
                    confidence_score
                FROM vendor_database
                WHERE vendor_domain = %s
                   OR %s ILIKE ANY(
                       SELECT jsonb_array_elements_text(cookie_name_patterns)
                   )
                ORDER BY confidence_score DESC
                LIMIT 5;
            """, (domain, cookie_name))

            return [dict(row) for row in cursor.fetchall()]

        finally:
            cursor.close()
            conn.close()

    def delete_vendor(self, vendor_name: str) -> bool:
        """Delete a vendor from the database."""
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor()

        try:
            cursor.execute("""
                DELETE FROM vendor_database
                WHERE vendor_name = %s
                RETURNING id;
            """, (vendor_name,))

            deleted = cursor.fetchone()
            conn.commit()

            if deleted:
                print(f"✅ Deleted vendor: {vendor_name}")
                return True
            else:
                print(f"❌ Vendor not found: {vendor_name}")
                return False

        except Exception as e:
            conn.rollback()
            print(f"❌ Error deleting vendor: {e}")
            return False

        finally:
            cursor.close()
            conn.close()


# ============================================================================
# Pre-defined Vendor Patterns
# ============================================================================

COMMON_VENDORS = [
    {
        'vendor_name': 'HubSpot',
        'vendor_domain': 'hubspot.com',
        'typical_category': 'Marketing',
        'cookie_name_patterns': ['__hstc', '__hssc', '__hssrc', 'hubspotutk', 'messagesUtk'],
        'domain_patterns': ['*.hubspot.com', '*.hs-analytics.net', '*.hs-scripts.com'],
        'confidence_score': 0.95
    },
    {
        'vendor_name': 'IAB TCF',
        'vendor_domain': 'iab.com',
        'typical_category': 'Strictly Necessary',
        'cookie_name_patterns': ['euconsent-v2', 'IABTCF_*', 'usprivacy', 'OptanonConsent'],
        'domain_patterns': ['*.cookielaw.org', '*.onetrust.com', '*.evidon.com'],
        'confidence_score': 0.98
    },
    {
        'vendor_name': 'Google Ads',
        'vendor_domain': 'doubleclick.net',
        'typical_category': 'Marketing',
        'cookie_name_patterns': ['IDE', 'test_cookie', '__gads', '__gac_*', 'DSID'],
        'domain_patterns': ['*.doubleclick.net', '*.googlesyndication.com', '*.googleadservices.com'],
        'confidence_score': 0.95
    },
    {
        'vendor_name': 'Hotjar',
        'vendor_domain': 'hotjar.com',
        'typical_category': 'Analytics',
        'cookie_name_patterns': ['_hjid', '_hjSessionUser_*', '_hjSession_*', '_hjFirstSeen'],
        'domain_patterns': ['*.hotjar.com', '*.hotjar.io'],
        'confidence_score': 0.95
    },
    {
        'vendor_name': 'Cloudflare',
        'vendor_domain': 'cloudflare.com',
        'typical_category': 'Strictly Necessary',
        'cookie_name_patterns': ['__cflb', '__cf_bm', 'cf_clearance', '__cfduid'],
        'domain_patterns': ['*.cloudflare.com', '*.cloudflareinsights.com'],
        'confidence_score': 0.96
    },
]


def main():
    """Interactive CLI for managing vendor patterns."""
    print("=" * 70)
    print("Vendor Pattern Manager")
    print("=" * 70)
    print()

    manager = VendorManager()

    while True:
        print("\nOptions:")
        print("1. Add a vendor")
        print("2. List all vendors")
        print("3. Search for vendor match")
        print("4. Delete a vendor")
        print("5. Bulk add common vendors")
        print("6. Exit")

        choice = input("\nSelect option (1-6): ").strip()

        if choice == '1':
            # Add vendor
            print("\n--- Add New Vendor ---")
            vendor_name = input("Vendor name: ").strip()
            vendor_domain = input("Primary domain: ").strip()

            print("\nCategories: 1) Strictly Necessary, 2) Analytics, 3) Marketing, 4) Functional")
            cat_choice = input("Select category (1-4): ").strip()
            category_map = {
                '1': 'Strictly Necessary',
                '2': 'Analytics',
                '3': 'Marketing',
                '4': 'Functional'
            }
            typical_category = category_map.get(cat_choice, 'Unknown')

            print("\nEnter cookie name patterns (comma-separated, supports glob like _ga*):")
            cookie_patterns = [p.strip() for p in input("Patterns: ").split(',')]

            print("\nEnter domain patterns (comma-separated, supports glob like *.google.com):")
            domain_patterns = [p.strip() for p in input("Patterns: ").split(',')]

            confidence = float(input("Confidence score (0.0-1.0, default 0.90): ") or "0.90")

            manager.add_vendor(
                vendor_name=vendor_name,
                vendor_domain=vendor_domain,
                typical_category=typical_category,
                cookie_name_patterns=cookie_patterns,
                domain_patterns=domain_patterns,
                confidence_score=confidence
            )

        elif choice == '2':
            # List vendors
            vendors = manager.list_vendors()
            print(f"\n--- All Vendors ({len(vendors)}) ---")
            for v in vendors:
                print(f"\n{v['vendor_name']}")
                print(f"  Category: {v['typical_category']}")
                print(f"  Domain: {v['vendor_domain']}")
                print(f"  Patterns: {len(v['cookie_name_patterns'])} cookies, {len(v['domain_patterns'])} domains")
                print(f"  Confidence: {v['confidence_score']:.2f}")

        elif choice == '3':
            # Search vendor
            cookie_name = input("\nCookie name: ").strip()
            domain = input("Domain: ").strip()

            matches = manager.search_vendor(cookie_name, domain)
            if matches:
                print(f"\n--- Found {len(matches)} matches ---")
                for m in matches:
                    print(f"{m['vendor_name']}: {m['typical_category']} ({m['confidence_score']:.2f})")
            else:
                print("\n❌ No matches found")

        elif choice == '4':
            # Delete vendor
            vendor_name = input("\nVendor name to delete: ").strip()
            confirm = input(f"Are you sure you want to delete '{vendor_name}'? (yes/no): ").strip().lower()
            if confirm == 'yes':
                manager.delete_vendor(vendor_name)

        elif choice == '5':
            # Bulk add
            print(f"\n--- Bulk Add {len(COMMON_VENDORS)} Common Vendors ---")
            for vendor in COMMON_VENDORS:
                manager.add_vendor(**vendor)

        elif choice == '6':
            print("\n👋 Goodbye!")
            break

        else:
            print("❌ Invalid choice")


if __name__ == "__main__":
    main()
