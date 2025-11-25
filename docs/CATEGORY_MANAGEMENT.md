# Category Management Feature

## Overview

The Category Management feature allows users to manually reclassify cookies after scanning. This is essential for:
- **Correcting misclassifications** by the automatic classifier
- **Customizing categories** based on business requirements
- **Maintaining consistency** across multiple scans
- **Audit trails** for compliance purposes

## Features

### 1. **Editable Categories**
- Click on any category in the cookies table to change it
- Dropdown shows all available categories with color coding
- Changes are saved immediately
- Visual feedback during update

### 2. **Persistent Storage**
- Category changes are saved to the backend
- Changes persist across browser sessions
- Each scan maintains its own category overrides
- History of all changes is tracked

### 3. **Available Categories**

| Category | Description | Color | Use Case |
|----------|-------------|-------|----------|
| **Strictly Necessary** | Essential for website functionality | Green (#00C4A8) | Login, shopping cart, security |
| **Functional** | Enhance website features | Blue (#3D8BFF) | Language preferences, chat widgets |
| **Analytics** | Track usage and performance | Yellow (#FFBC32) | Google Analytics, heatmaps |
| **Marketing** | Advertising and targeting | Red (#FF4D4D) | Ad networks, retargeting |
| **Preferences** | Remember user settings | Purple (#9B59B6) | Theme, layout preferences |
| **Uncategorized** | Not yet classified | Gray (#95A5A6) | Unknown or new cookies |

## User Interface

### Category Dropdown
```
┌─────────────────────────┐
│  Marketing        ▼     │  ← Click to open
└─────────────────────────┘

Opens to:

┌─────────────────────────┐
│ ● Strictly Necessary    │
│ ● Functional            │
│ ● Analytics             │
│ ● Marketing          ✓  │  ← Currently selected
│ ● Preferences           │
│ ● Uncategorized         │
└─────────────────────────┘
```

### Visual States

**Normal State:**
- Category displayed as colored badge
- Dropdown icon indicates it's clickable

**Hover State:**
- Border highlights
- Shadow appears
- Cursor changes to pointer

**Open State:**
- Dropdown menu appears below
- All categories listed with color indicators
- Current category marked with checkmark

**Updating State:**
- Loading spinner overlay
- Dropdown disabled during update
- Success feedback after update

## API Endpoints

### 1. Update Category
```http
POST /api/categories/update-category
Content-Type: application/json

{
  "scan_id": "scan_123",
  "cookie_name": "ADRUM_BTa",
  "cookie_domain": ".xfinity.com",
  "old_category": "Uncategorized",
  "new_category": "Marketing",
  "user_id": "user_456"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "cookie_name": "ADRUM_BTa",
  "old_category": "Uncategorized",
  "new_category": "Marketing",
  "updated_at": "2025-11-22T10:30:00Z"
}
```

### 2. Get Category History
```http
GET /api/categories/category-history/{scan_id}
```

**Response:**
```json
{
  "scan_id": "scan_123",
  "changes": [
    {
      "cookie_name": "ADRUM_BTa",
      "cookie_domain": ".xfinity.com",
      "old_category": "Uncategorized",
      "new_category": "Marketing",
      "updated_at": "2025-11-22T10:30:00Z",
      "user_id": "user_456"
    }
  ],
  "total_changes": 1
}
```

### 3. Get Available Categories
```http
GET /api/categories/available-categories
```

**Response:**
```json
{
  "categories": [
    {
      "value": "Strictly Necessary",
      "label": "Strictly Necessary",
      "description": "Essential for website functionality",
      "color": "#00C4A8"
    },
    // ... more categories
  ]
}
```

### 4. Bulk Update Categories
```http
POST /api/categories/bulk-update-categories
Content-Type: application/json

[
  {
    "scan_id": "scan_123",
    "cookie_name": "cookie1",
    "cookie_domain": "example.com",
    "old_category": "Uncategorized",
    "new_category": "Analytics"
  },
  {
    "scan_id": "scan_123",
    "cookie_name": "cookie2",
    "cookie_domain": "example.com",
    "old_category": "Uncategorized",
    "new_category": "Marketing"
  }
]
```

**Response:**
```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    { "cookie_name": "cookie1", "success": true },
    { "cookie_name": "cookie2", "success": true }
  ]
}
```

## Data Storage

### File-Based Storage (Default)
```
data/
└── category_overrides/
    ├── scan_123.json
    ├── scan_456.json
    └── scan_789.json
```

**File Format:**
```json
{
  "ADRUM_BTa|.xfinity.com": {
    "cookie_name": "ADRUM_BTa",
    "cookie_domain": ".xfinity.com",
    "old_category": "Uncategorized",
    "new_category": "Marketing",
    "updated_at": "2025-11-22T10:30:00Z",
    "user_id": "user_456"
  }
}
```

### Database Storage (PostgreSQL)

**Table: category_overrides**
```sql
CREATE TABLE category_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id VARCHAR(255) NOT NULL,
    cookie_name VARCHAR(255) NOT NULL,
    cookie_domain VARCHAR(255) NOT NULL,
    old_category VARCHAR(100) NOT NULL,
    new_category VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    UNIQUE(scan_id, cookie_name, cookie_domain)
);

CREATE INDEX idx_category_overrides_scan_id ON category_overrides(scan_id);
CREATE INDEX idx_category_overrides_updated_at ON category_overrides(updated_at DESC);
```

## Usage Examples

### Frontend (React)

```jsx
import CategoryDropdown from './components/CategoryDropdown';

function CookiesTable({ cookies, scanId }) {
  const [updatedCookies, setUpdatedCookies] = useState(cookies);

  const handleCategoryChange = (name, domain, newCategory) => {
    // Update local state
    const updated = updatedCookies.map(cookie => {
      if (cookie.name === name && cookie.domain === domain) {
        return { ...cookie, category: newCategory };
      }
      return cookie;
    });
    setUpdatedCookies(updated);
  };

  return (
    <table>
      <tbody>
        {updatedCookies.map(cookie => (
          <tr key={`${cookie.name}-${cookie.domain}`}>
            <td>{cookie.name}</td>
            <td>
              <CategoryDropdown
                currentCategory={cookie.category}
                cookieName={cookie.name}
                cookieDomain={cookie.domain}
                scanId={scanId}
                onCategoryChange={handleCategoryChange}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Backend (Python)

```python
from backend.db.category_manager import get_category_manager

# Get manager instance
manager = get_category_manager()

# Update a category
await manager.update_category(
    scan_id="scan_123",
    cookie_name="ADRUM_BTa",
    cookie_domain=".xfinity.com",
    old_category="Uncategorized",
    new_category="Marketing",
    user_id="user_456"
)

# Get category overrides for a scan
overrides = await manager.get_category_overrides("scan_123")

# Apply overrides to cookies
cookies = [...]  # List of cookies
updated_cookies = manager.apply_overrides("scan_123", cookies)

# Get change history
history = await manager.get_category_history("scan_123")
```

## Compliance & Audit

### Audit Trail
Every category change is logged with:
- **Who**: User ID (if available)
- **What**: Cookie name, domain, old/new category
- **When**: Timestamp of change
- **Where**: Scan ID

### Export Audit Report
```python
# Get all changes for a scan
history = await manager.get_category_history("scan_123")

# Export to CSV
import csv
with open('audit_report.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'cookie_name', 'cookie_domain', 
        'old_category', 'new_category',
        'updated_at', 'user_id'
    ])
    writer.writeheader()
    writer.writerows(history)
```

## Best Practices

### 1. **Review Before Changing**
- Understand the cookie's purpose
- Check the cookie's domain and value
- Consult with legal/compliance team if unsure

### 2. **Consistent Categorization**
- Use the same categories across scans
- Document your categorization rules
- Train team members on category definitions

### 3. **Regular Audits**
- Review category changes monthly
- Check for patterns in misclassifications
- Update automatic classifier based on patterns

### 4. **Backup Changes**
- Export category overrides regularly
- Store in version control
- Document reasons for changes

## Troubleshooting

### Category Not Updating
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Check network tab for failed requests
4. Ensure scan_id is correct

### Changes Not Persisting
1. Check file permissions on `data/category_overrides/`
2. Verify database connection (if using PostgreSQL)
3. Check backend logs for errors
4. Ensure sufficient disk space

### Dropdown Not Opening
1. Check for JavaScript errors
2. Verify CategoryDropdown component is imported
3. Check CSS is loaded
4. Clear browser cache

## Future Enhancements

### Short Term
- [ ] Bulk category update UI
- [ ] Category change suggestions based on ML
- [ ] Export/import category mappings
- [ ] Category change notifications

### Medium Term
- [ ] Multi-user collaboration
- [ ] Category approval workflow
- [ ] Integration with compliance tools
- [ ] Custom category definitions

### Long Term
- [ ] AI-powered categorization
- [ ] Industry-specific category templates
- [ ] Regulatory compliance scoring
- [ ] Automated category recommendations

---

## Summary

The Category Management feature provides:
- ✅ **Easy reclassification** with dropdown UI
- ✅ **Persistent storage** across sessions
- ✅ **Audit trail** for compliance
- ✅ **Bulk operations** for efficiency
- ✅ **API-first design** for integrations
- ✅ **Flexible storage** (file or database)

This ensures accurate cookie categorization for GDPR, CCPA, and DPDP compliance.
