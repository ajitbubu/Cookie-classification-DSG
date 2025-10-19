# 🍪 Cookie Scanner - React Application

A comprehensive, production-ready React application for scanning, classifying, and managing website cookies in compliance with GDPR, CCPA/CPRA, and DPDP regulations.

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

The app will open at `http://localhost:3000`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## ✨ Features

### Core Scanning Features
- **Automatic Cookie Classification** - Intelligently categorizes cookies into:
  - Strictly Necessary
  - Analytics
  - Marketing
  - Functional
  - Social Media
  - Unclassified

- **Multi-Jurisdiction Compliance** 
  - GDPR (EU) compliance checking
  - CCPA/CPRA (California) compliance
  - DPDP (India) compliance

- **Export Capabilities**
  - Export scan results as JSON
  - Export as CSV for spreadsheets
  - Export as HTML report

- **Real-time Scanning** - Instantly scan cookies on the current domain

- **Beautiful UI** - Modern, responsive interface with dark mode support

- **Compliance Recommendations** - Actionable insights for improving privacy compliance

### 🆕 Scan History (NEW)
- **Comprehensive History Table** - View all past scans in a sortable, filterable table
- **Advanced Filtering** - Filter by date range, domain, risk level, regulation, and cookie count
- **Bulk Operations** - Select multiple scans for batch deletion
- **Persistent Storage** - History automatically saved to browser localStorage
- **CSV Export** - Export filtered history for compliance reporting
- **Detailed View** - Click any scan to reload full results
- **Risk Tracking** - Track GDPR, CCPA, and DPDP compliance over time

📖 **[Quick Start Guide](./docs/QUICK_START_SCAN_HISTORY.md)** | **[Full Documentation](./docs/SCAN_HISTORY.md)**

## 📁 Project Structure

```
cookie-scanner/
├── src/
│   ├── components/
│   │   ├── ScanHistory.jsx     # 🆕 Scan history component
│   │   └── ScanHistory.css     # 🆕 History styles
│   ├── lib/
│   │   ├── CookieScanner.js    # Core scanning engine
│   │   └── utils.js            # Utility functions
│   ├── App.jsx                  # Main application component
│   ├── App.css                  # Application styles
│   └── main.jsx                 # Entry point
├── docs/
│   ├── SCAN_HISTORY.md         # 🆕 Full history documentation
│   └── QUICK_START_SCAN_HISTORY.md # 🆕 Quick start guide
├── public/                      # Static assets
├── index.html                   # HTML template
├── vite.config.js              # Vite configuration
└── package.json                # Dependencies
```

## 🔧 Usage

### Basic Scanning

The app automatically scans cookies when loaded. Click "Scan Now" to refresh.

### Scan Modes

1. **Current Domain** - Scan the domain you're currently on
2. **Enter URL** - Scan any domain (with CORS limitations)
3. **Bookmarklet** - Scan any website from your bookmarks
4. **Scheduled Scans** - Automatically scan at regular intervals

### Filtering

Use the dropdown menus to filter cookies by:
- Category (Strictly Necessary, Analytics, Marketing, etc.)
- Regulation (GDPR, CCPA, DPDP)

### Scan History

View and manage your scan history:
1. **Filter** by date, domain, risk level, regulation, or cookie count
2. **Sort** by clicking column headers
3. **View** past scans by clicking the eye icon
4. **Delete** individual or multiple scans
5. **Export** history as CSV for reporting

See the [Scan History Quick Start](./docs/QUICK_START_SCAN_HISTORY.md) for detailed instructions.

### Exporting

Click the export buttons (JSON, CSV, HTML) to download scan results.

### Compliance Analysis

View GDPR, CCPA, and DPDP compliance status with actionable recommendations.

## 📚 Cookie Categories

| Category | Description | Requires Consent |
|----------|-------------|------------------|
| **Strictly Necessary** | Essential for website functionality | ❌ No |
| **Analytics** | Usage tracking and statistics | ✅ Yes |
| **Marketing** | Advertising and targeting | ✅ Yes |
| **Functional** | User preferences and settings | ⚠️ Recommended |
| **Social Media** | Social platform integration | ✅ Yes |
| **Unclassified** | Unknown or uncategorized | ✅ Yes |

## 🛠️ Technology Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Lucide React** - Icons
- **Vanilla CSS** - Styling (no frameworks)

## 📦 Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "lucide-react": "^0.263.1"
}
```

## 🎨 Customization

### Custom Classification Rules

Modify `src/lib/CookieScanner.js` to add custom patterns:

```javascript
const scanner = new CookieScanner({
  customRules: {
    analytics: {
      patterns: ['_custom_analytics'],
      domains: ['myanalytics.com'],
      purpose: 'Custom Analytics'
    }
  }
});
```

### Styling

Edit `src/App.css` to customize colors, fonts, and layout.

## 🔒 Privacy & Security

- All scanning happens client-side
- No data is sent to external servers
- No tracking or analytics in the library itself
- Open source and auditable

## 📝 License

MIT License - see LICENSE file for details

## 👥 Author

**Ajit Sahu**  
UCM DCS Project

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for privacy compliance



# UCM-Redesign
