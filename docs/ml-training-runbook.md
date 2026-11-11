# Runbook: cookie data and ML model training

How cookies get from websites into training data, how to add more, and how to
train, check and ship a new classifier. Commands run from the repo root with the
Python venv active (`pip install -r requirements.txt -r requirements-test.txt`).

Background reading, not repeated here:

- `models/training_data/README.md`: the 16-column schema and dataset files
- `models/training_data/PHASE0_CMP_FINDINGS.md`: how OneTrust and Cookiebot publish their cookie lists
- `models/training_data/BANNER_COLLECTION_TRAINING_PLAN.md`: the longer plan (collector, label review, v7.0.0)

## The pipeline at a glance

```
 website ──► (1) pull cookies ──► raw export ──► (2) build 16-column CSV ──► (3) train ──► models/vX.Y.Z ──► (4) deploy
              scanner / banner     cookies_*.csv     build_production_dataset    train_cookie_model    ML_MODEL_VERSION
              CookieBlock          *.novalues.json   cookieblock_adapter
```

Every training row needs a **label** (what the cookie is for) and the cookie's
**browser attributes** (domain, expiry, secure, httpOnly, sameSite). The label
must come from a real source, never a guess:

| Source | `label_source` | Where the label comes from |
|---|---|---|
| Main dataset | `legacy_import_unverified` | Older labelled exports; provenance not verified |
| Banner exports | `website_banner_explicit` | The site's own consent banner (OneTrust, Cookiebot, Ketch, Transcend, Securiti) declared the category, and the browser actually set the cookie |
| CookieBlock | `cmp_declaration_cookieblock` | Same idea, from ETH Zurich's 2021 crawl of about 28,000 sites |

## Current data (2026-11-11)

| File (under `models/training_data/`) | Rows | In git | Used as |
|---|---|---|---|
| `banner/banner_collect_2026-11-11.csv` (+ `_sidecar.csv`, `_manifest.json`) | 11,797 from 205 real sites | not yet | `--input`: the only source split into train / calibration / test |
| `cookie_classification_production.csv` | 73,001 (mostly synthetic sites) | yes | `--train-only-input` (training only, never test) |
| `external/cookieblock/cookieblock_train_2021-05-10.csv` | ~247,000 | no (gitignored, local only) | `--train-only-input` (training only, never test) |
| `external/cookieblock/cookieblock_review_2021-05-10.csv` | ~55,000 | no | Not trained: cookie names whose label disagrees across sites, kept for human review |
| `phase0_samples/onetrust/` | 11 original + `collect_2026-11-10/` (103) + `collect_2026-11-11/` (103) sites | not yet | Raw banner exports, the input to the banner CSV |
| `banner/onetrust_sites_*.txt`, `banner/banner_sites_*.txt` (+ `_verification*.csv`) | site lists | not yet | Which sites were collected and why (see §2) |
| `collection_sites.csv` | 387 sites | not yet | Every site we hold or checked; CookieBlock drops these (see §2) |

The live model is `models/v7.0.0` (trained 2026-11-11 on 243 real banner sites: 217 OneTrust,
26 Ketch/Transcend/Cookiebot/Securiti; banner data only, no CookieBlock; review-only). Its
`metadata.json` records `promotion_eligible: false`: auto-classification is off. Roll back to
`v6.5.0` if needed. CookieBlock was tested as extra training data for v7 and lowered held-out
accuracy (81.6% → 77.3%), so it is no longer used.

## 1. How cookies are pulled from a website

### a. The app's scanner (what users see in the dashboard)

`POST /api/scan` and `/api/scan-stream` (`backend/api/routes.py`) open the site in
Playwright (`backend/scanner/cookie_scanner.py`, `scan_page`):

1. Load the page (`wait_until="domcontentloaded"`), wait `COOKIE_WAIT_TIME` (0.5 s).
2. Read every cookie the browser holds: `context.cookies()`. That gives name,
   domain, path, expiry, secure, httpOnly, sameSite. **Cookie values are not used for training.**
3. Deep scans also follow same-site links and sitemaps (`backend/scanner/parallel.py`).
4. The rule-based classifier and the ML API label each cookie, and the frontend saves
   the scan to MongoDB (`/api/store/scans`).

The scanner does **not** click "Accept all", so it mostly sees cookies set before
consent. It only scans public sites: internal and private addresses are blocked
(`backend/scanner/url_guard.py`).

Scanner results are **not** training data by themselves: their labels come from
the current model, so training on them would teach the model its own mistakes.
They only become training data once a person confirms the category in the Review
Queue. There is no export path for those approvals into a training CSV yet.

### b. Consent-banner exports (best new labels)

A banner export is one CSV per site, named `cookies_<site>_<YYYY-MM-DD>.csv`, with
this header (the builder detects it automatically):

```
category,categorySource,cmp,name,domain,path,party,expires,declaredDuration,httpOnly,secure,sameSite,partitioned,status,provider,description
```

Only rows with `categorySource = banner` **and** `status = Declared & set` become
training rows: the banner declared the cookie and the browser really set it.
Guessed or undeclared rows are counted in the manifest, never trained on.

**Supported banner vendors:** `backend/scripts/collect_banner_cookies.py` writes
these exports for five hosted banner vendors (CMPs). It detects the vendor itself.
To collect a whole batch of new sites, follow "Add a batch of banner sites" in §2;
this is what the collector does for one site.

#### Which vendors can be collected

A vendor is only usable if it publishes **a category for every cookie name**.
Vendors that label only vendors or purposes (IAB TCF banners) can't give
cookie-level labels. Checked on 2026-11-11, on 2–3 live sites each:

| Vendor | Where the declaration comes from | Category used | Collected? |
|---|---|---|---|
| **OneTrust** | in page: `window.OneTrust.GetDomainData()` → `Groups[]` (`FirstPartyCookies[]`, `Hosts[].Cookies[]`) | `GroupName` | ✅ |
| **Cookiebot** | in page: `window.CookieConsentDialog.cookieTable{Necessary,Preference,Statistics,Advertising,Unclassified}`; rows are `[name, provider domains, purpose, expiry, type, _, regex, …]`; only `type = HTTP Cookie` is kept | table name (Necessary / Preferences / Statistics / Marketing) | ✅ |
| **Ketch** | response `global.ketchcdn.com/web/v3/config/…/config.json` → `purposes[].cookies[]` | purpose `name` ("Advertising", "Strictly Necessary", "Performance & Analytics" …) | ✅ |
| **Transcend** | response `transcend-cdn.com/cm/<id>/airgap.js`, which embeds `{"cookie":"_fbp","purposes":["Advertising","SaleOfInfo"]}` | the purpose. `SaleOfInfo` (a US opt-out flag) is ignored next to a real purpose; two real purposes mean "conflicting"; URL entries are dropped; regex names become prefixes | ✅ |
| **Securiti** | response `cdn-prod(.eu).securiti.ai/consent/cookie_banner/…/<lang>.json` → `categories[].cookies[]`; only `type = http_cookie` is kept | category `name` | ✅, but "Analytics & Customization" and "Performance & Functionality" are dropped because each mixes two of our classes |
| Usercentrics | lists *services* on load; cookie names load only when a user opens a service's details | n/a | ❌ not yet |
| TrustArc, Osano | nothing per cookie on page load (any list would be inside the preferences panel) | n/a | ❌ not investigated |
| Sourcepoint, Google Funding Choices, Didomi, InMobi/Quantcast | IAB TCF: vendor- and purpose-level only | n/a | ❌ not usable |

Category names are written to the export exactly as the site wrote them. The
dataset builder maps them through `LABEL_ALIASES` in `build_production_dataset.py`
and drops (and counts) any name it can't map, so an unknown category is never
guessed. To accept a new category name, add an alias **and** a case in
`test_vendor_category_names_map_and_ambiguous_ones_are_dropped`.

#### How the collector reads a banner

The collector, per site, in headless Chromium:

1. Loads the homepage, records the vendor config responses listed above, and polls
   for up to 10 s until one vendor's declaration appears, trying OneTrust,
   Cookiebot, Ketch, Transcend, then Securiti. Each declared cookie has a name, a
   category, and sometimes a host, lifespan and description. That is the **label**.
2. Accepts all cookies: OneTrust's `#onetrust-accept-btn-handler` or
   `OneTrust.AllowAll()`; Cookiebot's allow-all button or
   `Cookiebot.submitCustomConsent(true, true, true)`; otherwise a button named
   "Accept all", "Allow all", "I agree" or similar. Then it waits and reloads, so
   cookies that need consent get set. `accepted=False` is common on US Ketch,
   Transcend and Securiti sites, which are opt-out by default: cookies are set
   anyway, so the export is still usable.
3. Visits up to `--pages` (default 4) same-site links, skipping login, cart and
   checkout, and scrolls, so cookies set on later pages appear.
4. Reads every cookie the browser holds through CDP `Network.getAllCookies`
   (all domains, third-party included). That gives the **browser attributes**.
   Values are never read. An unset SameSite stays `unspecified`.
5. Matches each observed cookie to a declaration by name. Templated declarations
   such as `_ga_xxxxxxxxxx` (OneTrust), `BIGipServer#` (Cookiebot) or a Transcend
   regex match as prefixes. A declaration whose host matches the
   cookie's domain wins over one that doesn't.
6. Writes `cookies_<site>_<date>.csv` with one row per cookie and a `status`:

| `status` | Meaning | Trained on? |
|---|---|---|
| `Declared & set` | declared under one category and really set | **yes** |
| `Declared, not set` | declared, never seen in the browser (no attributes) | no |
| `Not declared` | set, but the banner doesn't list it | no |
| `Declared, conflicting` | declared under two or more categories | no |

```bash
python -m backend.scripts.collect_banner_cookies \
  --out-dir models/training_data/phase0_samples/<vendor>/collect_<date> \
  --date <date> www.okta.com www.ticketmaster.com www.grammarly.com
```

Keep one folder per vendor (`phase0_samples/onetrust/`, `cookiebot/`, `ketch/`,
`transcend/`, `securiti/`). Mixed batches still work because every row carries its
`cmp`, but separate folders keep the manifests readable.

It prints one line per site: `cmp=<vendor> declared=N observed=N declared&set=N accepted=True pages=N`.
On 2026-11-11 the first real runs gave: similarweb.com (Cookiebot) 54 usable rows,
ticketmaster.com (Ketch) 48, grammarly.com (Transcend) 38, hertz.com (Securiti) 21.
How to read it:

| Output | Meaning | What to do |
|---|---|---|
| `cmp=none declared=0` | no supported vendor on the page: TrustArc, Osano, a TCF banner, or the banner never loaded | drop the site |
| `accepted=False` | no accept control worked | check `declared&set`. US opt-out sites (Ketch, Transcend, Securiti) still give rows. With 0 rows (us.pandora.net), drop the site |
| `pages=0`, only a few cookies | the site blocked the headless browser (xfinity.com, bankofamerica.com, salesforce.com on 2026-11-10) | keep an older export for it, if there is one |
| `FAILED <site>: …` | timeout or navigation error; the batch carries on | retry once on its own; drop it if it fails again |

The original 11 `phase0_samples/onetrust/` exports came from a browser extension
that isn't in this repo; everything since 2026-11-10 comes from the collector.

When a site has two exports, build from **one** per site: whichever gives more
usable rows. Two captures of the same site differ slightly in expiry, so both
would be kept and double-count those cookies.

To collect a site by hand, or to check an export:

1. Find which banner the site uses: `python -m backend.scripts.find_banner_sites`
   on a one-line file prints the vendor and the number of declared cookies.
2. Pull the declaration:
   - **OneTrust:** `https://cdn.cookielaw.org/consent/<id>/<id>.json` → `RuleSet[]`, then
     `https://cdn.cookielaw.org/consent/<id>/<RuleSet.Id>/en.json` → `DomainData.Groups[]`.
   - **Cookiebot:** `https://consent.cookiebot.com/<cbid>/cdreport.js?referer=<final site host>&culture=en`.
     Follow redirects first and use the final host, or Cookiebot refuses the referer.
3. Accept the banner in a real browser and capture the cookies actually set
   (browser attributes come only from this capture; never infer them).
4. Save as `models/training_data/phase0_samples/<cmp>/cookies_<site>_<date>.csv`.

Map banner categories **by group name, not ID** (OneTrust IDs are customer-defined).
The mapping is in `PHASE0_CMP_FINDINGS.md`, "Category mapping".

### c. CookieBlock (large public dataset, training only)

Downloaded once from Zenodo record 5838646 (CC BY 4.0, attribution in
`models/training_data/README.md`). `models/training_data/cookieblock_manifest.json`
holds the URL, checksums and the stripped-copy path. The raw download was deleted
after cookie values were removed; only the value-free JSON is kept, under
`external/cookieblock/stripped/`.

## 2. Add more cookies

### Add a batch of banner sites

This is how the 206 sites collected on 2026-11-10 and 2026-11-11 were added. Use a
new date in every file name so earlier batches stay reproducible. Allow about an
hour for a batch of 100 sites.

**Before you start:** Docker isn't needed for collection; it runs on your machine.
Use the venv's Python (`pip install -r requirements.txt` includes Playwright; run
`playwright install chromium` once).

**1. Write a candidate list.** A text file, one host per line, `#` comments allowed.
Pick large public sites across sectors (tech, retail, media, travel, finance, health,
food, autos, telecom). OneTrust is the most common vendor among big brands. Among 336
non-OneTrust sites checked on 2026-11-11: Ketch 32, TrustArc 30 (not supported),
Transcend 11, Osano 11 (not supported), Cookiebot 6, Securiti 3, and 208 with no
banner detected. Leave out hosts
already in `models/training_data/collection_sites.csv`. Expect about a third of
candidates to qualify: 2026-11-11 checked 418 and found 149.

**2. Check every candidate** (robots.txt and a supported banner; no cookies are collected):

```bash
python -m backend.scripts.find_banner_sites candidates_<date>.txt \
  --out models/training_data/banner/banner_sites_<date>_verification.csv
```

A site is `usable` only when **both** hold:

- robots.txt explicitly allows `/`. "disallowed" and "unknown" (403s, timeouts) are
  both left out; cisco.com, intel.com and bmw.com were excluded this way.
- The homepage runs a supported vendor (column `cmp`) with a non-empty declaration
  (`declared > 0`). Detection is the collector's own code, so a usable site here
  is a site the collector can read.

**3. Remove duplicates.** Do this by hand. It decides whether the test results mean anything.

- **Same final host:** some candidates redirect to another one (talend.com → qlik.com,
  hotjar.com → contentsquare.com, sprint.com → t-mobile.com). Keep one; use
  `final_host` from the verification CSV as the site name.
- **Sister brands: keep one site per parent company**, including parents already
  collected in earlier batches. Brands of one company usually share one banner
  setup, so if one lands in training and its sister in the test set, the test is
  partly a repeat of training. Examples dropped on 2026-11-11: Slack (Salesforce),
  NBC and Bravo (Comcast, Xfinity already collected), 9 Dotdash Meredith titles
  (People already collected), P&G's Tide, Crest and Gillette (pg.com kept).
- Write a short reason for each dropped site, so the next batch can reuse the
  decisions.

**4. Save the approved list** to `models/training_data/banner/banner_sites_<date>.txt`,
with a comment header saying how it was checked (copy one of the existing lists).

**5. Collect, 6 sites in parallel.** The collector handles one site at a time, about
30–60 s each, so split the list:

```bash
bash <<'EOF'
D=<date>; V=<vendor folder, e.g. onetrust or ketch>; OUT=models/training_data/phase0_samples/$V/collect_$D; mkdir -p $OUT
for i in 0 1 2 3 4 5; do
  SITES=$(grep -v '^#' models/training_data/banner/banner_sites_$D.txt | awk -v i=$i 'NF && (NR-1)%6==i')
  python -u -m backend.scripts.collect_banner_cookies --out-dir $OUT --date $D $SITES > /tmp/ot_chunk_$i.log 2>&1 &
done; wait
grep -h FAILED /tmp/ot_chunk_*.log      # retry these once on their own
EOF
```

Keep parallelism at about 6: each process runs its own Chromium.

**6. Check the yield.** On 2026-11-10, 98 of 103 sites gave rows: 5,833 "declared&set"
cookies, 89 sites with 10 or more. Drop sites with 0 rows (see the table in §1b).

**7. Add the new sites to the CookieBlock exclusion list, then rebuild CookieBlock**
("Rebuild CookieBlock" below). Add the dropped sister brands too: excluding more
sites from CookieBlock is always safe.

**8. Build the banner CSV** from all exports ("Add banner data for new sites", next),
then **train** (§3).

### Add banner data for new sites

1. Put each new export in `models/training_data/phase0_samples/<cmp>/` (or a
   `collect_<date>/` folder under it) using the `cookies_<site>_<YYYY-MM-DD>.csv` name.
2. Rebuild the banner CSV from **all** exports (old and new), one export per site.
   The simplest way to get the right file list is to start from the previous
   build's manifest (`sources[].file`) and add the new folder. Use a new date in the
   file names so the previous build stays reproducible:

   ```bash
   D=$(date +%F); B=models/training_data/banner; PREV=$B/banner_collect_2026-11-10_manifest.json
   INPUTS=$(python3 -c "
   import json, glob
   old = [s['file'] for s in json.load(open('$PREV'))['sources']]
   new = sorted(glob.glob('models/training_data/phase0_samples/*/collect_$D/cookies_*.csv'))
   print(' '.join('--input ' + f for f in old + new))")
   python -m backend.scripts.build_production_dataset ${=INPUTS} \
     --output   models/training_data/banner/banner_$D.csv \
     --sidecar  models/training_data/banner/banner_${D}_sidecar.csv \
     --manifest models/training_data/banner/banner_${D}_manifest.json \
     --dataset-source banner_collect_$D
   ```

   `${=INPUTS}` is zsh, the macOS default, for "split into separate arguments". In
   bash, write `$INPUTS`.

3. Open the manifest. Per input file it reports `accepted_rows`, `declared_not_set`,
   `not_banner_declared` and `unsupported_label`. A site with `accepted_rows: 0`
   (coherehealth.com in Phase 0) contributed nothing; check that its export has
   `Declared & set` rows.
4. If any new site is also in CookieBlock, rebuild CookieBlock (below) so that site
   can't leak into training while it's in your test set.

The sidecar holds each row's CMP and the banner's own wording. Pass it to the
trainer with `--evidence-sidecar` so per-CMP accuracy is checked; it is never a
model feature.

### Add a legacy labelled CSV

Any CSV with one labelled cookie per row can go through the same builder with
`--input`. Labels are normalized through `LABEL_ALIASES` in
`backend/scripts/build_production_dataset.py`; a label it doesn't know is
counted as `unsupported_label` and dropped. Add an alias there (with a test in
`tests/backend/test_production_dataset_builder.py`) rather than editing the CSV.

### Rebuild CookieBlock

Needed when the site list changes. The adapter drops every CookieBlock site that is
also in your own collection, so CookieBlock can't leak into your test sites.

1. Update the exclusion list, `models/training_data/collection_sites.csv` (one
   `site_domain` column). It must list **every** site in the main dataset and the
   banner exports, plus every banner site you checked, including dropped sister
   brands and redirect targets. Add to it; never remove a site. The adapter matches
   by registrable domain, so `www.cnn.com` also drops `edition.cnn.com`. On
   2026-11-11 it had 387 sites, and 74 CookieBlock sites (2,004 rows) were dropped.
2. If `stripped/cookieblock_training_2021-05-10.novalues.json` is missing, download
   `datasets.zip` from the URL in `cookieblock_manifest.json`, check its sha256,
   take the member listed there, and remove cookie values before saving it.
3. Run:

   ```bash
   CB=models/training_data/external/cookieblock
   python -m backend.scripts.cookieblock_adapter \
     --input $CB/stripped/cookieblock_training_2021-05-10.novalues.json \
     --exclude-sites models/training_data/collection_sites.csv \
     --output        $CB/cookieblock_train_2021-05-10.csv \
     --review-output $CB/cookieblock_review_2021-05-10.csv \
     --sidecar-output $CB/cookieblock_sidecar_2021-05-10.csv \
     --manifest      $CB/cookieblock_adapter_manifest.json \
     --crawl-date 2021-05-10
   ```

4. Check `counts` in the adapter manifest, especially `listed_site_rows_dropped`.

## 3. Train a model

```bash
python -m backend.scripts.train_cookie_model \
  --input models/training_data/banner/banner_<date>.csv \
  --evidence-sidecar models/training_data/banner/banner_<date>_sidecar.csv \
  --train-only-input models/training_data/cookie_classification_production.csv \
  --train-only-input models/training_data/external/cookieblock/cookieblock_train_2021-05-10.csv \
  --test-fraction 0.20 --calibration-fraction 0.15 \
  --version <x.y.z> --output-dir models/v<x.y.z>
```

**Only real banner sites go in `--input`.** The main dataset is mostly synthetic
sites (shop.example.com, saasproduct.app). Up to v6.3.0 it was an `--input`, and its
easy synthetic sites made up most of the test set: v6.3.0 reported 100% auto
precision, but nearly all of it came from synthetic sites. On real sites, confident
answers were about 87% right.

What the trainer does (`backend/scripts/train_cookie_model.py`):

- Splits the `--input` sites: about **65% train, 15% calibration, 20% test**, by
  **site**, so no site is in two parts. With 107 real sites that was 70 / 16 / 21.
- `--train-only-input` rows only ever join training. Rows from a calibration or
  test site are dropped from them, so held-out sites stay unseen.
- Uses the production feature extractor (`FeatureExtractorV5`), so training and serving see identical features.
- Drops `Unclassified` rows and learns **four** classes. `Unclassified` is what the API returns
  when the model abstains (low confidence, or the evidence guard sees no known name/vendor signal).
- **Calibrates on all cookies of the calibration sites**, the mix a real scan
  sees, and picks per-class auto-classification thresholds there. A threshold is
  only enabled when at least 50 calibration predictions clear it with a 95% Wilson
  lower bound. Calibrating only on never-seen names (v6.4.0's first attempt, 142
  rows) made the model doubt everything, including `_ga`.
- **Reports two test scores.** "New cookie names" keeps only test rows whose name
  never appears in training, which measures how it handles unknown cookies.
  "All cookies" uses every row on the test sites, which is what a scan of a new
  website meets.
- Writes `model.ubj`, `labels.json`, `features.json`, `calibration.json`, `metadata.json` and
  `manifest.json` to `--output-dir`, plus `model_artifacts/cookie-model-v<version>.tar.gz` and its `.sha256`.

Use a new `--version` and `--output-dir` every time; it stops if the output folder
already has files, unless you pass `--overwrite`.

### Add an external holdout (required to promote)

Hold back sites the trainer never sees, ideally from a collection on a different date,
and build them into their own CSV with the builder. Then add:

```bash
  --external-holdout models/training_data/banner/holdout_<date>.csv \
  --external-provenance "banner-collect <date>"
```

Both flags must be given together.

## 4. Check the result

Read `models/v<version>/metadata.json`:

| Field | Pass when |
|---|---|
| `acceptance.internal_gates.macro_f1` | test macro F1 ≥ 0.75 (`--minimum-macro-f1`) |
| `acceptance.internal_gates.marketing_recall` | Marketing recall ≥ 0.70 (`--minimum-marketing-recall`) |
| `acceptance.internal_gates.auto_precision` | on **new cookie names** in the test set: ≥ 100 auto-classified predictions from ≥ 20 sites, with Wilson and site-bootstrap lower bounds ≥ 95% |
| `acceptance.internal_gates.auto_precision_all_cookies` | the same rule on **all cookies** of the test sites (`metrics.internal_site_holdout_all_cookies`) |
| `acceptance.internal_gates.per_cmp_macro_f1` | each CMP with ≥ 300 test rows from ≥ 20 sites is within 5 points of overall macro F1 (needs `--evidence-sidecar`) |
| `acceptance.internal_gates.site_holdout_is_disjoint`, `name_holdout_is_disjoint` | no site, and no cookie-name family, in both train and test |
| `acceptance.external_holdout_gate` | external holdout macro F1 ≥ 0.75 and its auto policy passes; needs `--external-holdout` |
| `acceptance.promotion_eligible` | true only when every internal gate and the external gate pass |

v6.1.0 was trained with an older version of the script, so its `metadata.json`
shows a slightly different gate list (`unclassified_precision`, no per-CMP gate).

**Reading the numbers on real sites.** The macro F1 (0.75) and Marketing recall
(0.70) minimums were set when the test set was mostly synthetic. On real sites
only, v6.4.0 scored 0.56 / 0.84 on all cookies and 0.36 / 0.34 on new names, so
those two gates fail. To judge a new model, compare it with the live one on the
**same** test sites:

- **Top-1 accuracy, all cookies:** v6.3.0 71.2%, v6.4.0 74.0%.
- **Per-category precision at confidence ≥ 0.8**, from
  `calibration.per_class_auto_thresholds`, plus your own breakdown. For v6.4.0:
  Marketing 99%, Strictly Necessary 87%, Analytics 85%, Functional almost never
  confident.

**Why a gate says "Not met".** Look at `auto_policy` in each metrics block:

- `distinct_sites` below 20: not enough held-out sites. Collect more.
- `eligible_predictions` 0, with every threshold `enabled: false` in
  `calibration.json`: calibration couldn't prove 95% for any class.
- `site_bootstrap_lower_bound` far below `accuracy`: the errors are concentrated on
  one or two sites, often where the site's own label disagrees with other sites
  (Allstate labels `_gat_gtag_UA_*` as Marketing).

Then run the tests, including the known-cookie checks in
`tests/backend/test_ml_classifier_regression.py`:

```bash
pytest tests/backend/ -v
```

Leave auto-classification off (no `--enable-auto-classification`) unless every gate
passes, internal and external.

## 5. Deploy the new model

1. Point the services at the new version. Keep these five places in step:
   - `docker-compose.yml`: `ML_MODEL_VERSION` for `ml-api`
   - `docker/Dockerfile.ml-api`: `ENV ML_MODEL_VERSION`
   - `backend/api/ml_classifier/config.py`: the default for `CURRENT_MODEL_VERSION`
     (the api-gateway has no `ML_MODEL_VERSION` env var and uses this default)
   - `tests/run_api_tests.sh`: the `MODEL_VERSION` default
   - `tests/backend/test_api.py`: the `model_version` assertion in the model-info test
2. Restart. Both the API gateway and the ML API serve `/api/v1/ml` and mount `./models`:

   ```bash
   docker compose up -d --build ml-api api-gateway
   docker compose restart api-gateway                 # it reads the version from config.py at startup;
                                                      # `up -d` doesn't recreate it when only that file changed
   docker compose ps                                  # both must be "running", not just "created"
   docker exec cookie-scanner-nginx nginx -s reload   # nginx caches the old container IP: 502 until reloaded
   curl -u <user> http://localhost/api/v1/ml/model-info
   ```

   If `up` stops with "dependency failed to start ... unhealthy" (a slow Mongo or
   Postgres healthcheck during a long build), the new containers are left in
   `created`; run `docker compose up -d ml-api api-gateway` again once `docker compose ps`
   shows the dependency healthy.

   `model-info` should report the new version. A 500 means that version's folder has no model file.

   **Docker needs about 16 GB.** At the 8 GB default, scanning plus a model reload
   ran the Docker VM out of memory twice on 2026-11-10/11: scans timed out after
   120 s, then `docker ps` itself hung. Set Docker Desktop → Settings → Resources →
   Memory to 16 GB. If the setting doesn't stick, check that
   `~/Library/Group Containers/group.com.docker/settings-store.json` has
   `"MemoryMiB": 16384`, then fully quit and reopen Docker Desktop.
   `docker info --format '{{.MemTotal}}'` should show about 16 GB.

   **After any Docker restart, check that the API reached Postgres.** If Postgres
   starts after the API, the API gives up after 3 attempts and runs without the
   pattern table, the knowledge base or reviewer overrides. Check with:

   ```bash
   docker compose logs --since 10m api-gateway | grep -E "Database connection established|Database pool not available"
   ```

   If it says "not available", run `docker compose restart api-gateway` and
   `docker exec cookie-scanner-nginx nginx -s reload`. A quick functional check:
   classifying `_ga` should return `source: pattern_match`.

4. **Re-run the hallucination probe** against the live API:

   ```bash
   python -m backend.scripts.hallucination_probe \
     --banner-csv models/training_data/banner/banner_<date>.csv \
     --sites <2–3 test sites from metadata.json dataset.split.test_sites>
   ```

   Expect `A_nonsense` all abstained (`confident: 0`), and `B_lookalike` with at most
   `consent_text_lang`, which the `consent` keyword pattern matches on purpose.
   `C_banner.wrong` lists confident answers that contradict the site's own banner.
   On 2026-11-11, v6.4.0 had 0 / 1 / 1.
3. Commit the new `models/v<version>/` folder (it's small: v6.1.0 is 2.9 MB), plus any
   new banner CSVs and manifests. Don't commit CookieBlock files: they're large,
   gitignored, and rebuildable from the manifest.

## Rollback

Set `ML_MODEL_VERSION` back to the previous version in the five places above and
restart `ml-api` and `api-gateway`. Old versions stay in `models/` for this
(`v1.0.0` … `v6.1.0`, `v6.2.0`, `v6.3.0`, `v6.4.0`, `v6.5.0`); don't delete the one you'd roll back to.
`ML_MODEL_VERSION=2.0.0 tests/run_api_tests.sh` checks that a legacy model still loads.

## Rules that keep the data trustworthy

- No cookie values, ever, in any training file or sidecar.
- Never infer missing browser attributes; leave them blank.
- Labels come from a declaration or a human reviewer, never from a model's own prediction.
- Raw exports are immutable. Rebuild outputs under a new date instead of editing them.
- Keep every manifest: it records input checksums and row counts, so any build can be repeated.
- Respect robots.txt and site terms when collecting; no logins. `find_banner_sites`
  drops any site whose robots.txt disallows `/` or can't be read.
- One site per parent company in the banner data; sister brands share a banner
  setup and leak between training and test.
- Calibrate and test on real sites only; synthetic data is training-only.
