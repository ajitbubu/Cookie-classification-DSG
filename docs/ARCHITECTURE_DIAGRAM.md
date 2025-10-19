# Component Architecture Diagram

## Scan History Feature Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.jsx (Main)                          │
│                                                                 │
│  State Management:                                              │
│  • scanHistory: Array<ScanEntry>                                │
│  • scanResult: ScanResult | null                                │
│  • complianceReport: ComplianceReport | null                    │
│                                                                 │
│  Functions:                                                     │
│  • handleScan() - Perform new scan                              │
│  • addToHistory() - Add scan to history + localStorage          │
│  • clearHistory() - Clear all + remove from localStorage        │
│  • deleteScan() - Delete single scan + update localStorage      │
│  • viewScan() - Load past scan results                          │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Props Flow
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               ScanHistory.jsx (Component)                       │
│                                                                 │
│  Props Received:                                                │
│  • history: Array<ScanEntry>                                    │
│  • onClearHistory: () => void                                   │
│  • onViewScan: (scan) => void                                   │
│  • onDeleteScan: (id) => void                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Local State Management                       │ │
│  │                                                           │ │
│  │  • filters: FilterState                                   │ │
│  │    - dateFrom: string                                     │ │
│  │    - dateTo: string                                       │ │
│  │    - domain: string                                       │ │
│  │    - riskLevel: 'all' | 'high' | 'medium' | 'low'        │ │
│  │    - regulation: 'all' | 'gdpr' | 'ccpa' | 'dpdp'        │ │
│  │    - minCookies: string                                   │ │
│  │    - maxCookies: string                                   │ │
│  │                                                           │ │
│  │  • sortConfig: SortConfig                                 │ │
│  │    - key: string                                          │ │
│  │    - direction: 'asc' | 'desc'                            │ │
│  │                                                           │ │
│  │  • selectedScans: Set<number>                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Computed Values (useMemo)                    │ │
│  │                                                           │ │
│  │  • filteredHistory: Array<ScanEntry>                      │ │
│  │    └─> Applies all active filters                         │ │
│  │                                                           │ │
│  │  • sortedHistory: Array<ScanEntry>                        │ │
│  │    └─> Applies sorting to filtered data                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## UI Component Hierarchy

```
ScanHistory
│
├── Header Section
│   ├── Title & Subtitle
│   │   ├── Scan count display
│   │   └── Active filter count
│   │
│   └── Action Buttons
│       ├── Delete Selected (conditional)
│       ├── Export CSV
│       └── Clear All
│
├── Filters Section
│   ├── Filter Header
│   │   ├── Filter icon + title
│   │   └── Clear Filters button (conditional)
│   │
│   └── Filter Grid (7 inputs)
│       ├── Date From (date picker)
│       ├── Date To (date picker)
│       ├── Domain (text search)
│       ├── Risk Level (dropdown)
│       ├── Regulation (dropdown)
│       ├── Min Cookies (number input)
│       └── Max Cookies (number input)
│
├── Statistics Bar
│   ├── Total Scans
│   ├── Avg Cookies
│   └── High Risk Count
│
└── Table Section
    ├── Table Header (sticky)
    │   ├── Checkbox (select all)
    │   ├── Scan Date & Time (sortable)
    │   ├── Domain (sortable)
    │   ├── Total Cookies (sortable)
    │   ├── Requires Consent (sortable)
    │   ├── GDPR Risk
    │   ├── CCPA Risk
    │   ├── DPDP Risk
    │   └── Actions
    │
    ├── Table Body
    │   └── Rows (map over sortedHistory)
    │       ├── Checkbox
    │       ├── Timestamp (formatted)
    │       ├── Domain info
    │       ├── Cookie count badge
    │       ├── Consent badge
    │       ├── GDPR risk badge
    │       ├── CCPA risk badge
    │       ├── DPDP risk badge
    │       └── Action buttons
    │           ├── View (eye icon)
    │           └── Delete (trash icon)
    │
    └── Empty State (conditional)
        ├── Calendar icon
        ├── No scans message
        └── Helpful text
```

## Data Flow Diagram

```
User Actions                Component Logic              localStorage
─────────────              ─────────────────             ─────────────

Perform Scan
    │
    ├─> handleScan()
    │       │
    │       ├─> scanner.scan()
    │       │       │
    │       │       └─> scanResult
    │       │
    │       └─> addToHistory()
    │               │
    │               ├─> Create historyEntry
    │               │
    │               ├─> setScanHistory()
    │               │       │
    │               │       └─────────────────────> Save to localStorage
    │               │
    │               └─> Update UI
    │
    │
Apply Filter
    │
    ├─> handleFilterChange()
    │       │
    │       ├─> setFilters()
    │       │       │
    │       │       └─> Trigger useMemo
    │       │               │
    │       │               ├─> filteredHistory
    │       │               │
    │       │               └─> sortedHistory
    │       │                       │
    │       │                       └─> Re-render table
    │       │
    │
Sort Column
    │
    ├─> handleSort()
    │       │
    │       ├─> setSortConfig()
    │       │       │
    │       │       └─> Trigger useMemo
    │       │               │
    │       │               └─> sortedHistory
    │       │                       │
    │       │                       └─> Re-render table
    │       │
    │
Delete Scan
    │
    ├─> onDeleteScan(id)
    │       │
    │       ├─> Filter out scan
    │       │
    │       ├─> setScanHistory()
    │       │       │
    │       │       └─────────────────────> Update localStorage
    │       │
    │       └─> Re-render
    │
    │
Export CSV
    │
    ├─> exportToCSV()
    │       │
    │       ├─> Use sortedHistory
    │       │
    │       ├─> Generate CSV string
    │       │
    │       └─> Download file
    │
    │
View Scan
    │
    ├─> onViewScan(scan)
    │       │
    │       ├─> setScanResult(scan.fullResults)
    │       │
    │       ├─> Generate compliance report
    │       │
    │       └─> Scroll to top
    │
    │
Page Refresh
    │
    └─> App initialization
            │
            └─> useState(() => {
                    │
                    ├─────────────────────> Load from localStorage
                    │
                    └─> Initialize scanHistory
```

## Filter Logic Flow

```
Input History Array
        │
        ▼
┌───────────────────┐
│   Date Filters    │
│                   │
│ IF dateFrom set:  │
│   Filter >= date  │
│                   │
│ IF dateTo set:    │
│   Filter <= date  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Domain Filter    │
│                   │
│ IF domain set:    │
│   Filter by       │
│   contains text   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Risk Level Filter │
│                   │
│ IF not 'all':     │
│   Check risk      │
│   across all      │
│   regulations     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│Regulation Filter  │
│                   │
│ IF not 'all':     │
│   Check specific  │
│   regulation risk │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Cookie Count      │
│     Filter        │
│                   │
│ IF min set:       │
│   Filter >= min   │
│                   │
│ IF max set:       │
│   Filter <= max   │
└────────┬──────────┘
         │
         ▼
    Filtered Array
        │
        ▼
┌───────────────────┐
│   Sort Logic      │
│                   │
│ Sort by:          │
│  • timestamp      │
│  • domain         │
│  • totalCookies   │
│  • requiresConsent│
│                   │
│ Direction:        │
│  • asc / desc     │
└────────┬──────────┘
         │
         ▼
    Sorted Array
        │
        ▼
   Render Table
```

## localStorage Integration

```
┌─────────────────────────────────────────────────────────────┐
│                      localStorage                           │
│                                                             │
│  Key: 'cookieScanHistory'                                   │
│                                                             │
│  Value: JSON.stringify([                                    │
│    {                                                        │
│      id: 1697565432123,                                     │
│      timestamp: "2025-10-17T10:30:00.000Z",                 │
│      domain: "example.com",                                 │
│      url: "https://example.com",                            │
│      totalCookies: 15,                                      │
│      requiresConsent: 8,                                    │
│      gdprRisk: "HIGH",                                      │
│      ccpaRisk: "MEDIUM",                                    │
│      dpdpRisk: "HIGH",                                      │
│      fullResults: { ... }                                   │
│    },                                                       │
│    // ... more scans                                        │
│  ])                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ▲                                    │
         │                                    │
    Write (Save)                         Read (Load)
         │                                    │
         │                                    ▼
┌────────┴────────────────────────────────────┬───────────────┐
│              React Component                │               │
│                                             │               │
│  On Changes:                    On Mount:  │               │
│  • Add scan                     • Initialize state         │
│  • Delete scan                  • Load from storage        │
│  • Clear all                    • Error handling           │
│                                                             │
│  With Error Handling:                                       │
│  try {                                                      │
│    localStorage.setItem(...)                                │
│  } catch (e) {                                              │
│    console.error(...)                                       │
│    // Continue without storage                              │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

```
┌─────────────────────────────────────────────────────────────┐
│                   Desktop (>1024px)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Filter 1] [Filter 2] [Filter 3] [Filter 4]        │   │
│  │ [Filter 5] [Filter 6] [Filter 7]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Full Table - All Columns Visible                    │   │
│  │ [✓] [Date] [Domain] [Cookies] [Consent] [Risks]    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Tablet (768px-1024px)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Filter 1] [Filter 2]                                │   │
│  │ [Filter 3] [Filter 4]                                │   │
│  │ [Filter 5] [Filter 6] [Filter 7]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Compact Table - Some columns stacked                │   │
│  │ [✓] [Date/Domain] [Cookies] [Risks]                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Mobile (<768px)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Filter 1]                                           │   │
│  │ [Filter 2]                                           │   │
│  │ [Filter 3]                                           │   │
│  │ [Filter 4]                                           │   │
│  │ [Filter 5]                                           │   │
│  │ [Filter 6]                                           │   │
│  │ [Filter 7]                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ← Horizontal Scroll →                                │   │
│  │ Minimal Table Width                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## State Update Patterns

```
Pattern 1: Simple State Update
──────────────────────────────
User Action → setState() → Re-render

Example:
handleFilterChange('domain', 'example')
  └─> setFilters(prev => ({ ...prev, domain: 'example' }))
      └─> Component re-renders


Pattern 2: State + localStorage
───────────────────────────────
User Action → setState() → Save to storage → Re-render

Example:
deleteScan(123)
  └─> setScanHistory(prev => {
        const updated = prev.filter(s => s.id !== 123)
        localStorage.setItem('cookieScanHistory', JSON.stringify(updated))
        return updated
      })
      └─> Component re-renders


Pattern 3: Computed State (useMemo)
───────────────────────────────────
State Change → useMemo → Compute → Re-render only if changed

Example:
filters.domain changes
  └─> useMemo(() => {
        return history.filter(s => s.domain.includes(filters.domain))
      }, [history, filters])
      └─> filteredHistory updates
          └─> Component re-renders


Pattern 4: Callback to Parent
─────────────────────────────
Child Action → Callback → Parent State → Both Re-render

Example:
ScanHistory: Click View button
  └─> onViewScan(scan)
      └─> App.jsx: viewScan(scan)
          └─> setScanResult(scan.fullResults)
              └─> Both components re-render
```

## Performance Optimization Points

```
1. useMemo for filteredHistory
   ├─ Prevents re-filtering on unrelated renders
   └─ Dependencies: [history, filters]

2. useMemo for sortedHistory
   ├─ Prevents re-sorting on unrelated renders
   └─ Dependencies: [filteredHistory, sortConfig]

3. Set for selectedScans
   ├─ O(1) lookup vs O(n) array search
   └─ Fast selection toggling

4. Debounced localStorage writes
   ├─ Could batch multiple changes
   └─ Currently immediate (acceptable for scan frequency)

5. Virtual scrolling (future)
   ├─ Only render visible rows
   └─ Needed for 1000+ scans
```

---

*This diagram shows the complete architecture of the Scan History feature, including component hierarchy, data flow, state management, and integration points.*
