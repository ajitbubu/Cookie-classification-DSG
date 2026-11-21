# Known cookies: data checked before the model

Everything `/api/v1/ml/classify` consults before the ML model lives here. A match
is a suggestion with its source attached and still goes to the Review Queue.

```
models/known_cookies/
├── known_cookies.json        built table the API loads (KNOWN_COOKIES_PATH in backend/config.py)
└── sources/
    ├── open-cookie-database/ curated cookie list (Apache 2.0, LICENSE alongside)
    ├── iab_gvl/              IAB TCF vendor list + each vendor's cookie disclosures
    ├── banner_imports/       consent-banner exports pulled from individual sites
    └── vendor_patterns/      vendor name/domain patterns (seeded into Postgres)
```

## Lookup order

1. **Reviewer override** (Postgres, from the Review Queue): always wins.
2. **Website majority**: at least 3 websites declare the cookie in their consent
   banners and at least two thirds agree. Counted from the banner collection and
   CookieBlock files in `models/training_data/` (large, training data too).
3. **Open Cookie Database**: exact name, else the longest wildcard prefix.
4. **IAB TCF vendor list**: advertising cookies ad-tech vendors disclose.
5. Otherwise the **ML model** predicts.

Steps 2-4 come from `known_cookies.json` (`backend/api/ml_classifier/known_cookies.py`).

## Sources

### `open-cookie-database/`

Open Cookie Database by jkwakman and contributors,
https://github.com/jkwakman/Open-Cookie-Database, Apache License 2.0 (`LICENSE`).
Retrieved 2026-11-12, `open-cookie-database.csv` sha256
`ed4836ea285719d77c7340582be68d355f7358edded50e6b96bb3139fc0eb8c0`. Used for lookup
only, not training. Changes made here: categories mapped to ours (Functional,
Security, Necessary -> Strictly Necessary; Personalization -> Functional; Analytics;
Marketing), wildcard entries shorter than 4 characters dropped.

### `iab_gvl/`

The IAB Europe TCF Global Vendor List (`vendor-list-v<N>.json`), the cookies each
vendor discloses (`disclosures_v<N>.csv`) and label counts (`summary_v<N>.json`),
written by `backend/scripts/crawl_gvl_disclosures.py`. Only the
`Marketing_Advertising` rows go into the table; the other labels are too sparse.
IAB republishes the list weekly (Thursdays, ~16:00 UTC) at
https://vendor-list.consensu.org/v3/vendor-list.json. Check IAB Europe's terms before
commercial use.

### `banner_imports/`

Single-site consent-banner exports (OneTrust JSON) kept for checking. Not read by
the builder yet.

### `vendor_patterns/`

Vendor cookie-name and domain patterns. Their content is seeded into Postgres by
`backend/db/migrations/002_add_vendor_patterns.sql` and `003_add_extended_vendor_patterns.sql`;
nothing reads these files at runtime.

## Refresh

```bash
# 1. New IAB vendor list + disclosures (about 40 s)
python -m backend.scripts.crawl_gvl_disclosures --out-dir models/known_cookies/sources/iab_gvl

# 2. Rebuild the table (in the API image, which has the backend deps)
docker run --rm -v "$PWD":/app -w /app cookie-classification-dsg-api-gateway:latest \
  python -m backend.scripts.build_known_cookies \
    --declarations models/training_data/banner/banner_all_2026-11-11b.csv \
    --declarations models/training_data/external/cookieblock/cookieblock_train_2021-05-10.csv \
    --open-cookie-database models/known_cookies/sources/open-cookie-database/open-cookie-database.csv \
    --gvl-disclosures models/known_cookies/sources/iab_gvl/disclosures_v<N>.csv \
    --output models/known_cookies/known_cookies.json

# 3. Load it
docker compose restart api-gateway
```
