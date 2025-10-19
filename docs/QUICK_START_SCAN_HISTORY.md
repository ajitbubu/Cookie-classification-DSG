# Quick Start: Scan History Feature

## What is Scan History?

The Scan History feature provides a comprehensive table view of all your cookie scans with powerful filtering, sorting, and export capabilities. It's designed to help you track compliance over time and quickly find specific scans.

## Getting Started

### Step 1: Perform Some Scans
1. Use the Cookie Scanner to scan one or more websites
2. Each scan is automatically added to your history
3. History is saved in your browser (persists across sessions)

### Step 2: View Your History
The Scan History section appears below your current scan results when you have at least one scan in history.

### Step 3: Filter Your Data

#### By Date
```
🗓️ Date From: Select start date
🗓️ Date To: Select end date
```

#### By Domain
```
🔍 Domain: Type to search (e.g., "example.com")
```

#### By Risk Level
```
⚠️ Risk Level: Choose High, Medium, or Low
```

#### By Regulation
```
📋 Regulation: GDPR, CCPA, or DPDP
```

#### By Cookie Count
```
🍪 Min/Max Cookies: Set range
```

### Step 4: Sort Your Data
Click any column header to sort:
- 📅 Scan Date & Time
- 🌐 Domain  
- 🍪 Total Cookies
- ✅ Requires Consent

Click again to reverse the sort order.

### Step 5: Take Actions

#### View a Scan
```
1. Find the scan in the table
2. Click the eye icon (👁️) in Actions
3. Full results load at the top
```

#### Delete Scans
```
Single: Click trash icon (🗑️)
Multiple: Check boxes → Click "Delete (n)"
All: Click "Clear All" button
```

#### Export Data
```
1. Apply filters (optional)
2. Click "Export CSV"
3. File downloads automatically
```

## Common Use Cases

### Use Case 1: Find Last Week's Scans
```
Filter:
✓ Date From: [7 days ago]
✓ Date To: [today]

Result: All scans from the past week
```

### Use Case 2: Find High-Risk Domains
```
Filter:
✓ Risk Level: High Risk

Result: Only scans with compliance issues
```

### Use Case 3: Track GDPR Compliance
```
Filter:
✓ Regulation: GDPR Issues
✓ Date From: [30 days ago]

Result: GDPR issues over the last month
```

### Use Case 4: Export for Reports
```
Steps:
1. Set Date Range: Last quarter
2. Set Risk Level: High Risk
3. Click "Export CSV"
4. Open in Excel/Sheets for reporting
```

## Tips & Tricks

### 💡 Tip 1: Use Date Shortcuts
Most browsers let you type dates quickly:
- "today"
- "yesterday"  
- "10/15" (current year assumed)

### 💡 Tip 2: Clear Filters Fast
Click the "Clear Filters" link at the top of the filter section to reset all filters at once.

### 💡 Tip 3: Active Filter Count
The subtitle shows how many filters are active:
> "50 of 100 scans (3 filters active)"

### 💡 Tip 4: Persistent History
Your scan history is saved automatically:
- Survives page refreshes
- Persists across browser sessions
- Stored locally (not sent to servers)

### 💡 Tip 5: Bulk Operations
Select multiple scans and delete them all at once:
1. Check the boxes for scans to delete
2. Click "Delete (n)" button
3. Confirm deletion

### 💡 Tip 6: View Statistics
The stats bar shows quick insights:
- Total filtered scans
- Average cookies per scan
- High-risk scan count

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between filters |
| Enter | Submit date/text filters |
| Space | Toggle checkboxes |
| Esc | Close modals |

## Data Privacy

### What Gets Saved?
- Scan timestamp
- Domain name
- Cookie counts
- Risk assessments
- Full scan results

### Where Is It Stored?
- Browser localStorage only
- Never sent to external servers
- Stays on your device

### How to Clear Data?
```
Option 1: Click "Clear All" button
Option 2: Clear browser data (localStorage)
Option 3: Use browser privacy settings
```

## Troubleshooting

### Problem: No scans showing
**Solution**: Perform at least one scan first

### Problem: Filters not working
**Solution**: Click "Clear Filters" and try again

### Problem: Export not downloading
**Solution**: Check browser download settings and allow pop-ups

### Problem: History disappeared
**Solution**: Check if browser is in private/incognito mode (history won't persist)

## Next Steps

1. ✅ Scan multiple domains to build history
2. ✅ Experiment with different filters
3. ✅ Export data for compliance reports
4. ✅ Track trends over time
5. ✅ Share insights with your team

## Need Help?

- 📚 Full Documentation: See [SCAN_HISTORY.md](./SCAN_HISTORY.md)
- 🐛 Report Issues: GitHub Issues
- 💬 Ask Questions: Discussion Forum
- 📧 Contact Support: support@cookiescanner.com

## Feature Highlights

### ✨ What Makes Scan History Special?

1. **Comprehensive Filtering**
   - 7 different filter types
   - Combine multiple filters
   - Real-time updates

2. **Smart Sorting**
   - Sort by any column
   - Visual sort indicators
   - Remembers your preference

3. **Bulk Actions**
   - Select multiple scans
   - Delete in batches
   - Export filtered data

4. **Persistent Storage**
   - Auto-save to localStorage
   - Survive browser restarts
   - No data limits (within browser quota)

5. **Compliance Focus**
   - GDPR risk tracking
   - CCPA compliance view
   - DPDP regulation filter

---

**Happy Scanning! 🍪🔍**
