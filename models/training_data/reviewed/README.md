# Reviewed labels

Human-checked categories for held-out test cookies. The trainer scores a model
against them (`--reviewed-labels`) separately from the websites' own labels; it
never trains on them.

## `review_sheet_v7.1.0.csv`

The 334 cookies from v7.1.0's test sites whose names the model never saw in
training (77 sites). Built by `backend/scripts/build_review_sheet.py`.

The sheet is **blind**: the website's own category and the model's guess are
left out on purpose, so they don't anchor the reviewer.

### How to fill it in

For each row, put one code in `reviewed_label`:

| Code | Category | Use when the cookie... |
|---|---|---|
| `SN` | Strictly Necessary | is needed for the site to work or to do what the visitor asked: sign-in, security, load balancing, cart, storing the consent choice itself |
| `F` | Functional | remembers a visitor's choice that improves the site but isn't required: language, region, timezone, UI state, chat widget |
| `A` | Analytics / Performance | measures visits or behaviour for the site's own statistics, A/B tests or performance monitoring |
| `M` | Marketing / Advertising | tracks the visitor for ads, retargeting, attribution or cross-site profiles |
| `?` | Can't tell | there isn't enough to decide; these rows are left out of the score |

- Judge the cookie's real purpose, not what the website's banner calls it.
- Evidence: the cookie name, `cookie_domain`, `party`, `expiry_days`, the
  banner's `provider` and `banner_description`, and the vendor's own docs if you
  look the name up.
- Use `notes` for anything worth keeping (e.g. "Adobe Edge identity cookie").
- Blank rows count as not reviewed yet, so the sheet can be filled in batches.
- Anything other than the five codes stops the trainer with the line number.

### Scoring with it

```bash
python -m backend.scripts.train_cookie_model ... \
  --reviewed-labels models/training_data/reviewed/review_sheet_v7.1.0.csv
```

`metadata.json` then gets `metrics.internal_site_holdout.reviewed`: macro F1 and
per-class scores against the reviewed labels, plus `website_label_agreement`
(how often the website's own label matched the reviewer).
