# Scroll 0.6.2 · handoff-updates-1

Approved optional items E and G are implemented. H is report-only in SNAPSHOT-THRESHOLDS-REPORT.md. F remains skipped; the DM template kit is unchanged.

E adds optional app_version to new state summaries and newly created update receipts. One shared version.js supplies both exports and the visible build label. Existing receipt records/retries remain unchanged; missing app_version is accepted. The update request envelope does not accept this output-only metadata. Reference and snapshot exports remain byte-identical. See EXPORT-VERSION-CONTRACT.md, including the older-reader backup restriction.

G follows UPDATE-READY-DESIGN.md: persistent notice, trusted user click, local preview/draft/form/read/save guards, controls frozen during the request, worker refusal when other Scroll windows are open, and a final guard before the requesting window reloads. Other controller changes never reload a page automatically. Timeout or refusal leaves the page open. Snapshot file selection/import has its own pending/save guard. skipWaiting is reachable only via the explicit activation message; clients.claim is not added.

Both Chrome 154 and WebKit 26.5 passed actual waiting-worker tests at a 390×844 touch viewport: no activation/reload during an import preview; draft and form blocked; second snapshot window refused; one safe click caused exactly one reload; panel disappeared on the new build; externally triggered controllerchange left an open preview intact. Synthetic test worker generations are used to prove a version transition; physical-iPhone installation remains unverified.

The first upgrade from 0.6.1 requires the existing close-all-windows/reopen process: old cached JavaScript cannot display a newly introduced panel. The panel is available for subsequent upgrades once this release is running.

Tests: 95 local unit tests, including the private campaign fixture; public-source count is 94. Updated the old summary test that explicitly asserted app_version was absent. Added optional-updates.test.mjs (version metadata, immutable legacy retries, every blocking UI flag, worker client/message checks) and update-ready.browser.mjs with its controlled local server. Existing protected-operation approval and atomicity tests remain unchanged.

Export matrix: receipt/reference/snapshot/summary × hide owner stats false/true × pending chain count 0/1. Only app_version differs in new summary/receipt output; removing just that field produces identical before/after hashes. All reference/snapshot pairs match without normalization. Approval/save/import handlers remain byte-identical; core.js and updates.js change only for approved version metadata.

Build label: Scroll 0.6.2 · handoff-updates-1. Worker cache: scroll-consolidated-v21, adding version.js and update-ready.js. No data schema version, migration, token generation, campaign operation name or snapshot format change.
