# Production cookie-classification dataset

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
