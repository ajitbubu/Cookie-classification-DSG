"""
Manual Cookie Labeling Tool

Interactive tool for manually labeling cookies to expand training dataset.

Usage:
    python3 -m backend.api.ml_classifier.training.label_cookies
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from backend.api.ml_classifier.config import CATEGORIES


class CookieLabeler:
    """Interactive tool for labeling cookies."""
    
    def __init__(self, db_config: Dict):
        """Initialize labeler with database config."""
        self.db_config = db_config
        self.labels_file = Path("manual_labels.json")
        self.labels = self._load_labels()
    
    def _load_labels(self) -> Dict:
        """Load existing labels from file."""
        if self.labels_file.exists():
            with open(self.labels_file, 'r') as f:
                return json.load(f)
        return {}
    
    def _save_labels(self):
        """Save labels to file."""
        with open(self.labels_file, 'w') as f:
            json.dump(self.labels, f, indent=2)
        print(f"💾 Saved {len(self.labels)} labels to {self.labels_file}")
    
    def get_unlabeled_cookies(self, limit: int = 100) -> List[Dict]:
        """Get unlabeled cookies from database."""
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT DISTINCT
                    name,
                    domain,
                    COUNT(*) as occurrence_count
                FROM cookies
                WHERE (category IS NULL OR category = '')
                GROUP BY name, domain
                ORDER BY occurrence_count DESC
                LIMIT %s;
            """, (limit,))
            
            return [dict(row) for row in cursor.fetchall()]
            
        finally:
            cursor.close()
            conn.close()
    
    def display_cookie_info(self, cookie: Dict):
        """Display cookie information."""
        print("\n" + "=" * 70)
        print(f"Cookie: {cookie['name']}")
        print("=" * 70)
        print(f"Domain: {cookie['domain']}")
        print(f"Occurrences: {cookie.get('occurrence_count', 'N/A')}")
        print()
    
    def get_user_label(self) -> str:
        """Get label from user."""
        print("Categories:")
        for i, category in enumerate(CATEGORIES, 1):
            print(f"  {i}. {category}")
        print(f"  {len(CATEGORIES) + 1}. Skip")
        print(f"  {len(CATEGORIES) + 2}. Quit")
        print()
        
        while True:
            try:
                choice = input("Select category (1-7): ").strip()
                
                if not choice:
                    continue
                
                choice_num = int(choice)
                
                if choice_num == len(CATEGORIES) + 2:  # Quit
                    return "QUIT"
                elif choice_num == len(CATEGORIES) + 1:  # Skip
                    return "SKIP"
                elif 1 <= choice_num <= len(CATEGORIES):
                    return CATEGORIES[choice_num - 1]
                else:
                    print("Invalid choice. Please try again.")
            except ValueError:
                print("Invalid input. Please enter a number.")
            except KeyboardInterrupt:
                return "QUIT"
    
    def label_cookies_interactive(self, limit: int = 50):
        """Interactive labeling session."""
        print("=" * 70)
        print("Cookie Labeling Tool")
        print("=" * 70)
        print()
        print("This tool helps you manually label cookies for training.")
        print(f"Existing labels: {len(self.labels)}")
        print()
        
        # Get unlabeled cookies
        print(f"Fetching up to {limit} unlabeled cookies...")
        cookies = self.get_unlabeled_cookies(limit)
        
        if not cookies:
            print("✅ No unlabeled cookies found!")
            return
        
        print(f"Found {len(cookies)} unlabeled cookies")
        print()
        
        labeled_count = 0
        skipped_count = 0
        
        for i, cookie in enumerate(cookies, 1):
            # Check if already labeled
            cookie_key = f"{cookie['name']}_{cookie['domain']}"
            if cookie_key in self.labels:
                continue
            
            # Display cookie info
            self.display_cookie_info(cookie)
            print(f"Progress: {i}/{len(cookies)}")
            
            # Get label
            label = self.get_user_label()
            
            if label == "QUIT":
                print("\n👋 Quitting...")
                break
            elif label == "SKIP":
                skipped_count += 1
                continue
            else:
                # Save label
                self.labels[cookie_key] = {
                    'name': cookie['name'],
                    'domain': cookie['domain'],
                    'category': label,
                    'labeled_at': str(Path(__file__).parent)
                }
                labeled_count += 1
                print(f"✅ Labeled as: {label}")
                
                # Save periodically
                if labeled_count % 10 == 0:
                    self._save_labels()
        
        # Final save
        self._save_labels()
        
        print("\n" + "=" * 70)
        print("Labeling Session Complete")
        print("=" * 70)
        print(f"Labeled: {labeled_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Total labels: {len(self.labels)}")
        print()
    
    def export_labels_to_dataset(self, output_file: str = "labeled_cookies.json"):
        """Export labels in dataset format."""
        cookies = []
        
        for cookie_key, label_data in self.labels.items():
            cookies.append({
                'name': label_data['name'],
                'domain': label_data['domain'],
                'category': label_data['category']
            })
        
        with open(output_file, 'w') as f:
            json.dump(cookies, f, indent=2)
        
        print(f"✅ Exported {len(cookies)} labeled cookies to {output_file}")


def main():
    """Run labeling tool."""
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
    
    # Create labeler
    labeler = CookieLabeler(db_config)
    
    # Run interactive labeling
    try:
        labeler.label_cookies_interactive(limit=100)
        
        # Export labels
        labeler.export_labels_to_dataset()
        
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
        labeler._save_labels()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
