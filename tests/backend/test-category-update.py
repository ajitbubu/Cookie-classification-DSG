#!/usr/bin/env python3
"""
Test script for category management feature
"""
import asyncio
import sys
sys.path.insert(0, 'backend')

from backend.db.category_manager import CategoryManager


async def test_category_update():
    """Test category update functionality"""
    print("🧪 Testing Category Management\n")
    
    manager = CategoryManager()
    
    # Test 1: Update a category
    print("Test 1: Update category")
    success = await manager.update_category(
        scan_id="test_scan_123",
        cookie_name="ADRUM_BTa",
        cookie_domain=".xfinity.com",
        old_category="Uncategorized",
        new_category="Marketing",
        user_id="test_user"
    )
    print(f"✅ Update successful: {success}\n")
    
    # Test 2: Get category overrides
    print("Test 2: Get category overrides")
    overrides = await manager.get_category_overrides("test_scan_123")
    print(f"✅ Overrides: {len(overrides)} found")
    for key, value in overrides.items():
        print(f"   - {value['cookie_name']}: {value['old_category']} → {value['new_category']}")
    print()
    
    # Test 3: Get category history
    print("Test 3: Get category history")
    history = await manager.get_category_history("test_scan_123")
    print(f"✅ History: {len(history)} changes")
    for change in history:
        print(f"   - {change['cookie_name']}: {change['old_category']} → {change['new_category']}")
        print(f"     Updated at: {change['updated_at']}")
    print()
    
    # Test 4: Apply overrides to cookies
    print("Test 4: Apply overrides to cookies")
    test_cookies = [
        {
            "name": "ADRUM_BTa",
            "domain": ".xfinity.com",
            "category": "Uncategorized"
        },
        {
            "name": "other_cookie",
            "domain": ".example.com",
            "category": "Analytics"
        }
    ]
    
    updated_cookies = manager.apply_overrides("test_scan_123", test_cookies)
    print(f"✅ Applied overrides to {len(updated_cookies)} cookies")
    for cookie in updated_cookies:
        modified = " (modified)" if cookie.get('category_modified') else ""
        print(f"   - {cookie['name']}: {cookie['category']}{modified}")
    print()
    
    # Test 5: Multiple updates
    print("Test 5: Multiple category updates")
    await manager.update_category(
        scan_id="test_scan_123",
        cookie_name="cpp-trial",
        cookie_domain="www.xfinity.com",
        old_category="Uncategorized",
        new_category="Functional",
        user_id="test_user"
    )
    
    await manager.update_category(
        scan_id="test_scan_123",
        cookie_name="sc_session",
        cookie_domain=".xfinity.com",
        old_category="Uncategorized",
        new_category="Strictly Necessary",
        user_id="test_user"
    )
    
    history = await manager.get_category_history("test_scan_123")
    print(f"✅ Total changes: {len(history)}")
    print()
    
    print("🎉 All tests passed!")


if __name__ == "__main__":
    asyncio.run(test_category_update())
