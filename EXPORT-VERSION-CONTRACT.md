# Producing app version — additive metadata, 0.6.2

New `scroll-state-summary` version 1 exports and newly generated `scroll-update-receipt` version 1 records contain an optional `app_version` string. Current output: `"app_version": "0.6.2"`.

This identifies the producing application, not the campaign revision, lineage, data-schema version or update-envelope version. None of those fields changes meaning. Consumers must accept older exports that omit app_version. Receipt validation accepts its absence; if present it must be nonblank text, subject to the existing string limit. No fixed-version allowlist is used.

Historical stored receipts are immutable: re-copying or retrying an already-applied update returns the original receipt, including its original app_version or its absence. New state summaries identify the currently running build. The reference and trainer snapshot formats do not gain this field.

Do **not** include app_version in a `scroll-session-update` request: its existing strict envelope is unchanged and rejects unknown keys. Baseline and snapshot import shapes are unchanged.

Compatibility boundary: a new receipt is included in its normal transaction and therefore in later backups. The backup envelope/schema version is unchanged and this release accepts old backups. A pre-0.6.2 app has a strict receipt allowlist and can reject a backup containing app_version; upgrade that reader before restoring such a backup. Do not remove receipt metadata or rewrite history to downgrade.

Implementation: one shared `dist/version.js`; projection in `dist/core.js::summary`; new receipt creation in `dist/updates.js::previewUpdate`; optional validation in `dist/core.js::validateState`. Runtime Copy DM instructions explains this addition. The bundled template kit remains unchanged because F is skipped.
