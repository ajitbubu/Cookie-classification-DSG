# 🚀 Cookie Scanner - Setup & Run Instructions

## ✅ Your React App is Ready!

I've created a complete, production-ready React application in your `cookie-scanner` folder.

## 📁 What Was Created

```
cookie-scanner/
├── src/
│   ├── lib/
│   │   └── CookieScanner.js    ✅ Core scanning engine
│   ├── components/             ✅ React components folder
│   ├── App.jsx                 ✅ Main application
│   ├── App.css                 ✅ Styles
│   └── main.jsx                ✅ Entry point
├── public/                     ✅ Static assets folder
├── index.html                  ✅ HTML template
├── package.json                ✅ Dependencies
├── vite.config.js             ✅ Vite config
├── .eslintrc.json             ✅ ESLint config
├── .gitignore                 ✅ Git ignore
└── README.md                   ✅ Documentation
```

## 🎯 Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
cd /Users/ajitsahu/Project/UCM/DCS/cookie-scanner
npm install
```

This will install:
- React 18
- Vite (fast dev server)
- Lucide React (icons)

### Step 2: Start Development Server

```bash
npm run dev
```

The app will automatically open in your browser at `http://localhost:3000`

### Step 3: Start Scanning!

The app will automatically scan cookies when it loads. You can:
- ✅ View cookie statistics
- ✅ Filter by category
- ✅ Export as JSON/CSV/HTML
- ✅ Check GDPR & CCPA compliance

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload enabled) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Check code quality |

## 🎨 Features Included

### ✅ Core Features
- Automatic cookie scanning
- Real-time classification
- GDPR/CCPA/DPDP compliance checking
- Export to JSON, CSV, HTML
- Beautiful, responsive UI

### ✅ Cookie Categories
- Strictly Necessary
- Analytics
- Marketing
- Functional
- Social Media
- Unclassified

### ✅ UI Components
- Statistics dashboard
- Interactive cookie table
- Filter by category
- Compliance report
- Recommendations

## 🔧 Customization

### Change Colors

Edit `src/App.css`:

```css
:root {
  --primary: #667eea;        /* Change primary color */
  --secondary: #764ba2;      /* Change secondary color */
}
```

### Add Custom Classification Rules

Edit `src/lib/CookieScanner.js`:

```javascript
const scanner = new CookieScanner({
  customRules: {
    analytics: {
      patterns: ['_my_custom_cookie'],
      domains: ['myanalytics.com'],
      purpose: 'My Custom Analytics'
    }
  }
});
```

## 🐛 Troubleshooting

### Issue: Port 3000 is already in use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
npm run dev -- --port 3001
```

### Issue: Module not found

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Vite not found

```bash
# Install Vite globally
npm install -g vite
```

## 📚 Next Steps

1. **Test the App**
   - Run `npm run dev`
   - Open browser to `http://localhost:3000`
   - Click "Scan Cookies"

2. **Customize**
   - Add your company logo
   - Change colors in `App.css`
   - Add custom classification rules

3. **Deploy**
   - Build: `npm run build`
   - Deploy the `dist` folder to your hosting

## 🌐 Deployment Options

### Netlify (Easiest)
```bash
npm run build
# Drag 'dist' folder to netlify.com
```

### Vercel
```bash
npm install -g vercel
vercel
```

### Traditional Hosting
```bash
npm run build
# Upload 'dist' folder to your server
```

## 💡 Tips

- The app works best on modern browsers (Chrome, Firefox, Safari, Edge)
- It scans cookies on the current domain only
- For cross-domain scanning, use the bookmarklet feature (can be added)
- All processing happens client-side (no server needed)

## 🎉 You're All Set!

Your Cookie Scanner React app is ready to use. Just run:

```bash
cd /Users/ajitsahu/Project/UCM/DCS/cookie-scanner
npm install
npm run dev
```

Enjoy your privacy compliance tool! 🍪

---

**Questions?** Check the README.md or open an issue.
