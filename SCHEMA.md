# Consolidated storage and operations

The dependency-free reducers in dist/core.js and dist/progress.js validate the campaign aggregate. IndexedDB saves each confirmed portion atomically with its transaction, journal, receipt and revision guard. Backups use scroll-backup version 3; versions 1 and 2 remain readable. State schema 1 retains legacy records, with validated scheduler and threshold extensions. Newer fields are not intended for old app builds.

## Calendar

Scheduler version 1 stores a full stream of 100,000 independently random 32-bit token values and 100,000 independent cover flags in the same generator call. Cover probability is approximately one-third per day; positions are frozen across the calendar, independent of jump length and visible token values. No sampling occurs during advance. The token is D + padded day + random value + CRC-16 typo checksum. The checksum detects transcription mistakes, not malicious tampering. Both new creation and legacy activation call createScheduler().

Only advance_day invokes due checks. Hidden dates are never projected into the UI, journal display, summaries or diagnostic objects. Generic safeDisplay also removes serialized operations_key values, which otherwise contain dates. Raw complete backups retain schedules for recovery.

New event IDs are UUIDs unrelated to schedule order. Window selection freezes first_day, last_day or unbiased random at import. Triggering is irreversible; date amendments retain revisions and original trigger data. Trigger-chained migration records store null dates and are flagged as unsupported, not assigned speculative dates. Deliveries and resolution are separate facts.

A destination advance stops at the first due event or pre-generated cover flag and persists a remainder containing only target_day. UI previews never display the planned reached day or newly triggered IDs. Post-commit state exposes current day, current token and unresolved IDs. Resume is a separate transaction.

## Import portions

See DM-UPDATE-GUIDE.md for fields. effective_day is optional operation metadata; for an interrupted trip, unspecified non-time effects are conservatively treated as destination effects. If any effect is beyond the reached day, all non-time effects are held. The original request is retained in request_operations for idempotency, while transaction.operations contains only the committed operations. The receipt lists only confirmed diffs, all crossed-day tokens and an interruption response when needed. Subsequent DM corrections require a new update_id. No dormant reward operation is automatically executed when the remainder resumes.

## Human-only boundary

Automatable vocabulary is a positive allowlist. Schedule changes, event resolution and DC revisions can enter the reviewed import path but always require the additional explicit protected-operation checkbox and trusted confirmation. A one-use process-local capability is bound to the exact prepared object. The storage writer also compares protected stored facts (schedule and resolution, DC revisions, pre-existing journal records) so a different operation name does not bypass the boundary. Restore requires protected review. Roll-log and journal-edit operations remain unsupported. This protects app paths, not against a device owner modifying JavaScript or IndexedDB.

## Character and thresholds

Applications accept name, explicit status, cost, range, effect, notes and optional threshold_id. set_ability_detail also accepts slot_index, optional slot_name and application_name. Unknown detail text is stored as "not yet quantified". in_development requires a threshold for the same character. Status does not change on threshold completion.

Threshold stages are ordered. Success totals and consecutive streaks are derived from approved baselines plus ordered external attempts. Unknown baselines stay unknown. Each attempt references a recorded dc_revision_id. It may only target the current incomplete stage; no dice or roll log is involved. Notes must accompany set_attribute. Reference revisions advance after literal reference changes.

## Sessions

An open session has notes and advance_submitted. Session close checks that flag, independent of opening/closing day equality. Notes are journaled. Since-last-session is derived from journal timestamps after the latest closed session.
