# Next-release v5 assessment — 2026-10-25

Generic source assessment only. No campaign data, connector implementation, template-kit refresh, schema changes, or new operations.

## Baseline and scope corrections

The GitHub main head and local baseline are `651a656d4d783044e3654ab1fca67aba163f6e7f`: APP_VERSION 0.6.2, BUILD_LABEL “Scroll 0.6.2 · reference-import-1”. A (visible reference card/notices) and B (explicit device-only skip) exist in app.js/exchange.js and remain unchanged. D was absent: `.mono` is .875rem, and compact selects have smaller rules.

E and G shipped on 2026-10-05 in `2139d3a60d71db88b382cd718c5dd5ce8fbfc60b`. `core.js::summary` and `updates.js::previewUpdate` emit APP_VERSION on summaries and new receipts. That release changed their hashes by adding app_version; existing stored receipts were not rewritten. Character-reference and snapshot outputs were unchanged. The October 11 release retained APP_VERSION and proved exact parity. This release also retains it.

The assertion that the worker has no skipWaiting is outdated. `sw.js` calls it only after an explicit activation message from the sole scoped window; `update-ready.js` requires a trusted click, rechecks blocking flags and freezes controls. The persistent panel already says “Update now will reload Scroll with the new build after your edits are saved or discarded.” App integration blocks open dialogs, dirty forms/drafts, routine batches, reads and saves. Snapshot integration blocks pending files/saves. An unrelated controller change never automatically reloads a page. These runtime files/handlers are unchanged. See UPDATE-READY-DESIGN.md and the labeled prior real-worker test evidence. G is not a new feature in this release.

H already has a detailed report in SNAPSHOT-THRESHOLDS-REPORT.md, not an implementation. Its findings still match the current source.

## D — implemented scope and verification boundary

The CSS-only commit applies a 16px minimum to input/select/textarea at <=720px or a coarse pointer, preserving inherited larger text and the monospace family. Explicit cascade priority prevents compact component rules from overriding the floor. Viewport meta is unchanged; no zoom restrictions are added. Dialog text wraps and controls stay within their container. This also addresses an existing overflowing JSON example in the reference editor at 375px, found during before/after testing.

Status remains **built, not device-verified**. Desktop browser emulation can prove computed fonts, layout and unchanged viewport configuration, but cannot reproduce or certify iOS focus-zoom. Mitchell must test the installed iPhone app after it loads this build.

## H — snapshot thresholds, report only

Current v3 snapshots include owner level/XP but no owner level table or training thresholds; ability projection drops threshold_id. Roster members already have their separate computed XP progress. The viewer calls vitalsView without an owner level table and abilitiesView without training data.

A future minimal snapshot extension needs owner next-boundary status (known/unknown/undefined), owned training IDs/labels and computed stage counts/streaks/requirements/current DC/completion, plus ability threshold linkage. Do not copy raw attempts, DC history, scheduler dates or another owner's records. Exact-key validation means new fields need a versioned format (e.g. v4), backward reading of v1–v3 without invented progress, and changes to snapshot.js, snapshot-app.js and a display adapter in character-display.js. Only the snapshot export needs to change; state/reference/receipt need not. No reference_revision bump: this is an export projection. The viewer stays read-only and obeys hide_owner_stats. All snapshot-using campaigns could benefit; only those with owner stats visible would render owner thresholds. No implementation here.

## C / 7a — adding attributes

Current `set_attribute` finds an existing key, throws on an unknown one, and updates value/note. The whole imported batch rejects atomically. Reference editing parses three JSON fields directly; parse failures expose the browser's JSON.parse message, without consistently identifying which field failed.

| Option | Schema / vocabulary | reference_revision | Four exports | Human/protected boundary and affected campaigns |
| --- | --- | --- | --- | --- |
| (a) List valid keys in unknown-key error | None | No change | All identical | Diagnostic only; do not create keys or infer intended spellings. Escape/bound long key lists. Helps every campaign with attributes, including DM imports; no new write capability. |
| (b) Add missing-key creation to set_attribute | Explicit contract change; current accepted fields have no label, while stored attributes require a label. Define creation separately from typo correction. | Bump once for an actual addition; preserve no-op semantics | Summary/reference/snapshot contain added data through existing projections; receipt contains the actual change. Format/version decisions need review. | Keep nonroutine individual approval. Never infer permission from transport/JSON flags. All import users potentially affected; opt-in or explicit create intent avoids silently creating typo keys. |
| (c) Structured Add attribute and named JSON parse errors in editor | No operation/entity-schema change needed: collect unique key, label, integer-or-text value, optional note and use existing set_character. Name Attributes/Profile details/Ability slots in parser errors. | Existing set_character comparison increments on an actual reference change | Same existing formats; changed records naturally appear in exports and approved change receipts | Human-only entry through current preview and individual approval. No auto-parsing modifiers. Helps all campaigns; preserve full existing records when appending. |

Options (a)/(c) do not grant a DM a new operation; (b) does. All remain report-only.

## 7b — remove, rename, clear or reopen abilities

`progress.js::set_ability_detail` locates an existing slot by index and an application by exact name. A new name appends; it is not a rename. It increments reference_revision on every accepted operation. Switching away from in_development explicitly deletes threshold_id. A slots JSON edit through set_character can already rename an application while retaining threshold_id, remove an application, or clear applications to [] and name to null. Retaining the key is the operator's responsibility; it is a full replacement, not a linkage-aware rename UI.

A human-only structured editor could perform those actions through the existing reviewed set_character contract without new entity fields. Explicit import operations would need new vocabulary/exact validators/ownership checks/error shapes and collision rules. Names are not currently validated unique within a slot, so a future rename must decide how to reject ambiguous targets; do not silently pick the first duplicate.

Rename should preserve the existing threshold link unless separately changed. Removing an application or clearing a slot should not delete its threshold, attempts, DC revisions or journal. Current threshold rendering puts unlinked thresholds in Other training. Training truth needs its own explicit handling, not cascading deletion. Actual reference changes should bump reference_revision once. No-op policy should be explicit.

Reference and snapshot exports reflect the changed abilities in their existing structures; a summary currently omits slots, so its reference data would not reveal the edit (its revision still changes); receipts reflect the approved reference operation where supported. New DM operations require policy/review coverage: recommend individual nonroutine human confirmation because they change reference truth. They must never gain permission to erase training/audit history. Applies to all slot-enabled campaigns, including owner-hidden campaigns whose stored references still exist. No implementation.

## 7c — fully specified trained status

Source already permits `locked` with populated fields, but displays “✓ Locked”; it does not mean “unavailable” in code, and no behavior is inferred from filled fields. `trained_unquantified` always displays “≈ Trained · not yet quantified”, even if fields happen to be populated. No automatic status migration is justified.

A display-only relabel of locked to a clearly agreed meaning such as “Pinned / confirmed” needs no schema, reference_revision or export change, but affects the interpretation of that status in every campaign and both screens using the renderer. Relabeling trained_unquantified as fully specified would misrepresent unpinned entries. Mitchell must establish semantics first.

A new enum value changes application validators in core.js, progress.js and snapshot.js, rendering and docs/tests. Old consumers would reject it; snapshot and campaign compatibility/versioning or explicit down-conversion must be decided. Explicitly changing a record's status changes reference_revision via the normal path; a label-only render change does not. Reference/snapshot carry the new string, update receipts can carry it, summary currently does not carry abilities. Keep status changes individually reviewed as today, without automatic inference from cost/effect text. All slot-enabled campaigns/old readers can be affected. Report only.

## 7d — summary omission of slots

Confirmed: `core.js::summary` projects character identity, level/XP, resources, currency, inventory and attributes, but neither ability_slots nor ability_slots_enabled. The absence therefore does not mean “no slots”. Character reference is the existing authoritative ability export; snapshots include an owner ability projection.

Smallest additive option: a campaign ability_slots_enabled boolean plus per-character recorded slot/application counts and an explicit “details in character reference” scope. This is day-independent and O(characters); it distinguishes disabled from enabled-but-empty. Slot indices/names/application names are more useful but grow with ability content. A boolean/count-only marker cannot teach a DM the effects of an ability.

Adding a marker changes only summary projection/consumer docs/tests, not entity schema, reference_revision, receipts/reference/snapshot or approvals. Documentation-only wording can instead explain the omission without changing any of the four exports; do not change the summary's scope text if exact byte parity is required. Affects all summary consumers, including disabled/owner-hidden campaigns. No implementation; F stays held.

## 7e — known but not slotted convention

With slots enabled, the validator permits a named slot with a positive unique index and an applications list; there is no hard-coded four-slot capacity or loadout exclusivity rule. A designated “known techniques” slot is therefore representable today, using the normal statuses and fields. It remains an ordinary slot in rendering and exports; Scroll would not enforce “inactive”, prevent use, or exclude it from counts. A human can move/remove entries through the full reference editor; set_ability_detail cannot remove them. It is not workable as a managed DM-only move workflow until a removal route is chosen. Duplicate names across slots are possible.

Convention adds no schema or vocabulary. Real edits increment reference_revision and appear in reference/snapshot, with normal review; summary omission remains. Applies only to campaigns explicitly adopting it. A real feature would need Mitchell's decision, campaign-level opt-in/default off and a separate design. No feature design or build here.

## S1 — scheduled-event visibility and information leakage

| Export | What it currently reveals |
| --- | --- |
| State summary | Current and last-advance tokens, triggered unresolved IDs/state only, chain_records_pending for scheduled trigger-chain records, pending remainder. No ordinary future-event count, labels or dates. A token can establish that a scheduler exists, not that an event is scheduled. |
| Update receipt | Post-update chain count, crossed-day tokens, confirmed changes and interruption. event_id_mapping includes every stored alias-to-ID pair (including migration aliases), so some receipts can reveal that records exist; it is not a complete ordinary scheduled-event inventory. No standalone unresolved_events array. |
| Character reference | No scheduler data. |
| Trainer snapshot | No scheduler data. |

Full downloadable backups are different: they intentionally contain complete private state, including the frozen schedule. They must not be repurposed as a DM relay or shown as on-screen diagnostics. The premise “no export reveals anything” is too broad; chain counts, alias mappings and full backups are exceptions, but none is a reliable ordinary-event completeness check.

Computing `events.filter(e=>e.state==='scheduled').length` needs no date comparison, but **its output is not temporally independent**: advancing through a real due event changes scheduled to triggered and decreases it. Comparing counts before/after a stop distinguishes that real stop from an empty cover stop. A boolean “has scheduled events” leaks when the last event triggers. Omitting an explicit day field does not prevent correlation because the surrounding summary/receipt and conversation carry the current day.

Consequently no truthful live remaining-scheduled count satisfies the requested no-correlation guarantee. Do not add one. The smallest safer alternative to consider is a separately confirmed setup statement (“schedule setup reviewed”, including an explicit intentional-empty decision) that does not recompute on day advance; it is an acknowledgment, not a live count, and can become outdated. It would require its own stored meaning/lifecycle and Mitchell's approval. A lifetime total could stay stable on triggering but still reveals schedule changes and does not answer what remains. Neither alternative is built.

Entity/reference_revision: current projections need no mutation for a count, but the acknowledgment alternative would need a data contract. Summary/receipt would change if extended; reference/snapshot should remain identical. Approval independence and hidden-date ban must hold in every campaign. Existing chain counts and migration aliases are established exceptions, not a justification for a new timing side channel.

## R1 — measured export growth

`scripts/export-growth-audit.mjs` produces `export-growth.json` using validated synthetic states and the actual exporters. Measurements use pretty-printed UTF-8 bytes; ASCII fixture character counts happen to match bytes, but Unicode production content need not. These are scenarios, not predictions or bounds.

Fixture: 20 inventory entries and four populated applications per owner; six attributes; one training threshold per owner with two failed attempts per day; one uninterrupted advance with cover disabled only in the synthetic fixture to isolate worst-case span size. No roster/events/session notes. The production generator is unchanged.

| Days N | Owners M | Summary bytes | Receipt bytes | Reference / one owner | Snapshot / one owner |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 1 | 10,419 | 937 | 5,248 | 9,300 |
| 10 | 2 | 19,689 | 937 | 5,248 | 9,300 |
| 100 | 2 | 83,792 | 3,280 | 5,248 | 9,300 |
| 100 | 10 | 405,000 | 3,281 | 5,248 | 9,300 |
| 1,000 | 2 | 728,398 | 26,685 | 5,248 | 9,300 |
| 1,000 | 10 | 3,534,414 | 26,686 | 5,248 | 9,300 |

The main growth here is **raw threshold attempt history in the summary**, not journals. Reference and snapshot stay fixed because this fixture does not add content over time. An otherwise minimal owner and no training history produce summaries of 1,330 / 3,906 / 27,310 / 270,314 bytes for last-advance spans of 1 / 100 / 1,000 / 10,000 days. Corresponding receipts are 682 / 3,262 / 26,667 / 269,672 bytes. Ordinary short advances do not accumulate every past token in the summary: only the most recent advance span is exported. A high current day alone is not proportional to export size.

| Export | Growing fields and scaling |
| --- | --- |
| Summary | All characters' attributes/inventory/resources and all roster content; level tables; all thresholds including attempts and DC histories; unresolved IDs; open-session notes; last_advance_tokens O(last span), not O(lifetime days). No journal/transactions arrays. Training history can grow with N×M; completed thresholds remain present. |
| Receipt | day_tokens O(committed span); confirmed_changes O(batch fields and before/after values), which can include large list/reference/training diffs; alias mapping O(migrated aliases), not only this batch. Historical receipts do not grow later, but backups retain all of them. |
| Reference | One owner's full attributes/profile/details/player note and slot/application text. Content growth, not automatic per-day growth. Slot text can be large even for one owner. No inventory, journal, tokens or raw thresholds. |
| Snapshot | One owner's attributes/abilities/inventory and active+boxed roster with stats/moves/notes and computed roster progress. No raw training/history/tokens. Grows with owned content, not other owners. Reader has a 5 MB input limit and list limits; reference has no equivalent export-size ceiling. |
| Backup (context, not relay) | Full state, pre-generated ~900,000-character stream+cover, opening-state history, journals/transactions/receipts and old values. Large from creation and grows with activity. Never use as a trimmed live relay response. |

For a future separate bounded relay projection, the useful reducible data are superseded/raw attempt and DC history (replace with exact computed current stage successes/streak/baseline status/required count/current DC revision ID), old token spans (explicit paged range/count plus current token and interruption), and long optional prose (explicitly omitted/paged, never silently clipped). Do not truncate the live exports or remove history from stored state. Completed training may be paged, but cannot silently disappear as if absent. Token pagination must remain available for DM adjudication and cannot drop unresolved IDs or pretend an incomplete handoff is complete.

Never silently trim character/owner/roster membership, inventory entries or quantities, current numeric state, attributes, explicit ability statuses, revision/lineage/campaign identity, update IDs, pending-versus-saved status, approval requirements, unresolved IDs, or critical stage/DC identifiers. Do not leave inventory_complete:true on a partial inventory. If required current data exceeds the budget, return a structured oversized/incomplete result with character-scoped pagination or references, and prohibit treating it as the full state. Explicit truncation metadata does not make omitted inventory safe to assume empty.

A 50,000-byte target needs a budget over the final serialized response including envelope and metadata, plus a separate character/code-unit budget for the observed tool limit. Compact JSON reduces formatting overhead but cannot bound unbounded content. The reported ~100,000-character tool limit is the user's observed constraint, not a universal provider guarantee. None of these relay projections, fields or tools is implemented here.

## Device-only and cosmetic checks

- Notch safe area: env(safe-area-inset-*) rules exist; desktop tests cannot verify nonzero physical insets or installed-app status-bar behavior.
- Offline: prior real Chrome offline reload passed. Prior automated WebKit offline reload produced an internal error. This is a limitation, not a pass; physical installed-app cache behavior remains unverified.
- Long roster label: current mobile CSS deliberately uses one-line ellipsis, while the button title and full page heading retain the name. Emulation can verify fit/text; actual perceived truncation on Mitchell's phone is unverified. No label changes here.
- Viewer mismatch: exact-version validation still emits a generic “Choose a Scroll trainer snapshot, not a baseline, update or backup.” for an unsupported version without extra keys. A newer payload with unknown keys can instead fail the initial exact-key check first. Neither consistently says “update this viewer”; no error-copy changes here.
- The lighter step-2 rectangle is the existing nested update-import background. The 320px roster button geometry is captured for assessment. These are report-only cosmetic items; no unrequested styling changes.

F remains held; the final replacement documents/examples were not supplied. The connector remains out of scope. All existing approval and spoiler rules remain in force.
