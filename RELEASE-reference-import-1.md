# Scroll 0.6.2 · reference-import-1

The Character reference export is now an always-visible card action. Both reference reminders include an export button for each named pending character; Edit reference and Add character remain under a secondary disclosure.

Step 1 of DM updates offers “Same-day update? Skip to import.” An explicit device preference unlocks step 2 and labels step 1 Skipped without falsely recording either copy action. Returning the receipt and checking Day handoff still follow the normal ordered flow. Starting a new exchange resets the skip. Full copy-both handoffs remain supported.

APP_VERSION remains 0.6.2 to keep all four export formats byte-identical. The build label and cache generation (v22) distinguish this release. No campaign schema, operation contract, migration, token generation, protected approval or snapshot-viewer changes.

## Verification

- Part A: 96 local tests passed. Final: 98 local tests passed; one campaign-specific legacy fixture is excluded from the public repository.
- 16 exact before/after comparisons across summary, receipt, character reference and snapshot, with owner stats visible/hidden and zero/one chained record. No normalization.
- Import/review/save and file-input handlers are byte-identical; core, validators, scheduler, database, snapshot and approval modules are byte-identical. Service worker differs only in its cache generation.
- Isolated WebKit and Chrome tests at 375px cover both notices, visible export, skip persistence, rejected batches, stale refresh, protected approvals, receipt/handoff completion, full-copy flow and hidden-owner display. Wider 390px/430px overflow checks are included.
- Physical iPhone verification is not claimed. The reproducible browser script is `tests/reference-import.browser.mjs`; use the synthetic server `scripts/warm-evidence-server.mjs` and set `SCROLL_AUDIT_OUTPUT` for both.

Part C is report-only in `REFERENCE-IMPORT-FINDINGS.md`. No attribute creation or rename contract has been added.

The external release evidence packet records exact commit IDs, deployment run/status, Git blob manifest, served-file comparisons, export hashes, raw test logs and mobile screenshots.
