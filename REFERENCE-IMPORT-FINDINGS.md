# Reference export and same-day import — source findings

2026-10-11. Read before implementation against 0.6.2, commit 2139d3a60d71db88b382cd718c5dd5ce8fbfc60b. Generic examples only.

## Existing gate and safety

`exchangeStatus` in `dist/exchange.js` sets its first completion value to `w.copied_state && w.copied_instructions`. `exchangeStepper` in `dist/app.js` makes a step available when it is done or is the first unfinished step. The summary and instructions copy dialogs set their corresponding flags only after copy success or the user's explicit fallback copy acknowledgment. These flags live in device preferences keyed by campaign and lineage, not in campaign state.

`previewUpdate` in `dist/updates.js` rejects a new update whose `base_revision` differs from `state.current_revision` before preparing operations. Exact message: “The DM used an older saved state. Send this refresh block back and request only the remaining pending changes.” The error has `code: 'STALE_REVISION'` and a current summary in `refresh`. The dialog adds explicit regeneration instructions. An identical previously applied update instead returns its historical receipt, intentionally supporting idempotent retries. `commit` in `dist/db.js` rechecks revision and lineage inside its transaction; mismatch is `STALE_COMMIT`, with nothing applied.

The new skip can alter only checklist availability. Import preview, validation, individual nonroutine approvals, final save authorization and atomic failure paths must remain identical. `review-policy.js` uses a positive routine allowlist; the skip will not change it.

A skipped fresh handoff means the DM may lack current context; it does not disable revision validation or calendar processing. A submitted day advance still uses the normal travel/interruption checks. Correction to the handoff document: the receipt includes day tokens, but has no separate unresolved-event-ID array. Unresolved IDs remain on Play and in the summary. Steps 3–4 still require returning the receipt and checking Day handoff. No date or timing predicate is needed.

Rejected imports do not call `importConfirmed` or write exchange preferences. Completed copy flags remain completed; an explicit skip will likewise persist. Neither rejection nor merely opening a preview completes step 2. Invalid batches save no campaign operations.

## Part C — report only

| Option | Schema/contract | Reference revision and exports | Approval boundary / risks |
| --- | --- | --- | --- |
| (a) List known attribute keys in the existing error | No schema or operation change | No revision bump or export changes | No new write capability; escape and bound potentially long labels/keys. It improves diagnosis but cannot create a key. |
| (b) Allow creation via `set_attribute` | Operation contract changes: currently only `op, character_id, key, value, note, reason` are accepted, and an existing key is required. Creation also needs a label. Existing attribute storage can represent it, but creation rules must be explicitly designed. | Increment `reference_revision` on an actual addition; existing summary/reference/snapshot projections would then include the added attribute. | Keep nonroutine individual approval. Implicit creation on a typo is a material risk; do not silently add it. Requires a separate decision. |
| (c) Add attribute form in Edit reference | Can append a key/label/value/note record through existing `set_character`, with no new operation or entity schema | Existing `set_character` detects reference changes and bumps `reference_revision`; existing exports include the record | Preserve the reviewed nonroutine path. Validate unique nonempty key and label, integer-or-text value, optional text note; do not infer numbers from modifier text. No implementation in this release. |

`attributes.js` currently validates an array of records with exactly `key, label, value, note`. Key and label are required nonempty text, keys are unique, value is a safe integer or text, and note is optional text. Text and collection limits remain enforced by the existing validator.

## Existing ability rename path

Edit reference exposes the full ability-slots JSON when slots are enabled. Changing an application's `name` while retaining its other keys preserves its `threshold_id` through the reviewed `set_character` replacement. This is not a dedicated rename operation: removing a field from the replacement JSON removes it. An in-development application requires a threshold ID, but this editor is not a referential-integrity-aware rename tool. Future name-addressed `set_ability_detail` operations must use the new name. No rename behavior changes in this release.

## Implementation decisions

Promote export to an always-visible Character reference card; keep Edit reference and Add character in a secondary disclosure. Notices target each changed character explicitly, including when the selected character is already current, so a button cannot accidentally export a different character.

Use an explicit device-only `skipped_handoff` boolean. Show Skipped until both actual copy acknowledgments exist. Preserve it across a confirmed import and same-revision reload; reset it with a new exchange or changed revision. Steps 2–4 remain unchanged. Include a skipped exchange in the existing Updates attention badge.

Keep `APP_VERSION` and package version at 0.6.2 to satisfy exact export-byte parity. Identify this release using a new build label, source commit and cache generation. No snapshot-viewer code changes.
