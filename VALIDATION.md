# Validation — Scroll M2 import loop

## Passed: 48 checks

- **32 native Node tests:** foundation regressions plus shared transport parsing, five allowed operations, per-operation reasons, atomic rejection, stable update IDs, semantic identity, conflicts, stale refresh, campaign/lineage guards, receipt preservation, deduplication across restore, receipt validation, M1-backup compatibility, protected-operation rejection, untrusted confirmation rejection, clipboard filtering and malformed-input handling.
- **7 real browser import-storage tests:** reject direct commit without review; trusted button confirmation commits atomically; authorization cannot replay; duplicate returns receipt without save; changed operations conflict; restore retains receipts; discarded-lineage clipboard input is ignored. Uses an isolated test database.
- **9 real browser foundation-storage regressions:** creation/duplicate rejection, atomic save, stale-preview abort, campaign isolation, preference isolation, history-preserving restore, old-lineage rejection and concurrent-save exclusion. Uses an isolated test database.

## Visible workflow checks

- Existing M1 campaign upgraded in place. Ghost remains at day 73, HP 45/45, Chakra 18/18, XP 1962, currency 4170, revision 1. No real campaign test awards were saved.
- Pasted resource delta showed before/after values. Canceled without saving.
- File-picker update reached the same review, including its operation reason. Canceled without saving.
- Stale paste displayed a ready-to-copy current summary and pending-state instructions. No manual revision editing was requested.
- Sage, shallow-ocean blue and cream palette inspected on desktop and a 390px phone viewport. Small-screen navigation intentionally scrolls horizontally; the page fits its viewport.
- Browser reported clipboard restrictions. Check clipboard, native paste and file alternatives remain available. Candidate validation is tested, but a successful system-clipboard focus offer could not be certified here. No claim of unrestricted iPhone background clipboard access is made.
- Read-only state tool remains available; no auto-write WebMCP tool is exposed.
- Stopped the local web server, reloaded Scroll, opened DM updates, and previewed a pasted delta successfully. New parser and policy modules are available offline. Canceled without saving.
- Public assets and service-worker dependencies resolve. JavaScript syntax, relative paths, icon sizes, baseline fidelity and system-agnostic public-source checks passed.

## Still requires the actual device or next milestone

- iPhone Safari Home Screen installation, system-clipboard permission/paste behavior, Files share sheet, eviction and large system text.
- GitHub Pages publication: destination repository not supplied.
- One real session through the M2 import loop before M3 dice/training and roll prefill.
- Dice integrity and event lifecycle tests belong to future milestones. Their absence is explicit in the app.

Run npm test or node tests/run.mjs. For browser checks, run node serve.mjs --test and open /__tests and /__import-tests. Normal preview and public deployment do not expose test pages. Browser tests use separate test-only databases.

## Level-up amendment validation

All 40 Node tests passed (32 prior + 8 level-up cases). The added cases cover atomic multi-field level-up, absolute-value schema validation, no implicit healing/clamping or XP change, explicit refill deltas, missing/unknown IDs, invalid bounds, optional literal notes, dirty reference markers, receipt/backup round-trip, idempotency and preserved protected-operation restrictions.

Browser verification: the updated offline build rendered a four-operation level-up preview (HP maximum, chakra maximum, level, DEX plus note), with current resources unchanged and the reference-export notice visible. Cancelled without saving; cleared the test draft. Local preview server restarted to deliver the updated offline assets.

## Consolidated build 0.3.0

- 53 Node tests passed: full-range token/cover generation, fixed cover positions, real and cover stops, partial time commits with held effects, retries, baseline progress, literal abilities, absolute reconciliation, backup round trips and display projections.
- 10 isolated browser storage/approval checks passed: no-review rejection, protected commit, safe projections, persistence, token stability, one-use review, stale writes and changed-preview rejection.
- Actual supplied campaign upgrade committed at day 73, revision 2; existing numbers unchanged. Ability statuses and details populated; hidden schedules frozen; trigger-chain record retained without a date.
- Narrow-screen Character rendering inspected at iPhone-width viewport; physical iPhone installation/offline verification is still pending.
- GitHub Pages workflow prepared. Live publication still awaits the repository URL.

Browser harness: run node serve.mjs --test, then open /__consolidated-tests. It uses a separate synthetic database and requires separate trusted clicks for review authorization.


- Travel preview inspected with a requested destination beyond the current day: no reached stop or newly due ID appeared before confirmation; cancelled without advancing the live campaign.
- Expanded ability detail inspected at 375px content width; document scrollWidth matched clientWidth.
- Final upgraded-backup download was requested, but this browser did not expose a download-completion event. The saved-file check remains unconfirmed; use Save backup before device transfer.

## Patch 0.3.1

The day-advance preview renders the current_day display once and omits its redundant scheduler projection. Stored diffs and audit entries are unchanged. Primary-campaign-conversation reminders are included in the DM agreement, confirmed-state handoff and resolution review. JavaScript syntax and package checks pass.


## Live deployment

Publish Scroll run 34815298150 attempt 2 succeeded. Verified https://lawdtsuku.github.io/scroll/ loads the campaign entry screen and transitions to Offline ready. No campaign was created or changed during this check. Physical iPhone installation, offline reopening and restored-campaign persistence remain pending.

## 0.3.2 refresh and visual refinement

Checkpoint: scroll-m2-consolidated-iphone-verified-2026-09-14.zip, SHA256 5C7F42536FF759C0BE2D3F49ADDDB43587060954063F33695EAC95F3527B6820. Prior build iPhone verification confirmed by user. This pass tested at browser viewport widths 375, 390 and 430: no horizontal page overflow; resources, quick entry and day advance precede inventory. Inspected expanded abilities and refresh modal at 390 pixels. Sampled ability/status/detail text contrast minimum 5.49:1; no textured ancestors for inspected text. Number surfaces are flat. Refresh Copy block includes regeneration instructions and current JSON, verified via clipboard. All 54 regression tests passed. No campaign data altered by UI checks (isolated synthetic campaign on port 4175). Physical iPhone verification of this refinement remains a user device check.

Final cache activation checked; Manage / export reference remains available below character details. Stopped the isolated test server and reloaded: cached app and synthetic saved campaign reopened successfully.

## 0.3.3 baseline import action

54 tests pass. Browser checked: no-file review disabled; invalid JSON shows safe error and retains retry; selecting a valid file enables explicit review; approval reason leads to final Confirm & save; synthetic campaign persisted after reload on isolated port 4176. Actual consolidated day-73 file reached approval and was cancelled without saving. Existing campaigns are rejected at review with restore guidance. Consolidated approval describes frozen scheduling accurately. No real campaign changed.

## 0.3.4 bundled DM kit
54 regression tests pass. Generic ZIP bundled and included in offline cache. Opening-screen download dialog verified after stopping isolated test server and reloading. Download action invoked; physical iPhone Files save remains device-specific. Buttons present on opening screen and DM updates; share option offered when supported. No campaign data in kit.

## 0.4.0 roster and trainer snapshots
61 automated tests pass, including scoped ownership, audit/idempotency, separate XP tables, snapshot allowlist and invalid-batch atomicity. Browser checks on isolated synthetic data at 390px: owner switching, active/boxed roster, reviewed HP adjustment, export dialog, snapshot replacement with older timestamp and no edit controls or horizontal overflow. Browser storage harness verified replacement persists, invalid snapshot retains previous, and campaign database remains byte-for-byte unchanged. Installed start URL redirects to viewer after snapshot import; saved viewer reloaded with server stopped. Physical iPhone file sharing/import and installed offline reopen remain a device check. No real campaign changed.

0.4.0 published as commit 04dcc922bed65181d85aa35df33d8ff967aef731; GitHub Pages run 35474392832 succeeded. Live snapshot.html verified with explicit read-only upload screen and Offline ready; no snapshot or campaign imported on production. Public checkout: 60 tests pass (private migration fixture excluded).

## 0.4.1 visual refinement
Checkpoint: outputs/checkpoints/scroll-0.4.0-before-visual-refinement.zip. All 61 regression tests passed. Isolated synthetic campaign reviewed at 375/390px; all six screens have no horizontal overflow. Desktop Play verified at 1280px. Mobile navigation remains available, returns to top on switching, and has reserved content/safe-area space. Play ordering verified: resources, quick entry, day advance, handoff, inventory, history, session. Current-above-max remains explicit. Number dialog has flat opaque background, separate current/maximum labels, readable controls and no horizontal overflow. Snapshot viewer verified at 430px with no edit actions, persistent saved data, collapsed/reopenable loader and flat number surfaces; sampled visible text contrast minimum 5.46:1. No production state changed. Physical iPhone verification remains a device check. Test server intentionally disabled service worker caching to prevent stale CSS during visual checks; production asset paths and cache list checked separately.

0.4.1 deployed as 5531a0fd83a8a9a7950bda808f6e004ba7e197d8; Publish Scroll run 35479324962 succeeded. Live snapshot viewer showed new loader disclosure and Offline ready after close/reopen activated the new cache. No production import or campaign mutation.

## 0.4.2 spacing follow-up
Archived 0.4.1 before changes. Reviewed supplied iPhone screenshots. Synthetic browser checks at 402px and 375px: reference reminder has separate heading/text/button rows; Character nav label no longer breaks mid-word; all six main screens fit without horizontal overflow; character tiles and ability content have distinct gaps. No production data changed. Presentation-only changes; physical iPhone confirmation remains with user.

## 0.5.0 roster upgrade
72 local automated tests pass. Browser checks on an isolated synthetic origin verified IndexedDB schema upgrade, frozen state/history preservation, preference retention, rollback of all campaigns on invalid migration, rejection of old-version writers, and snapshot-store migration without campaign writes. At a 375px viewport override (360px layout width with scrollbar), generic attribute tiles and indexed error/expected-shape text fit without horizontal overflow. Reviewed and saved a literal attribute plus XP threshold change; level remained unchanged. The actual DM copy dialog contains the complete new guide including its final section. Clipboard readback was unavailable in browser automation, so copy payload assembly is additionally covered by an exact-content automated test. No real campaign was edited; physical iPhone verification remains a user-device check.
