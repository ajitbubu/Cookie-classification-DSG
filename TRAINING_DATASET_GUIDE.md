# 🎯 ML Model Training Dataset Guide

## 📊 Ideal Dataset Structure for Retraining

### **Required Data Format**

The ML model requires labeled cookie data in a specific format. Here are the recommended structures:

---

## 🗂️ **Option 1: CSV Format (Recommended)**

### **File: `training_cookies.csv`**

```csv
name,domain,value,category,type,expires,http_only,secure,same_site,path,size,is_third_party,requires_consent,purpose,site_domain
_ga,google-analytics.com,GA1.2.123456789.1234567890,Analytics,Persistent,730,false,false,Lax,/,27,true,true,Tracks user behavior and site performance,example.com
_gid,google-analytics.com,GA1.2.987654321.0987654321,Analytics,Persistent,1,false,false,Lax,/,27,true,true,Tracks user behavior and site performance,example.com
_fbp,facebook.com,fb.1.1234567890123.1234567890,Marketing,Persistent,90,false,true,Lax,/,32,true,true,Facebook pixel for advertising,example.com
sessionid,example.com,abc123def456,Strictly Necessary,Session,-1,true,true,Strict,/,12,false,false,User session management,example.com
preferences,example.com,theme=dark&lang=en,Functional,Persistent,365,false,false,Lax,/,20,false,true,User preferences and settings,example.com
```

### **Required Columns:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `name` | string | Cookie name | `_ga`, `sessionid` |
| `domain` | string | Cookie domain | `google-analytics.com`, `.example.com` |
| `value` | string | Cookie value (can be anonymized) | `GA1.2.123456789` |
| `category` | string | Target classification | `Analytics`, `Marketing`, `Strictly Necessary`, `Functional` |
| `type` | string | Cookie type | `Persistent`, `Session` |
| `expires` | number | Days until expiry (-1 for session) | `730`, `90`, `-1` |
| `http_only` | boolean | HTTP-only flag | `true`, `false` |
| `secure` | boolean | Secure flag | `true`, `false` |
| `same_site` | string | SameSite policy | `Strict`, `Lax`, `None` |
| `path` | string | Cookie path | `/`, `/admin` |
| `size` | number | Cookie size in bytes | `27`, `156` |
| `is_third_party` | boolean | Third-party cookie | `true`, `false` |
| `requires_consent` | boolean | Requires user consent | `true`, `false` |
| `purpose` | string | Cookie purpose description | `Tracks user behavior` |
| `site_domain` | string | Website where cookie was found | `example.com` |

---

## 🗂️ **Option 2: JSON Format**

### **File: `training_cookies.json`**

```json
[
  {
    "name": "_ga",
    "domain": "google-analytics.com",
    "value": "GA1.2.123456789.1234567890",
    "category": "Analytics",
    "type": "Persistent",
    "expires": 730,
    "http_only": false,
    "secure": false,
    "same_site": "Lax",
    "path": "/",
    "size": 27,
    "is_third_party": true,
    "requires_consent": true,
    "purpose": "Tracks user behavior and site performance",
    "site_domain": "example.com",
    "vendor": "Google Analytics",
    "vendor_confidence": 0.95
  },
  {
    "name": "_fbp",
    "domain": "facebook.com",
    "value": "fb.1.1234567890123.1234567890",
    "category": "Marketing",
    "type": "Persistent",
    "expires": 90,
    "http_only": false,
    "secure": true,
    "same_site": "Lax",
    "path": "/",
    "size": 32,
    "is_third_party": true,
    "requires_consent": true,
    "purpose": "Facebook pixel for advertising and retargeting",
    "site_domain": "example.com",
    "vendor": "Facebook",
    "vendor_confidence": 0.98
  }
]
```

---

## 📋 **Categories & Examples**

### **1. Analytics (40% of dataset recommended)**
```csv
_ga,google-analytics.com,GA1.2.123456789,Analytics,Persistent,730,false,false,Lax,/,27,true,true,Google Analytics tracking
_gid,google-analytics.com,GA1.2.987654321,Analytics,Persistent,1,false,false,Lax,/,27,true,true,Google Analytics daily tracking
_gat,google-analytics.com,1,Analytics,Persistent,0.017,false,false,Lax,/,1,true,true,Google Analytics throttling
_adobe_analytics,adobe.com,s_vi=[CS]v1|123456,Analytics,Persistent,730,false,false,Lax,/,20,true,true,Adobe Analytics visitor ID
_omniture,omniture.com,visitor_123456,Analytics,Persistent,365,false,false,Lax,/,15,true,true,Adobe Omniture tracking
MUID,microsoft.com,123456789ABCDEF,Analytics,Persistent,390,false,true,None,/,16,true,true,Microsoft analytics identifier
_uetsid,bing.com,20240101_123456,Analytics,Session,-1,false,false,Lax,/,18,true,true,Bing UET session tracking
_uetvid,bing.com,visitor_abcdef123,Analytics,Persistent,390,false,false,Lax,/,20,true,true,Bing UET visitor tracking
```

### **2. Marketing (30% of dataset recommended)**
```csv
_fbp,facebook.com,fb.1.1234567890123,Marketing,Persistent,90,false,true,Lax,/,32,true,true,Facebook pixel browser tracking
_fbc,facebook.com,fb.1.1234567890123,Marketing,Persistent,90,false,true,Lax,/,32,true,true,Facebook conversion tracking
fr,facebook.com,0abcdef123456789,Marketing,Persistent,90,true,true,None,/,16,true,true,Facebook retargeting
personalization_id,twitter.com,v1_abcdef123456,Marketing,Persistent,730,false,true,None,/,20,true,true,Twitter personalization
guest_id,twitter.com,v1_123456789abc,Marketing,Persistent,730,false,true,None,/,18,true,true,Twitter guest tracking
IDE,doubleclick.net,AHWqTUmvxyz123,Marketing,Persistent,390,false,true,None,/,16,true,true,Google DoubleClick advertising
test_cookie,doubleclick.net,CheckForPermission,Marketing,Session,-1,false,false,None,/,18,true,true,DoubleClick test cookie
_gcl_au,google.com,1.1.123456789.1234567890,Marketing,Persistent,90,false,false,Lax,/,30,true,true,Google Ads conversion linker
```

### **3. Strictly Necessary (20% of dataset recommended)**
```csv
sessionid,example.com,abc123def456ghi789,Strictly Necessary,Session,-1,true,true,Strict,/,20,false,false,User session management
csrftoken,example.com,xyz789abc123def456,Strictly Necessary,Session,-1,true,true,Strict,/,20,false,false,CSRF protection token
PHPSESSID,example.com,sess_123456789abcdef,Strictly Necessary,Session,-1,true,false,Lax,/,24,false,false,PHP session identifier
JSESSIONID,example.com,123456789ABCDEF0123,Strictly Necessary,Session,-1,true,true,Strict,/,24,false,false,Java session identifier
ASP.NET_SessionId,example.com,abcdef123456789xyz,Strictly Necessary,Session,-1,true,true,Lax,/,22,false,false,ASP.NET session ID
auth_token,example.com,bearer_token_123456,Strictly Necessary,Persistent,1,true,true,Strict,/,25,false,false,Authentication token
login_state,example.com,logged_in_user_123,Strictly Necessary,Session,-1,true,true,Strict,/,20,false,false,Login state tracking
security_token,example.com,sec_123456789abcdef,Strictly Necessary,Persistent,0.25,true,true,Strict,/,22,false,false,Security verification
```

### **4. Functional (10% of dataset recommended)**
```csv
preferences,example.com,theme=dark&lang=en,Functional,Persistent,365,false,false,Lax,/,20,false,true,User preferences
language,example.com,en-US,Functional,Persistent,365,false,false,Lax,/,5,false,true,Language preference
timezone,example.com,America/New_York,Functional,Persistent,365,false,false,Lax,/,17,false,true,Timezone setting
currency,example.com,USD,Functional,Persistent,365,false,false,Lax,/,3,false,true,Currency preference
layout,example.com,grid_view,Functional,Persistent,365,false,false,Lax,/,9,false,true,Layout preference
font_size,example.com,medium,Functional,Persistent,365,false,false,Lax,/,6,false,true,Font size setting
sidebar_collapsed,example.com,true,Functional,Persistent,365,false,false,Lax,/,4,false,true,UI state preference
```

---

## 📏 **Dataset Size Recommendations**

### **Minimum Dataset Size**: 500+ samples
- **Analytics**: 200+ samples
- **Marketing**: 150+ samples  
- **Strictly Necessary**: 100+ samples
- **Functional**: 50+ samples

### **Optimal Dataset Size**: 1000+ samples
- **Analytics**: 400+ samples
- **Marketing**: 300+ samples
- **Strictly Necessary**: 200+ samples
- **Functional**: 100+ samples

### **Enterprise Dataset Size**: 5000+ samples
- **Analytics**: 2000+ samples
- **Marketing**: 1500+ samples
- **Strictly Necessary**: 1000+ samples
- **Functional**: 500+ samples

---

## 🎯 **Data Quality Guidelines**

### **1. Cookie Name Diversity**
- Include common patterns: `_ga`, `_gid`, `_fbp`, `sessionid`
- Include vendor-specific: `MUID`, `IDE`, `personalization_id`
- Include custom patterns: `user_pref`, `site_config`

### **2. Domain Variety**
- **First-party domains**: `example.com`, `mysite.org`
- **Third-party analytics**: `google-analytics.com`, `adobe.com`
- **Third-party advertising**: `facebook.com`, `doubleclick.net`
- **CDN domains**: `cdn.example.com`, `assets.mysite.com`

### **3. Value Patterns**
- **UUIDs**: `123e4567-e89b-12d3-a456-426614174000`
- **Encoded values**: `GA1.2.123456789.1234567890`
- **Base64**: `eyJhbGciOiJIUzI1NiJ9`
- **Simple values**: `true`, `en-US`, `dark_theme`

### **4. Expiry Diversity**
- **Session cookies**: `-1` (expires when browser closes)
- **Short-term**: `1` day (daily analytics)
- **Medium-term**: `30-90` days (marketing)
- **Long-term**: `365-730` days (preferences)

---

## 🔧 **Data Collection Methods**

### **1. Browser Extension**
```javascript
// Collect cookies from current page
const cookies = document.cookie.split(';').map(cookie => {
  const [name, value] = cookie.trim().split('=');
  return { name, value, domain: window.location.hostname };
});
```

### **2. Developer Tools**
1. Open Chrome DevTools (F12)
2. Go to Application → Cookies
3. Export cookie data for each domain
4. Manually categorize based on purpose

### **3. Automated Scanning**
```python
# Use the existing cookie scanner
from backend.scanner.cookie_scanner import CookieScanner

scanner = CookieScanner()
results = scanner.scan_url("https://example.com")
cookies = results.get('cookies', [])
```

### **4. Public Datasets**
- **CookieBlock Dataset**: Research dataset with labeled cookies
- **Privacy Badger Lists**: EFF's tracking cookie database
- **Disconnect Lists**: Categorized tracking domains

---

## 📁 **File Organization**

```
training_data/
├── raw_data/
│   ├── cookies_batch_1.csv
│   ├── cookies_batch_2.csv
│   └── cookies_batch_3.csv
├── processed/
│   ├── training_cookies.csv      # Main training file
│   ├── validation_cookies.csv    # Validation set
│   └── test_cookies.csv         # Test set
├── metadata/
│   ├── data_sources.json        # Source information
│   ├── labeling_guidelines.md   # Categorization rules
│   └── quality_checks.json     # Data validation results
└── exports/
    ├── features.csv             # Extracted features
    ├── labels.csv              # Target categories
    └── dataset_stats.json      # Dataset statistics
```

---

## 🚀 **Training Command**

Once you have the dataset ready:

```bash
# Place your training_cookies.csv in models/training_data/
cp training_cookies.csv models/training_data/

# Run the training script
python3 -m backend.api.ml_classifier.training.train_model \
  --dataset models/training_data/training_cookies.csv \
  --model-type both \
  --version 3.0.0 \
  --balance-classes \
  --cross-validate

# Or use the simplified script
python3 scripts/train_model.py --version 3.0.0
```

---

## 📊 **Expected Results**

With a well-structured dataset of 1000+ samples:
- **Accuracy**: 95%+ 
- **Precision**: 96%+
- **Recall**: 94%+
- **F1-Score**: 95%+

The model will automatically extract 33 features from your raw cookie data and train a Random Forest or XGBoost classifier.