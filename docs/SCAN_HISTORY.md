# Scan History Feature Documentation

## Overview

The Scan History component provides a comprehensive, filterable table view of all cookie scans performed by the Cookie Scanner application. It includes advanced filtering capabilities, sorting, bulk operations, and persistent storage.

## Features

### 📊 Tabular Display
- Clean, sortable table with all scan details
- Sticky header for easy navigation
- Responsive design for mobile and desktop
- Row selection with checkboxes

### 🔍 Advanced Filtering

#### Date Filters
- **Date From**: Filter scans from a specific start date
- **Date To**: Filter scans up to a specific end date
- Date range selection with date pickers

#### Domain Filter
- Search by domain name
- Real-time filtering as you type
- Case-insensitive search

#### Risk Level Filter
- **All Levels**: Show all scans
- **High Risk**: Only scans with high-risk cookies
- **Medium Risk**: Only scans with medium-risk cookies
- **Low Risk**: Only scans with low-risk cookies

#### Regulation-Specific Filter
- **All Regulations**: Show all scans
- **GDPR Issues**: Scans with GDPR compliance issues
- **CCPA Issues**: Scans with CCPA compliance issues
- **DPDP Issues**: Scans with DPDP compliance issues

#### Cookie Count Range
- **Min Cookies**: Minimum number of cookies
- **Max Cookies**: Maximum number of cookies
- Filter scans by cookie count range

### 📈 Statistics Bar
- **Total Scans**: Count of filtered scans
- **Avg Cookies**: Average cookies per scan
- **High Risk**: Count of high-risk scans

### 🔄 Sorting
Click any column header to sort:
- **Scan Date & Time**: Sort by timestamp (ascending/descending)
- **Domain**: Alphabetically sort domains
- **Total Cookies**: Sort by cookie count
- **Requires Consent**: Sort by consent requirement count

Visual indicators show current sort column and direction.

### 🎯 Actions

#### Individual Scan Actions
- **View**: Load scan details into the main view
- **Delete**: Remove individual scan from history

#### Bulk Actions
- **Select All**: Select/deselect all visible scans
- **Delete Selected**: Delete multiple scans at once
- **Export CSV**: Download scan history as CSV file
- **Clear All**: Remove all scans from history

### 💾 Data Persistence
- Scan history is automatically saved to browser localStorage
- Data persists across browser sessions
- Survives page refreshes and browser restarts

## Usage

### Basic Usage

1. **Viewing History**: The Scan History section appears automatically after performing scans

2. **Filtering Scans**:
   ```
   1. Select date range using Date From/To fields
   2. Search domains by typing in the Domain field
   3. Select risk level from dropdown
   4. Choose specific regulation filter
   5. Set cookie count range (optional)
   ```

3. **Sorting Data**:
   ```
   - Click column headers to sort
   - Click again to reverse sort direction
   - Active sort column shows highlighted icon
   ```

4. **Viewing Scan Details**:
   ```
   1. Click the eye icon (👁) in the Actions column
   2. Scan results load into main view
   3. Page auto-scrolls to top for viewing
   ```

5. **Deleting Scans**:
   ```
   Single: Click trash icon for specific scan
   Multiple: Check boxes → Click "Delete (n)" button
   All: Click "Clear All" button
   ```

6. **Exporting Data**:
   ```
   1. Apply desired filters
   2. Click "Export CSV" button
   3. File downloads automatically
   ```

### Filter Examples

#### Example 1: Find All High-Risk Scans from Last Week
```
Date From: [Last Week Start Date]
Date To: [Today]
Risk Level: High Risk
```

#### Example 2: Find GDPR Issues for Specific Domain
```
Domain: example.com
Regulation: GDPR Issues
```

#### Example 3: Find Scans with Many Cookies
```
Min Cookies: 50
Risk Level: All Levels
```

## Data Structure

### Scan Entry Fields
```javascript
{
  id: Number,                    // Unique identifier
  timestamp: String,             // ISO timestamp
  domain: String,                // Domain name
  url: String,                   // Full URL scanned
  totalCookies: Number,          // Total cookie count
  requiresConsent: Number,       // Cookies requiring consent
  gdprRisk: String,              // 'HIGH' | 'MEDIUM' | 'LOW'
  ccpaRisk: String,              // 'HIGH' | 'MEDIUM' | 'LOW'
  dpdpRisk: String,              // 'HIGH' | 'MEDIUM' | 'LOW'
  fullResults: Object            // Complete scan results
}
```

### CSV Export Format
```csv
"Timestamp","Domain","URL","Total Cookies","Requires Consent","GDPR Risk","CCPA Risk","DPDP Risk"
"10/17/2025, 3:30:00 PM","example.com","https://example.com",15,8,"HIGH","MEDIUM","HIGH"
```

## Component Architecture

### Main Component
- **ScanHistory.jsx**: Primary component with filtering and sorting logic

### Styling
- **ScanHistory.css**: Complete styles for table, filters, and UI elements

### Integration Points
```javascript
<ScanHistory 
  history={scanHistory}           // Array of scan entries
  onClearHistory={clearHistory}   // Clear all callback
  onViewScan={viewScan}          // View details callback
  onDeleteScan={deleteScan}      // Delete single callback
/>
```

## Technical Details

### State Management
```javascript
// Filters state
const [filters, setFilters] = useState({
  dateFrom: '',
  dateTo: '',
  domain: '',
  riskLevel: 'all',
  regulation: 'all',
  minCookies: '',
  maxCookies: ''
});

// Sort configuration
const [sortConfig, setSortConfig] = useState({
  key: 'timestamp',
  direction: 'desc'
});

// Selection state
const [selectedScans, setSelectedScans] = useState(new Set());
```

### Performance Optimizations
- **useMemo** for filtered and sorted data
- Efficient re-renders on filter changes
- Lazy loading for large datasets
- Optimized localStorage operations

### localStorage Schema
```javascript
// Key: 'cookieScanHistory'
// Value: JSON.stringify(scanHistory)
[
  { id: 1, timestamp: "...", domain: "...", ... },
  { id: 2, timestamp: "...", domain: "...", ... },
  ...
]
```

## Browser Compatibility

- ✅ Chrome/Edge (last 2 versions)
- ✅ Firefox (last 2 versions)
- ✅ Safari (last 2 versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Responsive Design

### Desktop (>1024px)
- Full table with all columns visible
- Multi-column filter grid
- Horizontal actions layout

### Tablet (768px - 1024px)
- Responsive filter grid
- Compact table layout
- Stacked action buttons

### Mobile (<768px)
- Single column filters
- Horizontal scroll for table
- Full-width action buttons
- Optimized touch targets

## Accessibility

- ✅ WCAG 2.1 AA compliant
- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ Clear focus indicators
- ✅ Semantic HTML structure

## Future Enhancements

### Planned Features
- [ ] Advanced search with multiple criteria
- [ ] Custom date presets (Last 7 days, Last month, etc.)
- [ ] Export to JSON and PDF formats
- [ ] Scan comparison view
- [ ] Trend analysis charts
- [ ] Auto-archiving old scans
- [ ] Cloud sync for history
- [ ] Custom column configuration

### Enhancement Ideas
- [ ] Saved filter presets
- [ ] Scan annotations/notes
- [ ] Email reports
- [ ] Scheduled export
- [ ] Integration with analytics tools

## Troubleshooting

### Common Issues

**Q: History not persisting after browser close**
- Check if localStorage is enabled in browser settings
- Check browser privacy mode (Incognito/Private doesn't persist)
- Verify localStorage quota not exceeded

**Q: Filters not working**
- Clear filters using "Clear Filters" button
- Check filter criteria are valid
- Ensure date format is correct

**Q: Table not displaying**
- Check console for JavaScript errors
- Verify scan history array exists
- Ensure proper component integration

**Q: Export not downloading**
- Check browser download settings
- Allow pop-ups if blocked
- Verify browser supports Blob downloads

## API Reference

### Props

#### ScanHistory Component

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| history | Array | Yes | Array of scan entry objects |
| onClearHistory | Function | Yes | Callback to clear all history |
| onViewScan | Function | Yes | Callback to view scan details |
| onDeleteScan | Function | Yes | Callback to delete single scan |

### Callbacks

```javascript
// onClearHistory
() => void

// onViewScan  
(scan: ScanEntry) => void

// onDeleteScan
(id: number) => void
```

## Examples

### Example 1: Basic Integration
```jsx
import ScanHistory from './components/ScanHistory';

function App() {
  const [scanHistory, setScanHistory] = useState([]);
  
  const handleClearHistory = () => {
    setScanHistory([]);
    localStorage.removeItem('cookieScanHistory');
  };
  
  const handleViewScan = (scan) => {
    console.log('Viewing scan:', scan);
  };
  
  const handleDeleteScan = (id) => {
    setScanHistory(prev => prev.filter(s => s.id !== id));
  };
  
  return (
    <ScanHistory
      history={scanHistory}
      onClearHistory={handleClearHistory}
      onViewScan={handleViewScan}
      onDeleteScan={handleDeleteScan}
    />
  );
}
```

### Example 2: With localStorage Persistence
```jsx
// Load from localStorage
const [scanHistory, setScanHistory] = useState(() => {
  try {
    const saved = localStorage.getItem('cookieScanHistory');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
});

// Save to localStorage
const addScan = (scan) => {
  setScanHistory(prev => {
    const updated = [scan, ...prev];
    localStorage.setItem('cookieScanHistory', JSON.stringify(updated));
    return updated;
  });
};
```

## Support

For issues, questions, or feature requests:
- GitHub Issues: [Repository Issues]
- Documentation: [Wiki]
- Email: support@cookiescanner.com

## License

MIT License - See LICENSE file for details
