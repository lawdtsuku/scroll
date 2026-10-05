# Update-ready activation — approved item G

Design before implementation, base 0.6.1.

1. Show a persistent, non-modal notice outside the rerendered app: “Update now will reload Scroll with the new build after your edits are saved or discarded.” Never dismiss it on a timer.
2. Do not request activation until a trusted user click. Block whenever any dialog is open, a draft or routine batch exists, a file/clipboard read or save is in flight, or a selected snapshot has not been imported. Recheck on the click, not only when rendering the button.
3. Freeze this window's application controls while awaiting activation. A waiting worker must confirm that the requesting client is the only open window in its scope. Multiple/unknown clients fail closed with instructions to close other Scroll windows. A tab opened after that check is never automatically reloaded.
4. The worker may call skipWaiting only for this explicit request. Do not add clients.claim. Reload only the requesting page on controllerchange, after another safety check. A controllerchange received by any other page shows a notice but never reloads it. If the guard becomes unsafe, keep the notice and require another click once safe.
5. A timeout, missing worker, denied activation or unsupported API leaves the existing page running. Keep the notice. Do not fall back to a forced reload. Previously cached releases cannot gain this panel retroactively; the initial upgrade from 0.6.1 still requires closing all Scroll windows.

Ship gates: existing unit tests; additive export compatibility tests; worker rejection tests; real browser waiting-worker tests proving no activation/reload during import preview, form edits and drafts, multi-window refusal, and an explicit safe update performing one reload. If any gate fails, ship no G code and report the unresolved risk.
