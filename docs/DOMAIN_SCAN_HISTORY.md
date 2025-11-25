# Domain-Based Scan History Feature

## Overview
The Domain-Based Scan History feature provides a comprehensive versioning system for tracking all scans organized by domain. This allows you to view historical scan data, compare versions, and drill down into page-level and cookie-level details.

## Features

### 1. Domain Organization
- All scans are automatically grouped by domain
- Each domain shows the total number of scans performed
- Latest scan information is displayed at the domain level

### 2. Version History
- Each scan is versioned (Version 1, Version 2, etc.)
- Scans are ordered from newest to oldest
- Each version shows:
  - Timestamp
  - Scan type (quick/deep)
  - Total cookies found
  - Consent requirements
  - Third-party cookies
  - GDPR, CCPA, and DPDP risk levels

### 3. Page-Level Details
- For deep scans, view all pages that were scanned
- Each page shows:
  - Full URL (clickable)
  - Number of cookies found on that page
  - Scan duration
  - List of all cookies found on that page

### 4. Cookie-Level Details
- View all cookies found on each page
- Each cookie displays:
  - Cookie name
  - Category (Strictly Necessary, Analytics, Marketing, etc.)
  - Color-coded badges for easy identification

### 5. Actions Available

#### Domain Level
- **Expand/Collapse**: Click domain header to show/hide scan versions
- **Delete Domain**: Remove all scans for a specific domain

#### Scan Version Level
- **View Results**: Load the full scan results into the main view
- **View Pages**: Expand to see all scanned pages and their cookies
- **Delete Scan**: Remove a specific scan version

## How to Use

### Viewing Scan History
1. After performing any scan (quick or deep), it's automatically saved
2. Scroll down to the "Scan History by Domain" section
3. Click on any domain to expand and see all scan versions

### Viewing Page Details
1. Expand a domain to see its scan versions
2. Click the "Pages" button on any scan version
3. The page details section will expand showing:
   - All URLs scanned
   - Cookies found on each page
   - Cookie categories

### Comparing Scans
1. View multiple versions of scans for the same domain
2. Compare cookie counts, categories, and risk levels across versions
3. Track changes over time

### Managing History
- **Delete Individual Scans**: Click the trash icon next to any scan version
- **Delete All Scans for a Domain**: Click the trash icon in the domain header
- Confirmation dialogs prevent accidental deletions

## Data Storage

### Local Storage
- All scan history is stored in browser localStorage
- Two storage keys are used:
  - `domainScanHistory`: Domain-organized scan data
  - `cookieScanHistory`: Flat list for backward compatibility

### Data Structure
```javascript
{
  "example.com": [
    {
      "id": "unique-id",
      "timestamp": "2025-11-21T21:00:00.000Z",
      "domain": "example.com",
      "url": "https://example.com",
      "totalCookies": 45,
      "requiresConsent": 30,
      "thirdParty": 15,
      "categories": { "Analytics": 20, "Marketing": 10, ... },
      "types": { "session": 10, "persistent": 35 },
      "gdprRisk": "HIGH",
      "ccpaRisk": "MEDIUM",
      "dpdpRisk": "HIGH",
      "scanType": "deep",
      "fullResults": {
        "cookies": [...],
        "pageResults": [...],
        "statistics": {...}
      }
    }
  ]
}
```

## Benefits

### For Compliance Teams
- Track cookie changes over time
- Document compliance efforts
- Generate historical reports
- Monitor third-party cookie usage

### For Developers
- Debug cookie issues across different pages
- Understand cookie propagation
- Identify unnecessary cookies
- Optimize cookie usage

### For Scheduled Scans
- Perfect for automated monitoring
- Track changes between scheduled scans
- Alert on new cookies or categories
- Historical trend analysis

## UI Components

### Domain Header
- Domain name with icon
- Scan count badge
- Latest scan timestamp
- Quick stats (cookies, date)
- Delete domain button

### Scan Version Card
- Version badge (color-coded)
- Timestamp
- Scan type badge
- Statistics grid showing:
  - Total cookies
  - Consent requirements
  - Third-party cookies
  - Risk levels (GDPR, CCPA, DPDP)
- Action buttons (View Results, Pages, Delete)

### Page Details Section
- Expandable list of all scanned pages
- Each page shows:
  - URL with external link
  - Cookie count
  - Duration (if available)
  - List of cookies with category badges

## Best Practices

1. **Regular Scanning**: Schedule regular scans to build a comprehensive history
2. **Version Comparison**: Compare versions to track changes
3. **Page Analysis**: Use page-level details to identify cookie sources
4. **Cleanup**: Periodically delete old scans to manage storage
5. **Export**: Use the export feature before deleting important scans

## Technical Details

### Components
- `DomainScanHistory.jsx`: Main component
- `DomainScanHistory.css`: Styling

### State Management
- React useState for component state
- localStorage for persistence
- Automatic sync between domain and flat history

### Performance
- Lazy loading of page details
- Efficient filtering and sorting
- Optimized re-renders

## Future Enhancements

Potential improvements:
- Export domain history to CSV/JSON
- Compare two specific scan versions side-by-side
- Filter scans by date range
- Search across all domains
- Tag/label important scans
- Cloud sync for team collaboration
