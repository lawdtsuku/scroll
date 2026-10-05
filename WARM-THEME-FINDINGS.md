# Warm theme findings — baseline 0.6.0

The pre-change CSS contained 243 declarations with hard-coded colors outside custom properties (245 color literals, 192 unique). Colors appeared both in root tokens and successive selector overrides. Effective values, rather than the first matching declaration, govern the screen.

| Role | Source baseline | Moss |
|---|---|---|
| Primary handoff button | #345d49 | #46603f |
| Selected mobile tab | #c9dfe0 | #dbe6c9, plus primary border |
| Pending chip | #deedf2 | #e8eed9 |
| Locked chip / text | #d6e5cd / #234b36 | #dde8c8 / #44582f |
| Exchange panel | #edf3eb | #f1f5e8 |
| Header | #dce7d3 | #f1f5e8 |
| Main ink | #233e36 | #2f3a22 |
| Page | #f6f3e9 | #f6f3ea |
| Root card / later card overrides | #fffdf6 / #fffefa | #fffefa |
| Notice / stripe | #f3ecd9 / #b8a373 | unchanged |
| Badge dot | #875514 | unchanged |

The initial Locked report used an earlier overridden rule; the effective baseline above was subsequently verified in WebKit. There is no dark-mode branch: color-scheme is light. No dark mode was introduced. Status labels, solid/dashed borders and ✓/≈/development glyphs are retained; Pending remains explicitly labeled separately from Locked.

Main HTML already had viewport-fit=cover; snapshot HTML did not. Neither had an Apple status-bar style override, and neither had a fixed top safe-area shield. The new shield is page-colored, ignores pointer input, sits above scrolling content and has height env(safe-area-inset-top). WebKit emulation reports zero pixels, as expected there. The physical installed-iPhone status bar remains a manual verification item.

The Cost/Range indent came from a literal space following the block label inside a white-space:pre-wrap parent. Removing the inter-element space and preserving whitespace on value spans aligns the text without rewriting stored values.

Tap investigation: a two-line -webkit-line-clamp exists inside the native summary. It remains because both baseline and new WebKit passed preview-text taps; there is no evidence it caused this failure. Hit-testing found the preview itself, no sibling overlay. Pointer-events is auto. Touch-action is manipulation. Trusted touchend-to-click was 1 ms in both measured runs, not 300 ms. Baseline allowed text selection; the new summary prevents selection, while expanded details retain it. A physical-iPhone long press and the originally reported failure were not reproduced or ruled out by this emulation.

Ungated hover rules were present and could persist after a touch. All hover rules are now gated by (hover:hover) and (pointer:fine). The reported double-highlight was not reproduced in isolated WebKit, and each of the six touch-selected tabs now has exactly one selected fill in captured computed styles.

## Updates-dot truth table

All rows use no handoff attention unless stated. Other tab predicates and exports are unchanged.

| Device exchange state | Before | After |
|---|---:|---:|
| Fresh / absent | on | off |
| State copied only | on | on |
| Instructions copied only | on | on |
| Update ID set only | on | on |
| Receipt-pasted flag only | on | on |
| All four steps complete | off | off |
| Otherwise complete, attention requires uncopied handoff | on | on |

Preview placement exception: user expressly authorized retaining the original dialog if inline placement required changes to handlers. That fallback was used; original handler hashes are included in the evidence packet.
