# ML Hybrid Classification - Option C Implementation

## Overview

The cookie scanner now uses a **hybrid classification approach** that intelligently combines rule-based pattern matching with ML predictions to provide the most accurate cookie categorization.

## How It Works

### Classification Flow

```
1. Backend Rule-Based Classifier
   ↓
   Assigns initial category based on cookie name patterns
   ↓
2. ML Model Classification
   ↓
   Provides ML prediction with confidence score
   ↓
3. Hybrid Decision Logic (Option C)
   ↓
   IF rule-based category == "Uncategorized"
      THEN use ML prediction
      ELSE keep rule-based category
   ↓
4. Risk Calculation
   ↓
   Uses the effective category for GDPR/CCPA/DPDP risk scores
```

## Implementation Details

### Code Location
- **File**: `src/App.jsx`
- **Functions**: `handleQuickScan()`, `handleDeepScan()`, `handleQuickScanRemote()`

### Logic

```javascript
// Option C: Blend both approaches
// Use ML classification if rule-based returned 'Uncategorized'
const effectiveCategory = cookie.category === 'Uncategorized' 
  ? mlData.predicted_category 
  : cookie.category;

return {
  ...cookie,
  category: effectiveCategory, // Update actual category if Uncategorized
  mlClassification: mlData.predicted_category,
  mlConfidence: mlData.confidence_score,
  mlConfidenceLevel: mlData.confidence_level,
  categorySource: cookie.category === 'Uncategorized' ? 'ml' : 'rules'
};
```

### New Cookie Properties

Each cookie now includes:
- **`category`**: The effective category used for risk calculations (may be from rules or ML)
- **`mlClassification`**: The ML model's prediction (always present)
- **`mlConfidence`**: Confidence score (0.0 - 1.0)
- **`mlConfidenceLevel`**: Human-readable confidence (High/Medium/Low)
- **`categorySource`**: Tracks whether category came from 'rules' or 'ml'

## Benefits

### 1. **Best of Both Worlds**
- Rule-based classifier handles common, well-known cookies (fast, deterministic)
- ML model handles unknown/unusual cookies (adaptive, learning-based)

### 2. **Improved Accuracy**
- Reduces "Uncategorized" cookies in scan results
- ML model can identify cookies that don't match known patterns
- Risk scores become more accurate

### 3. **Transparency**
- `categorySource` field shows which system classified each cookie
- Users can see both rule-based and ML predictions
- ML dropdown still allows manual overrides

### 4. **Automatic Risk Score Updates**
- Statistics are recalculated after ML classification
- Risk scores (GDPR/CCPA/DPDP) reflect ML-enhanced categories
- History entries store corrected statistics

## Example Scenarios

### Scenario 1: Known Cookie (Rule-Based Wins)
```javascript
Cookie: "_ga" (Google Analytics)
Rule-based: "Analytics" ✓
ML prediction: "Analytics"
Effective category: "Analytics" (from rules)
categorySource: "rules"
```

### Scenario 2: Unknown Cookie (ML Wins)
```javascript
Cookie: "custom_tracking_xyz"
Rule-based: "Uncategorized" ✗
ML prediction: "Marketing" (confidence: 0.78)
Effective category: "Marketing" (from ML)
categorySource: "ml"
```

### Scenario 3: Conflicting Classifications
```javascript
Cookie: "user_pref_theme"
Rule-based: "Functional" ✓
ML prediction: "Strictly Necessary"
Effective category: "Functional" (rules take precedence)
categorySource: "rules"
```

## Impact on Risk Scores

### Before (Rule-Based Only)
```
Cookies: 10 total
- 5 Analytics (known patterns)
- 5 Uncategorized (unknown)

CCPA Risk: MEDIUM (has Analytics)
GDPR Risk: HIGH (5 Uncategorized require consent)
```

### After (Hybrid Approach)
```
Cookies: 10 total
- 5 Analytics (from rules)
- 3 Marketing (from ML, were Uncategorized)
- 2 Functional (from ML, were Uncategorized)

CCPA Risk: HIGH (has Marketing) ← More accurate!
GDPR Risk: HIGH (8 require consent)
```

## Statistics Recalculation

After ML classification updates categories, statistics are automatically recalculated:

```javascript
const updatedStats = calculateStatistics(updatedCookies);
const finalResults = {
  ...updatedResults,
  statistics: updatedStats
};
```

This ensures:
- Category counts reflect ML-enhanced classifications
- Risk scores use updated categories
- History entries have accurate statistics

## User Experience

### In the UI
1. **Cookie Table**: Shows effective category (may be ML-enhanced)
2. **ML Dropdown**: Shows ML prediction and confidence
3. **Category Badge**: Color-coded by effective category
4. **Source Indicator**: Could be added to show if category is from ML

### Manual Override
Users can still manually change categories via the ML dropdown, which updates:
- The cookie's category
- Statistics and risk scores
- Backend records (if implemented)

## Future Enhancements

### Potential Improvements
1. **Confidence Threshold**: Only use ML if confidence > 0.7
2. **User Preference**: Let users choose classification strategy
3. **Learning Feedback**: Track manual overrides to improve ML model
4. **Conflict Resolution**: Handle cases where rules and ML strongly disagree

### Option A (High-Confidence ML)
```javascript
const effectiveCategory = cookie.mlConfidence > 0.85 
  ? cookie.mlClassification 
  : cookie.category;
```

### Option B (User Preference)
```javascript
const effectiveCategory = settings.useMLClassification 
  ? cookie.mlClassification 
  : cookie.category;
```

## Testing

### Test Cases
1. ✅ Scan with all known cookies → All use rule-based
2. ✅ Scan with unknown cookies → ML fills gaps
3. ✅ Verify statistics recalculation
4. ✅ Verify risk scores update correctly
5. ✅ Check categorySource tracking

### Validation
```javascript
// Check that Uncategorized cookies are reduced
const uncategorizedCount = cookies.filter(c => c.category === 'Uncategorized').length;
console.log(`Uncategorized: ${uncategorizedCount} (should be minimal)`);

// Check ML usage
const mlEnhanced = cookies.filter(c => c.categorySource === 'ml').length;
console.log(`ML-enhanced: ${mlEnhanced} cookies`);
```

## Conclusion

The hybrid classification approach (Option C) provides the best balance between:
- **Speed**: Rule-based for known patterns
- **Accuracy**: ML for unknown cookies
- **Transparency**: Both predictions visible
- **Flexibility**: Manual overrides still possible

This ensures that risk scores are as accurate as possible while maintaining the reliability of rule-based classification for common cookies.
