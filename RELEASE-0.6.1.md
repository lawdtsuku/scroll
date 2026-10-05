# Scroll 0.6.1 · warm-green-1

Moss is the default palette. All application colors now use semantic tokens in `dist/palette.css`; Olive is a test fixture and screenshot alternative only. The application remains light-only and uses local assets and system fonts. Icons are unchanged. Green theme metadata changes to #f1f5e8; the non-green manifest background remains #faf6eb.

Collapsed ability Cost/Range values align with their labels. A fixed, opaque page-colored strip uses `env(safe-area-inset-top)`; it is zero-height without an inset. The snapshot page now uses viewport-fit=cover too. The UI says “No unresolved events”; exports retain their original bytes.

Ability and move summaries have an explicit click activation path for their entire collapsed content. Interactive child controls retain their own action. Text selection is disabled on the summary, not on expanded details. WebKit 26.5 with iPhone 13 touch emulation at 390×844 passes preview-text taps and an in-card Adjust PP button test. The old build also passed in this engine: the reported physical-iPhone failure was not reproduced, so this is a mitigation awaiting phone confirmation.

Long campaign roster labels use a clean ellipsis, with the full label retained in the accessible name and title. Standard tab labels still wrap. All six buttons fit at 320 and 390 pixels. Hover styling is limited to fine pointers with hover; only the selected tab has selected fill. Focus rings use focus-visible.

DM updates keeps the four existing completion rules. The current step opens; completed steps are compact, reopenable rows; future steps explain what they are waiting for without disabled buttons. Step 2 contains the existing paste/upload controls. **Review remains the original dialog launched from step 2**, as authorized: moving it inline would require changing modal-specific approval/save handlers. After save, step 3 opens and scrolls into view beneath the existing receipt dialog. Receipt-pasted and handoff-checked acknowledgments remain manual. The human-control notice is directly beneath the import controls within expanded step 2. Time changes, new exchange and template kit actions follow the steps.

The Updates dot now requires an exchange to have started and remain unfinished. Play and reference predicates are unchanged. No optional E–H work was approved or implemented.

## Validation and boundaries

- 91 local unit tests passed. The existing routine batch, individual protected approval and failed-batch atomicity tests are unchanged.
- Updated the fresh-exchange expectation in `only the three specified tabs get badges; XP notice cannot light Play`; added `updates badge is quiet before an exchange and after completion, each start flag lights it`.
- `tests/warm-green.browser.mjs` drives the entire exchange with touch-emulated WebKit and captures all six tabs, character disclosures, snapshot views and Olive alternatives. `scripts/warm-evidence-server.mjs` supplies isolated synthetic fixtures.
- Receipt, reference, snapshot and summary: 16 before/after byte comparisons passed (owner hide false/true × pending chains 0/1 × four exports).
- `exchange.js`, `progress.js`, `updates.js`, `roster.js`, `snapshot.js`, `db.js`, `operation-policy.js`, `review-policy.js`, `core.js` and all icons remain byte-identical to 0.6.0. Original import, input/upload, review and approval/save handlers are hash-identical.
- All sampled text/fill pairs meet 4.5:1. The retained decorative tan notice stripe (#b8a373 on #f3ecd9) is **2.09:1**, below the requested 3:1 border target; notice text and controls pass and the stripe is not the sole state cue.
- Physical-iPhone behavior, a nonzero iOS safe-area inset and activation of an already-installed iPhone cache cannot be confirmed by emulation. Close all Scroll windows after saving drafts and reopen to receive the new worker normally.

Service-worker cache: `scroll-consolidated-v20`; `palette.css` is included. No skipWaiting or clients.claim was added. The visible footer is `Scroll 0.6.1 · warm-green-1`.
