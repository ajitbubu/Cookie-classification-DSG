#!/usr/bin/env python3
"""
Training Data Collection Script

This script helps collect and format cookie data for ML model training.
"""

import csv
import json
import requests
from typing import List, Dict, Any
from datetime import datetime
import argparse


def collect_cookies_from_browser():
    """
    Collect cookies from browser developer tools export.
    
    Instructions:
    1. Open Chrome DevTools (F12)
    2. Go to Application → Cookies
    3. Right-click and "Export" or copy data
    4. Save as cookies_export.json
    """
    print("📋 Browser Cookie Collection")
    print("1. Open Chrome DevTools (F12)")
    print("2. Go to Application → Cookies")
    print("3. Select each domain and copy cookie data")
    print("4. Format according to the template")
    

def collect_cookies_from_scanner(urls: List[str]) -> List[Dict[str, Any]]:
    """
    Collect cookies using the existing cookie scanner.
    
    Args:
        urls: List of URLs to scan
        
    Returns:
        List of cookie dictionaries
    """
    cookies = []
    
    for url in urls:
        print(f"🔍 Scanning {url}...")
        
        try:
            # Use the backend API to scan
            response = requests.post('http://localhost:8000/api/scan', 
                                   json={'url': url, 'scanType': 'quick'})
            
            if response.status_code == 200:
                data = response.json()
                site_cookies = data.get('cookies', [])
                
                for cookie in site_cookies:
                    # Add manual category (you need to label these)
                    cookie['category'] = 'NEEDS_LABELING'  # Manual labeling required
                    cookie['site_domain'] = url
                    cookies.append(cookie)
                    
                print(f"   ✅ Found {len(site_cookies)} cookies")
            else:
                print(f"   ❌ Failed to scan {url}")
                
        except Exception as e:
            print(f"   ❌ Error scanning {url}: {e}")
    
    return cookies


def format_cookie_for_training(cookie: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a cookie dictionary for training dataset.
    
    Args:
        cookie: Raw cookie data
        
    Returns:
        Formatted cookie for training
    """
    return {
        'name': cookie.get('name', ''),
        'domain': cookie.get('domain', ''),
        'value': cookie.get('value', '')[:50],  # Truncate for privacy
        'category': cookie.get('category', 'NEEDS_LABELING'),
        'type': 'Session' if cookie.get('expires', 0) == -1 else 'Persistent',
        'expires': cookie.get('expires', -1),
        'http_only': cookie.get('httpOnly', False),
        'secure': cookie.get('secure', False),
        'same_site': cookie.get('sameSite', 'Lax'),
        'path': cookie.get('path', '/'),
        'size': len(str(cookie.get('value', ''))),
        'is_third_party': cookie.get('isThirdParty', False),
        'requires_consent': cookie.get('requiresConsent', True),
        'purpose': cookie.get('purpose', 'Purpose not identified'),
        'site_domain': cookie.get('site_domain', '')
    }


def save_training_dataset(cookies: List[Dict[str, Any]], format_type: str = 'csv'):
    """
    Save cookies as training dataset.
    
    Args:
        cookies: List of formatted cookies
        format_type: 'csv' or 'json'
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format_type == 'csv':
        filename = f'training_cookies_{timestamp}.csv'
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            if cookies:
                writer = csv.DictWriter(f, fieldnames=cookies[0].keys())
                writer.writeheader()
                writer.writerows(cookies)
                
        print(f"✅ Saved {len(cookies)} cookies to {filename}")
        
    elif format_type == 'json':
        filename = f'training_cookies_{timestamp}.json'
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Saved {len(cookies)} cookies to {filename}")


def categorize_cookie_interactive(cookie: Dict[str, Any]) -> str:
    """
    Interactive cookie categorization.
    
    Args:
        cookie: Cookie to categorize
        
    Returns:
        Selected category
    """
    print(f"\n🍪 Cookie: {cookie['name']}")
    print(f"   Domain: {cookie['domain']}")
    print(f"   Value: {cookie['value'][:30]}...")
    print(f"   Purpose: {cookie['purpose']}")
    
    categories = [
        '1. Analytics - Tracks user behavior and site performance',
        '2. Marketing - Advertising, retargeting, social media',
        '3. Strictly Necessary - Essential for website functionality',
        '4. Functional - User preferences and settings',
        '5. Skip this cookie'
    ]
    
    for category in categories:
        print(f"   {category}")
    
    while True:
        choice = input("Select category (1-5): ").strip()
        
        if choice == '1':
            return 'Analytics'
        elif choice == '2':
            return 'Marketing'
        elif choice == '3':
            return 'Strictly Necessary'
        elif choice == '4':
            return 'Functional'
        elif choice == '5':
            return 'SKIP'
        else:
            print("Invalid choice. Please select 1-5.")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Collect training data for ML model')
    parser.add_argument('--urls', nargs='+', help='URLs to scan for cookies')
    parser.add_argument('--format', choices=['csv', 'json'], default='csv', 
                       help='Output format')
    parser.add_argument('--interactive', action='store_true', 
                       help='Interactive categorization')
    
    args = parser.parse_args()
    
    print("🎯 Cookie Training Data Collection")
    print("=" * 50)
    
    if args.urls:
        # Collect from scanner
        raw_cookies = collect_cookies_from_scanner(args.urls)
        cookies = [format_cookie_for_training(c) for c in raw_cookies]
        
        if args.interactive:
            # Interactive categorization
            categorized_cookies = []
            
            for cookie in cookies:
                if cookie['category'] == 'NEEDS_LABELING':
                    category = categorize_cookie_interactive(cookie)
                    if category != 'SKIP':
                        cookie['category'] = category
                        categorized_cookies.append(cookie)
                else:
                    categorized_cookies.append(cookie)
            
            cookies = categorized_cookies
        
        # Save dataset
        save_training_dataset(cookies, args.format)
        
        # Show statistics
        categories = {}
        for cookie in cookies:
            cat = cookie['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n📊 Dataset Statistics:")
        for category, count in categories.items():
            print(f"   {category}: {count} cookies")
        
    else:
        # Show instructions
        collect_cookies_from_browser()
        print("\n💡 Usage Examples:")
        print("python collect_training_data.py --urls https://google.com https://facebook.com")
        print("python collect_training_data.py --urls https://example.com --interactive")
        print("python collect_training_data.py --urls https://site.com --format json")


if __name__ == '__main__':
    main()