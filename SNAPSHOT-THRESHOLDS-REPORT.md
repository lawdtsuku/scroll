# Snapshot thresholds — H, report only

Current snapshot format remains `scroll-trainer-snapshot`, version 3. No snapshot validator, exporter, migration, store or threshold rendering change is implemented for H.

## Exact gaps in current source

`dist/snapshot.js::exportSnapshot` exports trainer level/xp_total, labeled resources, attributes, ability applications, currency, inventory and owned roster members. Each roster member already has a computed `progress` object with `next_level_xp`, `remaining` and `status` (`known | unknown | undefined`). This roster progress is separate from owner-character progress.

Owner training thresholds and owner `level_thresholds` are absent. Ability applications are projected to exactly name/status/cost/range/effect/notes; their optional source `threshold_id` link is dropped. The validator uses exact key lists, so simply appending fields to a v3 file would be rejected.

`dist/snapshot-app.js::render` currently calls `vitalsView(c)` without a level table and `abilitiesView(c.ability_slots)` without thresholds. It does not call `thresholdsView`. Thus owner next-XP is unknown in this view even when the operator knows it, and an in-development ability cannot show linked training progress. `hide_owner_stats` already gates the owner stat/ability display; any future threshold display must obey that same setting.

## Fields a display-only extension would need

- Owner XP: a per-owner projection of the immediate next level boundary, preserving the distinction between a known cumulative XP number, explicitly `unknown`, and absent/undefined. A computed object like the existing roster `progress` avoids exporting a campaign-wide table. Alternatively, passing a table to the current vitals renderer would expose campaign-level reference data and broaden the originally owner-only snapshot scope.
- Training: only records belonging to `owner_character_id`, with stable threshold ID, visible label, overall completion, current stage index, and per-stage required count, whether consecutive successes are required, current successes/streak, completion, and the currently displayed DC (or explicit unknown). Compute these on export using the existing `thresholdProgress`/stage logic so baseline counts and superseded attempts are handled exactly as in the operator view. Snapshot readers need no roll-attempt history, journal, date fields or DC revision history to display this information.
- Linkage: retain an optional `threshold_id` on each applicable ability application, resolving only against that owner's projected thresholds. Preserve explicit ability status independently of completion.

A full raw threshold record is **not** needed: it would bring completed_on_day and dc_revisions.set_on_day plus attempt/history identifiers into a disposable viewing file. A minimal display projection respects the owner-only/no-history boundary and avoids new date-display paths.

## Format and files that would change if later approved

Use a new snapshot version (for example v4), because existing v3 readers reject extra keys. New fields should distinguish “not included by this old snapshot” from an authoritative empty training list. New readers should continue accepting v1–v3; migration must not invent training progress or known XP boundaries.

- `dist/snapshot.js`: versioned exact key validation, owner-filtered progress projection, optional ability linkage, old-version migration/default handling.
- `dist/snapshot-app.js`: pass projected progress into the owner display and render training read-only under the existing hide-owner-stats gate.
- `dist/character-display.js`: a display adapter for projected progress; existing training rendering currently expects raw stages with baselines, attempts and DC revisions, so it cannot consume the minimal projection unchanged.
- Snapshot tests, browser tests, snapshot documentation and version/cache release metadata. `snapshot-store.js` already calls migrateSnapshot, so its schema/store need not change unless that API changes.
- Changed exported artifact: the per-trainer snapshot JSON only. Campaign state summary, import receipt, reference export, DM update operations, baseline and backup schemas do not need changes for this display-only projection.

Before implementation, choose minimal computed display data versus a larger raw-reference export. This report recommends the former but implements neither.
