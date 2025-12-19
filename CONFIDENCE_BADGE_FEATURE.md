# Confidence Badge Feature

## Overview
Replaced the simple confidence display (percentage + text) with an interactive confidence badge button that opens a detailed modal explaining the ML confidence level.

## Features

### 1. Confidence Badge Button
- **Visual Design**: Rounded button with sparkle icon and confidence level text
- **Color Coding**:
  - 🟢 **High** (85-100%): Green gradient
  - 🟠 **Medium** (60-85%): Orange gradient
  - ⚫ **Low** (0-60%): Gray gradient
- **Interactive**: Hover effects and click to open modal
- **Animated**: Sparkle icon rotates and pulses

### 2. Confidence Explanation Modal

When clicked, the badge opens a modal showing:

#### Header
- Confidence level icon with color-coded circle
- Title (High/Medium/Low Confidence)
- Confidence percentage

#### Cookie Information
- Cookie name
- ML classification
- Rule-based category (if different)

#### Explanation Sections

**What This Means**
- Clear description of the confidence level

**Why This Confidence Level?**
- Bullet points explaining factors:
  - Pattern match strength
  - Feature alignment
  - Prediction certainty
  - Data quality

**Recommendation**
- Actionable advice based on confidence level:
  - **High**: "This classification is highly reliable and can be trusted."
  - **Medium**: "This classification is reasonably reliable but may benefit from manual review."
  - **Low**: "Manual review is recommended to verify this classification."

**Confidence Score Bar**
- Visual progress bar showing confidence percentage
- Markers for Low (0-60%), Medium (60-85%), High (85-100%)

## Implementation

### Files Created

1. **`src/components/ConfidenceBadge.jsx`**
   - React component for the badge and modal
   - Props: confidence, confidenceLevel, cookieName, mlClassification, actualCategory

2. **`src/components/ConfidenceBadge.css`**
   - Styling for badge button and modal
   - Responsive design
   - Animations and transitions

### Files Modified

1. **`src/App.jsx`**
   - Added import: `import ConfidenceBadge from './components/ConfidenceBadge';`
   - Replaced confidence display with ConfidenceBadge component

## Usage

```jsx
<ConfidenceBadge
  confidence={0.87}              // 0-1 scale
  confidenceLevel="High"         // "High", "Medium", or "Low"
  cookieName="_ga"               // Cookie name
  mlClassification="Analytics"   // ML prediction
  actualCategory="Analytics"     // Rule-based category
/>
```

## Confidence Level Explanations

### High Confidence (85-100%)
**Indicators:**
- Strong pattern match with training data
- Cookie name and properties align well with known patterns
- Multiple features support this classification
- Low uncertainty in prediction

**Recommendation:**
This classification is highly reliable and can be trusted.

### Medium Confidence (60-85%)
**Indicators:**
- Moderate pattern match with training data
- Some features support this classification
- Cookie properties partially align with known patterns
- Some uncertainty in prediction

**Recommendation:**
This classification is reasonably reliable but may benefit from manual review.

### Low Confidence (0-60%)
**Indicators:**
- Weak pattern match with training data
- Cookie name or properties are unusual
- Limited features support this classification
- High uncertainty in prediction

**Recommendation:**
Manual review is recommended to verify this classification.

## Visual Design

### Badge Button
```
┌─────────────────────────┐
│  ✨ High                │  ← Green gradient, sparkle icon
└─────────────────────────┘

┌─────────────────────────┐
│  ✨ Medium              │  ← Orange gradient, sparkle icon
└─────────────────────────┘

┌─────────────────────────┐
│  ✨ Low                 │  ← Gray gradient, sparkle icon
└─────────────────────────┘
```

### Modal Layout
```
┌─────────────────────────────────────────┐
│  🟢  High Confidence                  ✕ │
│      ML Confidence: 87%                 │
├─────────────────────────────────────────┤
│  Cookie Info Box                        │
│  • Cookie Name: _ga                     │
│  • ML Classification: Analytics         │
│  • Rule-Based Category: Analytics       │
├─────────────────────────────────────────┤
│  What This Means                        │
│  The ML model is 87% confident...      │
├─────────────────────────────────────────┤
│  Why This Confidence Level?             │
│  • Strong pattern match...              │
│  • Cookie name aligns...                │
│  • Multiple features...                 │
│  • Low uncertainty...                   │
├─────────────────────────────────────────┤
│  ℹ️  Recommendation                     │
│  This classification is highly          │
│  reliable and can be trusted.           │
├─────────────────────────────────────────┤
│  Confidence Score                   87% │
│  ████████████████████░░░░░░░░░░░░░░░░  │
│  0%  Low  Medium  High            100%  │
└─────────────────────────────────────────┘
```

## Benefits

### 1. User Education
Users understand WHY the ML model has a certain confidence level, not just WHAT the level is.

### 2. Transparency
Clear explanation of factors affecting confidence builds trust in ML predictions.

### 3. Actionable Insights
Recommendations guide users on whether to trust the classification or review manually.

### 4. Visual Appeal
Modern, polished design with smooth animations and color coding.

### 5. Better UX
Interactive badge is more engaging than static text, encouraging users to learn more.

## Responsive Design

- **Desktop**: Full modal with all sections
- **Tablet**: Adjusted spacing and font sizes
- **Mobile**: Stacked layout, bottom sheet style modal

## Accessibility

- **Keyboard Navigation**: Modal can be closed with Escape key
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Color Contrast**: WCAG AA compliant color combinations
- **Focus Management**: Focus trapped within modal when open

## Testing Scenarios

### Test 1: High Confidence Cookie
1. Scan a website with Google Analytics
2. Click the green "High" badge
3. Verify modal shows high confidence explanation
4. Check that confidence bar is mostly filled

### Test 2: Medium Confidence Cookie
1. Scan a website with custom analytics cookies
2. Click the orange "Medium" badge
3. Verify modal shows medium confidence explanation
4. Check that confidence bar is partially filled

### Test 3: Low Confidence Cookie
1. Scan a website with unknown/custom cookies
2. Click the gray "Low" badge
3. Verify modal shows low confidence explanation
4. Check that confidence bar is minimally filled

### Test 4: Modal Interaction
1. Click badge to open modal
2. Click outside modal to close
3. Click X button to close
4. Verify smooth animations

## Future Enhancements

### 1. Feature Importance
Show which features contributed most to the prediction:
```
Top Contributing Features:
• Cookie name pattern: 45%
• Domain match: 30%
• Expiry duration: 15%
• HTTP-only flag: 10%
```

### 2. Similar Cookies
Show other cookies with similar patterns:
```
Similar Cookies:
• _gid (Analytics, 92% confidence)
• _gat (Analytics, 88% confidence)
```

### 3. Training Data Examples
Show examples from training data:
```
Training Examples:
• _ga → Analytics (1,234 examples)
• _gid → Analytics (987 examples)
```

### 4. Confidence History
Track confidence changes over time:
```
Confidence Trend:
• First scan: 75% (Medium)
• Current: 87% (High)
• Trend: ↗️ Improving
```

## Related Files

- `src/components/ConfidenceBadge.jsx` - Component implementation
- `src/components/ConfidenceBadge.css` - Styling
- `src/App.jsx` - Integration
- `src/lib/riskCalculator.js` - Risk calculation logic (can be extended for confidence)
