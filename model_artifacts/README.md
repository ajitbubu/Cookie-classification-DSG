# Model artifact channel

`backend/scripts/train_cookie_model.py` writes a versioned `tar.gz` bundle and
SHA-256 sidecar here. Each bundle contains a native XGBoost model, portable label
list, feature manifest, calibration policy, metadata, and per-file checksum
manifest.

Only a bundle whose `metadata.json` says `promotion_eligible: true` may be
promoted. That requires both internal acceptance gates and a separately sourced,
site-domain-disjoint external holdout with documented provenance.

Production images should consume the unpacked version directory under `models/`
or retrieve the exact bundle from the organization's authenticated artifact store
using the recorded SHA-256. Do not substitute a similarly named mutable file.
