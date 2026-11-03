# Phase 0 findings: CMP cookie-declaration access (OneTrust, Cookiebot)

Spike for Phase 0 of `BANNER_COLLECTION_TRAINING_PLAN.md`, run 2026-10-21.
Samples are in `phase0_samples/`. The spike scripts are in `phase0_samples/spike_scripts/`.

**Result: both CMPs pass the exit criteria.** Each one returned a structured
declaration on at least 5 live sites, and every native category maps onto the
five v6 labels.

| CMP | Sites that extracted cleanly | Cookies declared | Verdict |
|---|---|---|---|
| OneTrust | zoom.us, novonordisk.com, ikea.com, salesforce.com, okta.com | 1,180 | Keep. Pure JSON, no browser needed once the ID is known |
| Cookiebot | dr.dk, politi.dk, cbs.dk, illum.dk, normalstores.com, berlingske.dk | 388 (211 HTTP cookies) | Keep. HTML table inside JS, parsed by `cb_parse.py` |

Other sites found along the way: royalcopenhagen.com, roche.com, atlassian.com
(OneTrust) and muuto.com (OneTrust with a `-test` script ID).

## How to get the data

### OneTrust

1. **Find the domain-script ID.** It is the `data-domain-script` attribute on
   `otSDKStub.js`, or the UUID in the request to `cdn.cookielaw.org/consent/<id>/…`.
   Static HTML finds it on only about half the sites. Salesforce leaves the attribute
   unquoted, and CNN and Salesforce serve the stub from their own CDN. A headless
   browser that watches network requests is the reliable way to find it
   (`pw_detect.py`).
2. **Get the ruleset list:** `https://cdn.cookielaw.org/consent/<id>/<id>.json`, then `RuleSet[]`.
3. **Get the declaration:** `https://cdn.cookielaw.org/consent/<id>/<RuleSet.Id>/en.json`,
   then `DomainData.Groups[]`.
   - Regional rulesets (EU, US, California, China…) produced identical
     cookie → category assignments on zoom.us (5 rulesets) and salesforce.com (7).
     One ruleset per site is enough.
   - In-page alternative: `window.OneTrust.GetDomainData()` returns the same object
     (muuto.com: 6 groups, 374 cookies).

### Cookiebot

1. **Find the cbid.** Use `window.Cookiebot.serial`, or the UUID in requests to
   `consent.cookiebot.com/<cbid>/…`. Static HTML found it on none of the sites
   (it is loaded through tag managers), so a browser is needed.
2. **Get the declaration:**
   `https://consent.cookiebot.com/<cbid>/cdreport.js?referer=<site host>&culture=en`
   (`cd.js` is only the loader that calls this).
   - The `referer` must be a domain authorised for that cbid. normal.dk failed until
     the redirect target `www.normalstores.com` was used, so follow redirects first
     and use the final host.
   - `culture=en` is ignored when the site only configured another language.
     dr.dk and berlingske.dk returned Danish.

## Field mapping to the 16-column schema

| Schema column | OneTrust source | Cookiebot source | Notes |
|---|---|---|---|
| `site_domain` | scanned site | scanned site | |
| `cookie_name` | `Cookies[].Name` | table column 1 (Name / Navn) | Both CMPs use templated names (`_ga_xxxxxxxxxx`, `_hjSession_xxxxxx`, `_cs_nnnnnnnnnnnnn`, Cookiebot `[x]`/`#`). OneTrust flags them with `patternKey`. They must be matched against observed names, not used as literal names |
| `cookie_domain` | `Cookies[].Host` (or `Hosts[].HostName`) | table column 2 is the *provider name* ("Danmarks Radio", "Gemius"), not a domain | Neither CMP gives the browser-observed domain. Fill it from the Phase 1 accept-all capture |
| `expiry_days` | `Length` (string of days); `IsSession` → 0 | column 4, free text: "1 year", "13 mdr.", "400 dage", "Session", "Persistent" | Cookiebot needs a parser for each language. Prefer the browser capture. Declared expiry is a cross-check only |
| `secure`, `http_only`, `same_site`, `host_only`, `partitioned`, `path` | not present | not present | Browser capture only. Never infer them |
| `setter_domain` | not present | not present | Browser capture only |
| `label_category` | `Groups[].GroupName`, mapped by name | section position/heading, mapped by name | See category mapping below |
| `label_source` | `cmp_onetrust` | `cmp_cookiebot` | Proposed values |
| purpose (sidecar) | `description` (89% filled) | column 3 (Purpose / Formål) | Evidence for reviewers. Not a model feature |
| storage type (filter) | (all cookies) | column 5: HTTP Cookie / HTML Local Storage / Pixel Tracker / IndexedDB | Keep only `HTTP Cookie` (54% of Cookiebot rows) |

### Category mapping

Map by **group name**, not by ID. OneTrust's `C0001…C0005` IDs are customer-defined:
Salesforce uses `1/2/3/4/8`, and IKEA's `C0001` is "Functional (Necessary)" and its
`C0004` is "Marketing".

| v6 label | OneTrust group names seen | Cookiebot sections (EN / DA) |
|---|---|---|
| Strictly_Necessary | Strictly Necessary, Required Cookies, Functional (Necessary) | Necessary / Nødvendig |
| Analytics_Performance | Performance, Analytics, Analytical | Statistics / Statistik |
| Functional | Functional, Preference | Preferences / Præferencer |
| Marketing_Advertising | Targeting, Marketing, Advertising, Social Media | Marketing / Markedsføring |
| Unclassified | Others | Unclassified / Uklassificeret |

`spike_scripts/normalize.py` implements this mapping. On all 11 sites, every
category mapped and none was left over. Output: `phase0_samples/normalized_rows_sample.json`
(1,568 rows).

## Data-quality findings for Phase 2/3

- **Nested groups hide categories.** In salesforce.com, "Performance Cookies"
  (ID 2) has `Parent = 3` (Functional) and 0 cookies of its own. Its cookies
  (`_ga`, `_gid`, `_gat_UA-`) are listed under Functional. The extractor must
  resolve `Parent` and treat parent-level labels as low-confidence.
- **The same cookie appears more than once on a site.** OneTrust repeats a cookie
  for each host. Cloudflare's `__cf_bm`/`_cfuvid` appears in 2–3 categories on one
  site (okta.com lists `__cf_bm` as Necessary, Functional and Marketing).
  Deduplicate per (site, name, host), and route conflicts to review.
- **Cookiebot section counts exceed table rows** (dr.dk Necessary: 87 declared, 75
  rows). The heading count includes entries that have no row. Use the rows.
- **Sites disagree.** 72 of 681 distinct HTTP cookie names get different labels on
  different sites (`_gcl_au`: Performance at zoom.us, Targeting/Marketing elsewhere;
  `AWSALB`: Necessary vs Marketing). This is the multi-source signal Phase 3 needs.
  Labels should be aggregated across sites, not taken from one site.

### Against the current training set (`cookie_classification_production.csv`)

- Only **36 of 681** declared HTTP cookie names (5%) appear in the training CSV. The
  banner data is almost entirely new names.
- The majority banner label differs from the training label on **15 of 36**. The
  clearest case is `OptanonConsent` and `OptanonAlertBoxClosed`: Functional in
  training, but declared Strictly Necessary on every OneTrust site
  (5/5 sites, 30+ rows). This confirms the `OptanonConsent` problem in the plan.
  Several of the other disagreements (`_ga`, `_gid` → Functional) come from the
  Salesforce nesting issue above, not real disagreement.

## Operational notes for the Phase 1 collector

- Use the Playwright/Chromium already in `cookie-scanner-api` (`/ms-playwright`).
  Static `urllib` fetches were blocked (HTTP 403) on marriott.com, cisco.com,
  unilever.com, lego.com, autodesk.com and pfizer.com.
- At least 11 of the 52 sites probed hit the 20–30 s `domcontentloaded` timeout from the
  container (mostly Danish public-sector sites: borger.dk, sundhed.dk, skat.dk,
  ku.dk…). The collector needs retries and a longer timeout, or `wait_until="commit"`.
- OneTrust `-test` script IDs (muuto.com) are staging configs. Record them, but
  exclude them from training until checked.
- Detection misses some sites. cnn.com and pandora.net reference OneTrust in
  their HTML, but headless Chromium saw no OneTrust global and no cookielaw request
  (CNN serves its own `wbdott` copy). Only 10 of the 52 sites probed in the browser
  yielded a usable ID, so the 300-sites-per-CMP target needs a site list pre-filtered by CMP,
  plus detection of self-hosted OneTrust script paths.
- Usercentrics and TCF CMPs were out of scope for this spike and remain unverified.
