# Deep Scan Feature Documentation

## Overview

The **Deep Scan** feature extends the Cookie Scanner's capabilities by crawling multiple pages on a website to discover all cookies across different sections. This provides comprehensive coverage beyond just the current page.

---

## 🎯 What is Deep Scan?

Deep Scan is an advanced scanning mode that:
- **Crawls multiple pages** on the target website
- **Discovers all cookies** across different sections
- **Shows which cookies appear on which pages**
- **Provides comprehensive cookie coverage**
- **Identifies page-specific cookies**

---

## 🆚 Scan Types Comparison

| Feature | Quick Scan | Deep Scan | Scheduled Scan |
|---------|------------|-----------|----------------|
| **Speed** | Instant (< 1s) | 5-30 seconds | Automatic |
| **Pages Scanned** | Current page only | 1-50 pages | Current page |
| **Coverage** | Single page | Comprehensive | Monitoring over time |
| **Best For** | Quick checks | Full audits | Change tracking |
| **User Input** | None | Select # of pages | Set interval |

---

## 📋 Scan Type Definitions

### Quick Scan ⚡
- **Purpose**: Instant compliance check
- **Speed**: < 1 second
- **Coverage**: Current page only
- **When to use**: 
  - Quick cookie checks
  - Testing changes
  - Immediate compliance verification

### Deep Scan 🔍
- **Purpose**: Comprehensive website audit
- **Speed**: 5-30 seconds (depends on pages)
- **Coverage**: Multiple pages (user-configurable)
- **When to use**:
  - Full website cookie audits
  - Discovering all cookies
  - Compliance documentation
  - Before major releases

### Scheduled Scan ⏰
- **Purpose**: Continuous monitoring
- **Speed**: Runs automatically at intervals
- **Coverage**: Current page
- **When to use**:
  - Monitoring cookie changes
  - Tracking compliance over time
  - Automated checks

---

## 🚀 Using Deep Scan

### Step 1: Access Deep Scan Mode
1. Navigate to "Scan Configuration"
2. Click the "Deep Scan" tab
3. The Deep Scan panel will appear

### Step 2: Configure Scan Parameters

#### Pages to Scan
- **Minimum**: 1 page
- **Maximum**: 50 pages
- **Default**: 10 pages
- **Recommended**: 10-20 for most websites

**Tips**:
- Start with 5-10 pages for testing
- Increase to 20-30 for full audits
- Use 50 for very large websites

#### Enter Target URL
- Enter the website homepage URL
- Must include `https://` or `http://`
- Example: `https://example.com`

### Step 3: Start the Scan
1. Click "Start Deep Scan" button
2. Progress bar will appear
3. Watch as pages are scanned
4. Wait for completion

### Step 4: Review Results
- View aggregate cookie report
- See which cookies appear on which pages
- Check compliance across all pages

---

## 📊 Deep Scan Results

### What You'll See

#### 1. **Aggregate Cookie List**
All unique cookies found across all pages, including:
- Cookie name and domain
- Which pages the cookie appears on
- Category and compliance info
- Risk levels (GDPR/CCPA/DPDP)

#### 2. **Page-by-Page Breakdown**
Details for each scanned page:
- URL of the page
- Number of cookies on that page
- Cookies requiring consent
- Page-specific risks

#### 3. **Statistics**
- Total pages scanned
- Total unique cookies
- Cookies per page average
- Compliance summary

---

## 🎯 Use Cases

### Use Case 1: Pre-Launch Audit
**Scenario**: Before launching a website, ensure full compliance

**Process**:
1. Set pages to scan: 20-30
2. Enter staging URL
3. Run Deep Scan
4. Review all cookies found
5. Fix compliance issues
6. Re-scan to verify

**Benefit**: Catch all cookies before going live

### Use Case 2: Third-Party Audit
**Scenario**: Audit a client's website for compliance

**Process**:
1. Set pages to scan: 50 (maximum coverage)
2. Enter client URL
3. Run Deep Scan
4. Export results to CSV
5. Create compliance report
6. Present findings

**Benefit**: Comprehensive audit documentation

### Use Case 3: Section-Specific Analysis
**Scenario**: Check if specific sections (e.g., checkout) have extra cookies

**Process**:
1. Set pages to scan: 10
2. Enter checkout URL
3. Run Deep Scan
4. Compare with homepage scan
5. Identify section-specific cookies

**Benefit**: Identify where sensitive cookies are set

### Use Case 4: Continuous Monitoring
**Scenario**: Monthly check for new cookies

**Process**:
1. Schedule: First Monday of month
2. Pages to scan: 15
3. Run Deep Scan
4. Compare with previous month
5. Identify new cookies
6. Update consent management

**Benefit**: Stay on top of cookie changes

---

## 🔧 Technical Details

### How Deep Scan Works

1. **Start URL**: Begins at the URL you provide
2. **Page Discovery**: Finds links on each page
3. **Crawling**: Visits each discovered page
4. **Cookie Scanning**: Scans cookies on each page
5. **Aggregation**: Combines all results
6. **Deduplication**: Removes duplicate cookies
7. **Analysis**: Generates compliance report

### Crawling Rules

- **Same-origin only**: Only scans pages on the same domain
- **Respect limits**: Stops at configured page count
- **Skip duplicates**: Won't scan the same page twice
- **Timeout handling**: Skips pages that take too long
- **Error handling**: Continues even if some pages fail

### What Gets Scanned

✅ **Included**:
- All pages on the same domain
- Subdomains (if configured)
- Different sections (blog, products, etc.)
- Dynamic pages

❌ **Excluded**:
- External links (different domains)
- Anchor links (#sections)
- JavaScript-only links
- Login-protected pages

---

## 🎨 Progress Tracking

While Deep Scan runs, you'll see:

### Progress Bar
- Visual indicator of scan progress
- Current page / Total pages
- Percentage complete

### Current Page Display
- Shows URL being scanned
- Updates in real-time
- Helps you track progress

### Status Messages
- "Starting scan..."
- "Scanning page X of Y"
- "Complete!"

---

## 📈 Performance Considerations

### Scan Speed

| Pages | Expected Time |
|-------|---------------|
| 1-5   | 2-5 seconds   |
| 5-10  | 5-10 seconds  |
| 10-20 | 10-20 seconds |
| 20-50 | 20-50 seconds |

**Factors affecting speed**:
- Page load times
- Number of cookies per page
- Network speed
- Server response time

### Resource Usage

- **Browser memory**: ~50-100MB additional
- **Network**: Depends on page sizes
- **CPU**: Minimal impact

### Best Practices

1. **Start small**: Test with 5-10 pages first
2. **Monitor progress**: Watch the progress bar
3. **Avoid interruption**: Don't close browser during scan
4. **Check results**: Review for any errors

---

## ⚠️ Limitations & Considerations

### Current Limitations

1. **CORS Restrictions**: Some sites may block scanning
2. **JavaScript Rendering**: May miss some dynamic cookies
3. **Rate Limiting**: Some servers may throttle requests
4. **Authentication**: Cannot scan login-protected pages
5. **Maximum Pages**: Limited to 50 pages per scan

### Workarounds

**For CORS Issues**:
- Use the bookmarklet method instead
- Scan from the actual website (not external)

**For Auth-Protected Pages**:
- Log in first, then scan
- Use Quick Scan on protected pages individually

**For Large Sites**:
- Run multiple Deep Scans on different sections
- Combine results manually

---

## 🔒 Privacy & Security

### Data Handling

- **No external servers**: All scanning happens in your browser
- **No data sent**: Results stay on your device
- **Local storage only**: History saved locally
- **No tracking**: We don't track your scans

### Safety

- **Read-only**: Only reads cookies, doesn't modify them
- **No injection**: Doesn't inject any code into scanned pages
- **Respect robots.txt**: Can be configured to respect crawling rules

---

## 📝 Example Workflows

### Workflow 1: New Website Launch
```
1. Deep Scan (50 pages) → Staging environment
2. Review all cookies found
3. Categorize unclassified cookies
4. Update consent management
5. Quick Scan → Production (verify)
6. Document results for compliance
```

### Workflow 2: Monthly Audit
```
1. Schedule: First Monday
2. Deep Scan (20 pages)
3. Compare with last month
4. Identify changes
5. Update documentation
6. Export to CSV for records
```

### Workflow 3: Third-Party Integration
```
1. Quick Scan → Before integration
2. Integrate third-party service
3. Deep Scan (15 pages) → After integration
4. Compare results
5. Identify new cookies
6. Update consent categories
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue**: Scan stuck at 0%
**Solution**: Check internet connection, refresh page

**Issue**: Some pages not scanned
**Solution**: May be blocked by CORS, use bookmarklet

**Issue**: Taking too long
**Solution**: Reduce number of pages, check network speed

**Issue**: Missing cookies
**Solution**: Some cookies may be JavaScript-only, try Quick Scan on specific pages

**Issue**: Error during scan
**Solution**: Check console for errors, try again with fewer pages

---

## 📚 FAQ

**Q: How many pages should I scan?**
A: Start with 10-15. Increase to 20-30 for full audits.

**Q: Can I cancel a Deep Scan?**
A: Yes, refresh the page (results won't be saved).

**Q: Will Deep Scan slow down the website?**
A: No, scanning happens in your browser only.

**Q: Can I scan competitor websites?**
A: Yes, but respect their terms of service.

**Q: Does Deep Scan find all cookies?**
A: It finds most cookies, but some JavaScript-triggered cookies may be missed.

**Q: Can I schedule Deep Scans?**
A: Not currently, but you can use Quick Scan with scheduling.

**Q: How is data stored?**
A: Results are stored in your browser's localStorage only.

---

## 🎓 Best Practices

### 1. **Start with Quick Scan**
- Use Quick Scan first to test
- Then use Deep Scan for full audit

### 2. **Progressive Approach**
- Start: 5 pages
- Medium: 15 pages
- Full: 30-50 pages

### 3. **Document Everything**
- Export results after each scan
- Keep monthly records
- Track changes over time

### 4. **Regular Audits**
- Monthly: Deep Scan (20 pages)
- Quarterly: Deep Scan (50 pages)
- After changes: Deep Scan targeted sections

### 5. **Combine Methods**
- Quick Scan: Daily checks
- Deep Scan: Weekly/monthly audits
- Scheduled Scan: Continuous monitoring

---

## 📊 Integration with Scan History

Deep Scan results are automatically:
- ✅ Added to Scan History
- ✅ Marked with "Deep" scan type
- ✅ Filterable and sortable
- ✅ Exportable to CSV
- ✅ Viewable later

Filter Deep Scans in history:
1. Go to Scan History
2. Look for "scanType: deep"
3. View aggregate results
4. See page breakdown

---

## 🚀 Future Enhancements

Planned features:
- [ ] Schedule Deep Scans
- [ ] Custom crawling rules
- [ ] Sitemap import
- [ ] Compare scan results
- [ ] AI-powered cookie categorization
- [ ] Automated compliance scoring

---

## 📞 Support

Need help with Deep Scan?

- 📚 **Documentation**: This file
- 🐛 **Issues**: GitHub Issues
- 💬 **Questions**: Discussion Forum
- 📧 **Contact**: support@cookiescanner.com

---

## ✨ Summary

Deep Scan is your comprehensive cookie auditing tool:

✅ Scans 1-50 pages
✅ Discovers all cookies
✅ Shows page-specific data
✅ Provides full compliance picture
✅ Perfect for audits and documentation

**When to use each scan type**:
- **Quick** ⚡: Daily checks, immediate needs
- **Deep** 🔍: Audits, documentation, launches
- **Scheduled** ⏰: Continuous monitoring

Start with Quick Scan, use Deep Scan for full audits!

---

*Last Updated: October 17, 2025*
