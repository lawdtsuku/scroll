# Current DM update protocol

SCROLL — CONSOLIDATED BUILD
Resolve scheduled events in your primary campaign conversation, not a side conversation.

Roll externally. DC-before-roll evidence lives in the ordered chat transcript. Scroll never rolls dice or writes a roll log.
Keep all pending changes until an accepted receipt. Return strict scroll-session-update JSON with unique update_id and the latest campaign_id, lineage_id, base_revision. On stale state, use the copyable refresh; never ask the player to hand-edit IDs.
Every operation needs a reason. Character operations need character_id.
Automatable vocabulary (current transport still previews and confirms):
adjust_resource(resource,delta), award_xp(delta), adjust_currency(delta), adjust_inventory(item,delta,consumable for new items), advance_day(to_day).
set_resource_max(resource,value): absolute; does not change current.
set_level(value), set_xp(value), set_currency(value): absolute.
set_attribute(key,value,note): note REQUIRED, including an explicit empty string if intended. No calculated modifiers.
set_level_threshold(level,cumulative_xp): absolute cumulative XP or "unknown". Undefined future levels stay undefined until provided.
set_ability_detail(slot_index,application_name,status,cost?,range?,effect?,notes?,slot_name?,threshold_id?): status MUST be locked | trained_unquantified | in_development. Development requires linked threshold_id. Explicit unpinned fields are "not yet quantified". Can fill existing open slots.
log_threshold_attempt(threshold_id,stage_index,result,dc_revision_id): success or failure from an external roll; exact recorded DC revision, current stage only. Retry the same update_id; never duplicate the same attempt under a new ID.
Protected, explicit extra human approval on each batch: schedule_event(visibility,eligible_from_day,must_fire_by_day,selection_rule; optional import_historical), amend_event_date(event_id plus full schedule), resolve_event(event_id), set_threshold_dc(threshold_id,stage_index,dc). Hidden events use neutral reasons only: created, imported, date_amended, resolved. No hidden narrative. Random event IDs are assigned by Scroll. Dates live in campaign storage and backups, never in app displays.
The day is the only event trigger. Send advance_day before narrating past it. Every day has one pre-generated token with a typo checksum. The player sends Scroll’s current token to the DM in the state handoff. Do not put day_token inside an advance_day operation. Triggered event IDs persist until explicitly resolved. Event IDs have no ordering meaning.
Multi-day travel commits to the first due or pre-generated cover stop. Cover stops are independently fixed across the whole calendar at creation (~1/3 of days); they camouflage timing but do not guarantee statistical indistinguishability. No stop date is previewed. A pending remainder can be resumed with one tap. Add effective_day to day-scoped operations. If a stop precedes any operation’s effective_day, or effects are unscoped, time commits alone and ALL non-time effects remain pending. The interruption receipt names the day reached. Revise the non-time effects under a new update_id. Original retries return the same receipt and never replay time. Explicit skip_through:true requires extra human approval.
The receipt includes every crossed day's token and every unresolved opaque ID in current state. Attribute/ability changes require refreshed reference export. In-development progress never silently changes an ability's explicit status.
No journal edits or roll-log writes are accepted.

## Envelope

Use **Copy DM instructions** in the app to get identifiers and the current revision automatically. Never hand-edit a stale block.

```json
{
  "format": "scroll-session-update",
  "version": 1,
  "campaign_id": "FROM-APP",
  "lineage_id": "FROM-APP",
  "update_id": "UNIQUE-EXCHANGE-ID",
  "base_revision": 1,
  "operations": [
    {
      "op": "set_attribute",
      "character_id": "FROM-APP",
      "key": "existing-key",
      "value": 18,
      "note": "+4",
      "reason": "Confirmed improvement"
    },
    {
      "op": "set_resource_max",
      "character_id": "FROM-APP",
      "resource": "existing-resource",
      "value": 51,
      "reason": "Confirmed maximum"
    }
  ]
}
```

## Notes on travel receipts

An interrupted receipt confirms only time and names the day actually reached. Non-time operations were rejected for that committed portion; retain them and submit a corrected batch under a new update ID. Resume only after handling the token. Unchanged retries use the original ID and return the original receipt. Never retry the same externally rolled threshold attempt under a new ID.

## Reconciliation

Use set_xp and set_currency for absolute corrections. Level thresholds remain unknown or undefined until explicitly supplied; the app never extrapolates them. A maximum change never heals or clamps current resources. Ability status is never inferred from populated or unpopulated fields.

## Roster and snapshots

Owned roster (generic, trainer-scoped): configure_roster(label); add_roster_member(member); set_roster_member(member); set_roster_status(roster_id,status); adjust_roster_hp(roster_id,delta); adjust_move_pp(roster_id,move_id,delta); award_roster_xp(roster_id,delta); set_roster_level_threshold(level,cumulative_xp). All need character_id and reason. The owner must match owner_character_id; ownership cannot be changed by an edit. Members contain roster_id,owner_character_id,status,species,nickname,level,xp_total,resources:[{id:"hp",current,max}], six stats:[{key,label,value}], moves:[{move_id,name,type,category,power,accuracy,pp_current,pp_max,effect}], ability,bond (named band),held_item (text/null),status_condition (null or {name,duration_remaining,duration_unit}). Preserve unchanged fields and stable IDs in complete member replacements. Roster XP thresholds are separate from trainer thresholds. No automatic level-up, ability roll, duration tick or held-item inventory transfer. For details use ROSTER-AND-SNAPSHOTS.md in the template kit.
Trainer snapshots are exported by Scroll for one owner and loaded in its separate read-only viewer. They are not baselines, backups or DM updates. Never attach campaign history, other owners or hidden schedule data to a snapshot.

## Roster additions in 0.5.0
See the bundled ROSTER-AND-SNAPSHOTS.md for the complete roster contract. Every complete member now includes `attributes: [{key,label,value,note?}]` (empty list allowed). `set_roster_field` requires character_id, reason, roster_id, field and value; field is nickname/species/ability/bond/held_item only. `add_roster_move` requires character_id, reason, roster_id and one complete move with a new move_id. Neither operation replaces unrelated member fields.
