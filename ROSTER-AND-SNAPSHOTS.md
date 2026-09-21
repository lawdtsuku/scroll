# Owned roster and trainer snapshots — Scroll 0.5.0

## Operator phone

1. Add both trainers as characters using Character → Manage / export reference → Add character.
2. Open Roster, select the owner, and add the trainer’s members. The selected trainer owns new members permanently; editing cannot silently transfer ownership.
3. In Roster settings, change the generic tab label (for example, Pokémon) and supply the confirmed cumulative XP curve. This curve is shared by all roster members and separate from trainer level_thresholds. No species growth rates or automatic leveling are inferred.
4. Active members appear in the main list; boxed members remain under a closed disclosure. Edit member details, add/edit moves, and adjust HP/PP. Every saved adjustment creates a revision and journal reason after review. Status durations are confirmed counters, not automatically decremented by days or sessions.
5. At a break, select the receiving trainer and choose **Export snapshot for [name]**. Download JSON or use Share / Save to Files. Send that file to the player through your chosen channel.

## Viewer phone

Open `snapshot.html` from Scroll’s **Open trainer snapshot viewer** link. Choose the operator’s JSON file and tap **Load snapshot**. Later imports simply replace the previous snapshot, including if a file has an older timestamp. The timestamp is displayed for context, not used as a conflict gate.

The viewer shows trainer stats and references, active/boxed roster, move PP, ability, bond band, held item, condition duration and inventory. There are no campaign edit, import-update, baseline, restore, journal, or export-back controls. The imported snapshot is stored in a separate database with a single current record. Loading a snapshot does not create or change a campaign. After an import, the normal home URL on that browser installation opens the viewer too. Safari and a Home Screen installation can have different stores: load the snapshot in the installation you intend to use.

Open online once until Offline ready. The saved snapshot then works offline. Files are replaced manually; there is no synchronization or write-back. This is a read-only app workflow, not encryption or protection against someone modifying their own downloaded file.

## File and operation contract

Campaign fields are optional for older campaigns: `roster_config: {label}`, `roster_level_thresholds: {"2": 50}`, `roster: []`.

Every roster member has `roster_id`, `owner_character_id`, `status` (active/boxed), `species`, `nickname` (may be empty), `level`, `xp_total`, `resources: [{id:"hp",current,max}]`, six `stats: [{key,label,value}]`, `moves`, `ability` (literal confirmed catch result), `bond` (named band), `held_item` (text or null), `status_condition` (null or `{name,duration_remaining,duration_unit}`), and `attributes: []`. An unknown condition duration is null. There is no summon/Instance tier.

Attributes use the same validator as character attributes: `{key, label, value, note?}`. Keys are unique; key and label are nonempty text; value is text or a safe whole number (including negative numbers); note is optional text. Text and lists are limited to 100,000 characters/entries by the shared validator; transport file-size limits also apply. Empty value/note text is accepted. Unknown keys are rejected. For example, a confirmed attribute may be `{key:"gender",label:"Gender",value:"Female"}`. Scroll never infers this value from species or nickname. Use a complete `set_roster_member` to edit attributes, preserving every other field. The member editor and trainer snapshot viewer display the stored labels, values and notes.

Each move has `move_id`, `name`, `type`, `category`, `power`, `accuracy`, `pp_current`, `pp_max`, `effect`. Power/accuracy may be numeric, literal rule text, or null for unquantified. PP must not be negative. Above-max HP/PP is displayed rather than silently clamped. A maximum change does not refill current values.

DM update operations all require `character_id` (the owner) and `reason`:

- `configure_roster(label)` — the display label is campaign-wide.
- `add_roster_member(member)` — supply the complete member and a unique roster_id; no duplicate adds.
- `set_roster_member(member)` — complete absolute replacement of that owned member; retain move IDs and all unchanged fields. Use for confirmed level, stats, ability, bond, held item, condition, maxima, move changes, or XP reconciliation.
- `set_roster_field(roster_id,field,value)` — change exactly one of nickname, species, ability, bond or held_item. Value is text; nickname may be empty, and held_item also accepts null. Bond must remain a named band, not a numeric score. Ownership, status and nested fields cannot be patched here.
- `add_roster_move(roster_id,move)` — append one complete move object using all nine fields above. Its move_id must be new on that member. It never replaces an existing move; editing or removing a move uses complete `set_roster_member`.
- `set_roster_status(roster_id,status)`.
- `adjust_roster_hp(roster_id,delta)` — current HP only.
- `adjust_move_pp(roster_id,move_id,delta)` — current PP only.
- `award_roster_xp(roster_id,delta)` — no implicit level-up.
- `set_roster_level_threshold(level,cumulative_xp)` — shared roster curve only; number or "unknown".

These use the existing preview, revision, receipt and idempotency rules. Unknown fields and cross-owner writes fail closed. Event/DC/journal protections are unchanged. Inventory and held items are separate confirmed facts; editing a held item does not silently debit trainer inventory.

Every operation above includes `op`, `character_id` and `reason` in addition to its listed parameters. An update may also include `effective_day` on an operation to scope it to a traveled day. Validation failures identify the zero-based operation index and attach the expected parameter shape. Roster field validation also names the field path, for example `operations[5] (set_roster_member): member.nickname: is required.` A failed batch does not partially apply earlier operations. Correct the identified operation and resubmit against the current exported state; do not bypass revision or confirmation checks.

When a member reaches its known next XP threshold, both operator and viewer show **Next level threshold reached. Review with your DM.** No level, stats, current resource or resource maximum changes automatically. Unknown/undefined thresholds remain unknown/undefined.

`scroll-trainer-snapshot`, version 2, is a separate format: `exported_at`, `owner_character_id`, `trainer`, `roster`, `inventory`. Each roster entry contains the owned member (including attributes) plus derived XP progress, not the campaign XP table. There is no campaign_id, lineage_id, base_revision, scheduler, day, journal, transaction, other trainer, or full campaign state. The app exports this format; the DM should not manufacture snapshots or put them through baseline import. Unsupported snapshot fields are rejected before replacement; invalid files leave the current snapshot untouched.

## Existing saves and offline handoff

Campaign schema 2 requires attributes on each roster member. Opening existing campaign storage upgrades schema 1 records atomically and adds `attributes: []` only where missing. Existing attribute values are preserved. This does not alter lineage, revision, journal, transactions, pending migration notes, or frozen scheduler data. It does not invent campaign facts. If validation fails, the storage transaction aborts without partially upgrading campaigns. Older schema-1 opening baselines and backups are migrated through the same state migration before use. New backups use backup version 5; versions 1–4 remain readable. The opening-baseline envelope format is unchanged.

Version-1 trainer snapshots are migrated separately to version 2 with missing attributes backfilled. This never touches campaign storage or creates a campaign of record.

The full contents of this guide are bundled into **Copy DM instructions**, alongside the update agreement, update template and current confirmed state. They are part of the offline app; no remote document fetch is required.

## 0.5.1 review and display settings
Manual routine HP, PP, status, currency and inventory edits accumulate in a pending batch; review and confirm the batch once to save. Pending edits are not saved until confirmed. Protected operations each require their own approval, followed by one atomic save; no group approval substitutes for those approvals.

`configure_roster` accepts optional boolean `hide_owner_stats`. Missing or false means show owner stats for every campaign. True hides owner resources, level, XP, attributes and abilities in Play, Character and the snapshot viewer. Character validation, stored fields and all DM operations remain unchanged; names, currency, inventory and roster remain visible. The separate `ability_slots_enabled` flag is unchanged. No campaign is selected automatically by genre or name.

Snapshot version 3 includes `roster_label` (nonempty string) and `hide_owner_stats` (boolean), while retaining all required trainer fields. Versions 1 and 2 remain readable and default to Roster and false. The viewer uses the exported label. Re-export snapshots to carry new display settings to a second device. `species` remains generic free-form text.
