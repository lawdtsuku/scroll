# Owned roster and trainer snapshots — Scroll 0.4.0

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

Every roster member has `roster_id`, `owner_character_id`, `status` (active/boxed), `species`, `nickname` (may be empty), `level`, `xp_total`, `resources: [{id:"hp",current,max}]`, six `stats: [{key,label,value}]`, `moves`, `ability` (literal confirmed catch result), `bond` (named band), `held_item` (text or null), `status_condition` (null or `{name,duration_remaining,duration_unit}`). An unknown condition duration is null. There is no summon/Instance tier.

Each move has `move_id`, `name`, `type`, `category`, `power`, `accuracy`, `pp_current`, `pp_max`, `effect`. Power/accuracy may be numeric, literal rule text, or null for unquantified. PP must not be negative. Above-max HP/PP is displayed rather than silently clamped. A maximum change does not refill current values.

DM update operations all require `character_id` (the owner) and `reason`:

- `configure_roster(label)` — the display label is campaign-wide.
- `add_roster_member(member)` — supply the complete member and a unique roster_id; no duplicate adds.
- `set_roster_member(member)` — complete absolute replacement of that owned member; retain move IDs and all unchanged fields. Use for confirmed level, stats, ability, bond, held item, condition, maxima, move changes, or XP reconciliation.
- `set_roster_status(roster_id,status)`.
- `adjust_roster_hp(roster_id,delta)` — current HP only.
- `adjust_move_pp(roster_id,move_id,delta)` — current PP only.
- `award_roster_xp(roster_id,delta)` — no implicit level-up.
- `set_roster_level_threshold(level,cumulative_xp)` — shared roster curve only; number or "unknown".

These use the existing preview, revision, receipt and idempotency rules. Unknown fields and cross-owner writes fail closed. Event/DC/journal protections are unchanged. Inventory and held items are separate confirmed facts; editing a held item does not silently debit trainer inventory.

`scroll-trainer-snapshot`, version 1, is a separate format: `exported_at`, `owner_character_id`, `trainer`, `roster`, `inventory`. Each roster entry contains the owned member plus derived XP progress, not the campaign XP table. There is no campaign_id, lineage_id, base_revision, scheduler, day, journal, transaction, other trainer, or full campaign state. The app exports this format; the DM should not manufacture snapshots or put them through baseline import. Unsupported snapshot fields are rejected before replacement; invalid files leave the current snapshot untouched.
