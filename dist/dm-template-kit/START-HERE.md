# Scroll — give this kit to your game’s DM

Copy the message below into your primary campaign conversation, or attach this document and the two example JSON files. These templates work across game systems. The example numbers are fictional and must not be treated as your character’s state.

## Message to paste to your DM

I use Scroll to track confirmed campaign state. Follow this contract when making files for me:

1. First establish whether this is an EXISTING Scroll campaign, a genuinely NEW campaign, or a MOVE/RECOVERY of an existing campaign. Do not guess from a filename.
2. For an EXISTING campaign, ask me for “Copy state for DM” and “Copy DM instructions” from Scroll. For attributes and abilities, also ask for the Character reference export. Produce a `scroll-session-update` version 1 file. Copy campaign_id and lineage_id exactly; use the summary’s current_revision as base_revision. Use existing character/resource/attribute/threshold IDs exactly. Never invent missing identifiers or replace the saved campaign with a new baseline.
3. For MOVE/RECOVERY, tell me to use Scroll → Backups → Save JSON backup, then Restore on the destination device. Do not author a backup, reconstruct a token stream, turn a summary into a backup, or relabel an update as a baseline. Missing frozen state cannot be recovered by renaming fields.
4. Only for a genuinely NEW campaign, use the complete shape in NEW-CAMPAIGN.example.json. Campaign state belongs INSIDE `state`. Ask for missing confirmed numbers before making an import-ready file. This example intentionally omits the scheduler: Scroll generates its full token/cover stream when establishing the new campaign. This is never a way to preserve an existing schedule. Do not include resolved_events or scheduled_events at the top level. Do not silently discard existing training or event history; those require a separately reviewed migration.
5. Return a UTF-8 `.json` attachment containing one JSON object, with no comments, ellipses or explanatory prose inside it. A filename does not determine its type. Tell me which Scroll screen accepts it. Give explanations separately and never show hidden event dates in them.
6. Do not invent values, modifiers, ability status, dates or completion history. For ability details that are genuinely unpinned, use the literal text “not yet quantified.” Status is explicit: locked, trained_unquantified, or in_development. Development requires an existing linked threshold_id. A populated field does not establish status.
7. Every operation has a reason. Character operations include character_id. Use deltas for earned/spent amounts; use absolute operations only for explicitly confirmed reconciliation. A maximum increase does not heal the current resource. Include a separate adjust_resource operation when current HP/energy actually changes.
8. set_attribute requires the existing key, absolute value AND the literal updated note in the same operation. Do not infer modifiers from another game system. Unknown attribute keys must first be added through Scroll’s reference editor.
9. Retain all pending changes until Scroll returns an accepted receipt. If it says Refresh needed, regenerate only the still-pending changes using the NEW lineage_id/current_revision and a new update_id. Never tell me to edit IDs manually. An unchanged transmission retry keeps its original update_id; do not duplicate an accepted external attempt under a new ID.
10. Submit advance_day before narrating beyond the reached day. A jump may stop early and leave a remainder. Read the receipt; do not assume requested days or rewards committed. Add effective_day to day-scoped effects. Held effects need a revised update after token handling. Resolve scheduled events only in this primary campaign conversation.
11. DC revisions, event-date changes, and event resolution always require explicit human approval in Scroll. Do not bypass the preview/confirmation process. Journal edits and roll-log writes are unsupported. Rolls occur outside Scroll; log_threshold_attempt records a confirmed external success/failure with the existing dc_revision_id.

Before giving me a file, check its format, nesting, required IDs, version, numeric types and destination screen against the examples. If information is missing, ask for it rather than handing me an incomplete file labeled as import-ready.

## Which file goes where?

| Purpose | Format | Screen |
| --- | --- | --- |
| New starting state | scroll-foundation-baseline, version 1, full state object | Review opening baseline |
| Changes to a saved campaign | scroll-session-update, version 1, operations array | DM updates |
| Move/recover saved progress | scroll-backup, exported by Scroll | Backups → Restore |
| Tell the DM what is already saved | scroll-state-summary, exported by Scroll | Give to DM; not an import file |
| Attribute and ability reference | scroll-character-reference, exported by Scroll | Give to DM; not a baseline |

## Filling the new-campaign example

Replace the sample campaign ID everywhere it appears, and assign unique character IDs. Match each character’s resource IDs to the campaign resource definitions. Use the full existing state only if you actually have a complete validated migration; a summary is insufficient.

Replace display names, day, level, XP, currency, resources, attributes, inventory and ability slots with agreed values. `currency_amount` is a number on the character; currency label/ID belongs in state.currency. Attributes are an ARRAY of `{key,label,value,note}` objects, not a dictionary such as `{CHA:20}`. Applications are objects containing name/status/cost/range/effect/notes, not plain strings.

For a fresh baseline, current_revision and reference_revision are 0. journal, transactions, sessions and recovery are empty arrays. `pending_migration` is null. The baseline's lineage placeholder is replaced by Scroll during import. Do not place previous journal entries in these empty arrays to make a backup look like a new campaign.

Empty level_thresholds means no thresholds have been provided. Add only confirmed cumulative XP thresholds; use "unknown" where explicitly unknown. Do not extrapolate a level table. Set ability_slots_enabled false and remove ability_slots if the game does not use slots.

The simple fresh-start example has no training history or scheduled events. Do not use it to erase or approximate those records in an ongoing game. New event scheduling uses reviewed operations after creation; existing frozen schedules require the original full backup. Trigger-chained scheduling remains unsupported rather than receiving an invented date.

## Filling the update example

Every sample ID and base_revision must be replaced with the current app-provided values. Replace the sample operation with the actual pending changes; do not import the example directly. See OPERATION-REFERENCE.md for the supported operation fields.

For an existing game, export a full backup from the device holding the campaign before moving it. Give the DM current state and character reference exports to prepare remaining changes. A summary cannot recover a frozen calendar.
