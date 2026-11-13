# Production cookie-classification dataset

Step-by-step guide to collecting cookies, adding data, training and deploying:
[`docs/ml-training-runbook.md`](../../docs/ml-training-runbook.md).

This folder contains one canonical dataset and its integrity manifest:

- `cookie_classification_production.csv`
- `dataset_manifest.json`
- `COOKIE_BANNER_EXTRACTION_INSTRUCTIONS.md`

The CSV contains 73,001 deduplicated observations and exactly 16 columns. Labels
are normalized to the five v6 categories. Rows without `site_domain`,
`cookie_name`, or `cookie_domain` were rejected during the build.

## Schema

1. `observation_id`
2. `observed_at`
3. `site_domain`
4. `cookie_name`
5. `cookie_domain`
6. `path`
7. `expiry_days`
8. `secure`
9. `http_only`
10. `same_site`
11. `host_only`
12. `partitioned`
13. `setter_domain`
14. `label_category`
15. `label_source`
16. `dataset_source`

The source exports did not contain trustworthy values for `observed_at`, `path`,
`host_only`, `partitioned`, or `setter_domain`, so those fields are intentionally
blank. They must be populated by future production collection rather than
inferred after the fact.

## Labels

- `Analytics_Performance`
- `Functional`
- `Marketing_Advertising`
- `Strictly_Necessary`
- `Unclassified`

## Rebuilding

The deterministic builder is `backend/scripts/build_production_dataset.py`.
Input hashes, normalization counts, field completeness, output checksum, and
class distribution are recorded in `dataset_manifest.json`.

The superseded source files were moved to macOS Trash after validation, so they
remain recoverable until Trash is emptied.

## Third-party data: CookieBlock

Train-only rows come from the CookieBlock dataset: Dino Bollinger, Karel Kubicek,
Carlos Cotrini and David Basin, "Automating Cookie Consent and GDPR Violation
Detection", USENIX Security 2022. Data: Zenodo record 5838646
(https://zenodo.org/records/5838646), licensed CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). Changes made here: cookie values
removed, labels mapped to the five classes above, sites in our collection list
dropped, conflicting cookie families set aside for review.

The data is not committed. `cookieblock_manifest.json` records the download URL,
checksums and profile; the value-stripped copy lives in the gitignored
`external/cookieblock/` folder. `backend/scripts/cookieblock_adapter.py` turns it
into a 16-column CSV that is only passed to the trainer as train-only input.

## Third-party data: Open Cookie Database

Used only for the known-cookie table (`models/known_cookies/known_cookies.json`),
not for training. Open Cookie Database by jkwakman and contributors,
https://github.com/jkwakman/Open-Cookie-Database, licensed Apache License 2.0
(copy in `external/ocd/LICENSE`). Retrieved 2026-11-12, `open-cookie-database.csv`
sha256 `ed4836ea285719d77c7340582be68d355f7358edded50e6b96bb3139fc0eb8c0`.
Changes made here: categories mapped to ours (Functional, Security, Necessary ->
Strictly Necessary; Personalization -> Functional; Analytics; Marketing), wildcard
entries shorter than 4 characters dropped. The CSV lives in the gitignored
`external/ocd/` folder like CookieBlock.

## Known-cookie table

`backend/scripts/build_known_cookies.py` turns website declarations (banner
collection + CookieBlock) and the Open Cookie Database into
`models/known_cookies/known_cookies.json`, which `/api/v1/ml/classify` checks
before the model. A cookie gets a website category when at least 3 websites
declare it and at least two thirds agree; otherwise an Open Cookie Database entry
is used; otherwise the model predicts. Matches are suggestions and still go to the
Review Queue. Rebuild after new banner collection:

    python -m backend.scripts.build_known_cookies \
        --declarations models/training_data/banner/banner_all_2026-11-11b.csv \
        --declarations models/training_data/external/cookieblock/cookieblock_train_2021-05-10.csv \
        --open-cookie-database models/training_data/external/ocd/open-cookie-database.csv \
        --output models/known_cookies/known_cookies.json
