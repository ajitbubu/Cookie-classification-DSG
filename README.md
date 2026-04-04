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

- **🆕 ML-Powered Classification** - Machine learning model predicts cookie categories with confidence scores
  - View ML predictions alongside actual categories
  - Update categories directly from ML suggestions
  - Visual indicators show agreement/disagreement between ML and actual categories
  - Confidence levels (High/Medium/Low) help assess prediction reliability

- **🆕 Vendor Database Integration** - 3,900+ vendor patterns for enhanced accuracy
  - IAB Global Vendor List (1,096 vendors)
  - OneTrust vendor databases (3,170 vendors)
  - 90-95% classification accuracy (up from 70%)
  - 3-5x faster classification (pattern matching vs ML)
  - Automatic vendor identification for 95%+ of cookies
  - 📖 **[Deployment Guide](./docs/vendor-integration/READY_TO_DEPLOY.md)**

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
├── backend/                     # Python API & Scanner
│   ├── api/                    # FastAPI endpoints
│   ├── db/                     # Database models & migrations
│   ├── scanner/                # Cookie scanning engine
│   └── worker/                 # Background workers
├── src/                        # React Frontend
│   ├── components/             # React components
│   ├── lib/                    # Utilities & core logic
│   └── test/                   # Frontend tests
├── tests/                      # Test Suite
│   ├── backend/                # Backend tests
│   ├── ml/                     # ML model tests
│   └── scripts/                # Test scripts
├── docs/                       # Documentation
│   ├── guides/                 # User guides
│   ├── specs/                  # Technical specs
│   └── task-completion/        # Task summaries
├── docker/                     # Docker configurations
│   ├── Dockerfile.api          # API service
│   ├── Dockerfile.frontend     # Frontend service
│   ├── Dockerfile.ml-api       # ML API service
│   └── Dockerfile.worker       # Worker service
├── scripts/                    # Utility scripts
├── data/                       # Data files
│   └── output/                 # Generated outputs
├── models/                     # ML models
├── deployment/                 # Deployment configs
├── nginx/                      # Nginx configs
├── docker-compose.yml          # Docker orchestration
├── package.json                # Node dependencies
└── requirements.txt            # Python dependencies
```

## 🔧 Usage

### Basic Scanning

The app automatically scans cookies when loaded. Click "Scan Now" to refresh.

### Scan Modes

1. **Current Domain** - Scan the domain you're currently on
2. **Enter URL** - Scan any domain (with CORS limitations)
3. **Bookmarklet** - Scan any website from your bookmarks
4. **Scheduled Scans** - Automatically scan at regular intervals

### ML Classification & Category Management

The scanner now features an intelligent ML classification system:

1. **View ML Predictions** - Each cookie shows its ML-predicted category with a confidence score
2. **Update Categories** - Click the ML Classification dropdown to update the actual category
3. **Visual Indicators**:
   - ✅ Green checkmark: ML prediction matches actual category
   - ⚠️ Orange warning: ML prediction differs from actual category
4. **Confidence Levels** - High/Medium/Low badges indicate prediction reliability

The **Category** column shows the actual stored category (read-only), while the **ML Classification** column shows the ML prediction and allows updates.

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
