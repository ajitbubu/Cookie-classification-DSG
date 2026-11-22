# Why scans use the site's own cookie declaration

Most large websites run a consent banner from OneTrust or Cookiebot, and those banners
publish a category for every cookie name: "Strictly Necessary", "Targeting",
"Performance" and so on. That is the site's own statement of what each cookie is for.
Scans now read it and use it as the suggested category, but they still ask the model
and flag disagreements, because a site's declaration is a claim to check, not a fact.

## The problem

Without the declaration, every cookie's category is a guess. The ML model is right
about 83% of the time across all cookies on sites it never saw, but only about 54% on
cookie names it has never seen. A reviewer gets a confident-looking suggestion with no
way to tell a good guess from a bad one.

Meanwhile the site has already said what the cookie is for, in its own banner. In the
training crawl, banners covered **61% of observed cookies** (45,006 of 73,782 across
1,040 site captures). On real scans: bankofamerica.com 40 of 41 cookies, okta.com 65 of
86, ikea.com 5 of 6.

## The approach

```
page loads ──► CMP on the page? ──no──► nothing extra (no delay)
                   │ yes
                   ▼
          wait up to 4 s for OneTrust / Cookiebot data
                   │
                   ▼
   match each observed cookie to a declaration
   (exact name, or templated name like _ga_xxxxxxxxxx as a prefix;
    a declaration for the cookie's own host wins)
                   │
                   ▼
   cookie.websiteDeclaration = {category, group, cmp, provider, declaredDuration}
                   │
                   ▼
   app: suggestion = site's category        model still classifies the cookie
                   │                                     │
                   └──── model High confidence and different? ──► "Site and model disagree"
                                                              (Review Queue, High priority)
```

- **One copy of the matching rules.** `backend/scanner/cmp_declarations.py` holds the
  OneTrust and Cookiebot readers and the matcher. The training collector
  (`backend/scripts/collect_banner_cookies.py`) imports them, so production and
  training read banners the same way.
- **Categories use the training taxonomy.** A site's group name ("First Party
  Targeting Cookies") goes through the dataset builder's `normalize_label`, then maps to
  the app's names. A group that maps to nothing ("Other") is kept as evidence with
  `category: null` and doesn't become a suggestion.
- **Ambiguous declarations are dropped.** A cookie declared under two categories gets
  no declaration, as in training.
- **Deep scans read it once.** The start page's declaration is applied to cookies found
  on every page of the crawl.

## Trade-offs

- **The model still runs on declared cookies.** That costs a classify call per cookie,
  but it is the only way to catch a site calling a tracking cookie "Necessary", which is
  a compliance finding in its own right. A disagreement is flagged only when the model's
  answer is High confidence and names a different real category, to keep noise down.
- **Declarations are still reviewed.** A declared category is a suggestion, like a
  known-cookie match, not an automatic publish. Auto-classification stays off until the
  model passes its gates; the site's word doesn't skip the reviewer.
- **Up to 4 s more per CMP site.** Banner data arrives 0.6-1.9 s after page load on
  the sites measured. Pages without a CMP don't wait, because a cheap check runs first.
- **Pre-consent cookies.** Scans don't click "Accept", so cookies set only after consent
  aren't observed. Their declarations exist, but there is nothing to attach them to.

## Alternatives considered

- **Trust the declaration and skip the model** (the original TODO). Cheaper, but a
  site's mislabelled cookie would pass silently.
- **Read Ketch, Transcend and Securiti too.** Their parsers exist in the collector, but
  they read network responses during page load, which the production scanner doesn't
  capture yet. OneTrust and Cookiebot cover most sites (877 and 81 of the collected
  sites), so they came first.

## Related

- [Scan API: cookie fields](../reference/scan-api.md#cookie-fields)
- [How a cookie gets its category](../cookie-classification-flow.md)
- [Known cookies: data checked before the model](../../models/known_cookies/README.md)
