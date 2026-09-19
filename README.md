# Scroll — consolidated build 0.4.0

Scroll holds campaign state, a day-triggered event schedule, character abilities and training progress. Rolls happen outside Scroll. Sage, shore-blue and cream; system fonts only; no external scripts or assets.

Owned rosters and separate read-only trainer snapshots are available in 0.4.0. On the operator phone, open Roster, select a trainer, and choose **Export snapshot for [name]**. On the receiving phone, open **Open trainer snapshot viewer**, choose the file, and tap **Load snapshot**. Each new import replaces the previous snapshot; it never creates or modifies a campaign. See [ROSTER-AND-SNAPSHOTS.md](ROSTER-AND-SNAPSHOTS.md) for fields, operations and the two-phone workflow.

## Start on this computer

With Node.js installed, open this folder in a terminal and run `npm start`. Open http://127.0.0.1:4173/. The app caches itself for offline use. After an update, save any draft, close every Scroll tab/window, and reopen so the new offline version can activate.

## Upgrade the existing campaign

1. Save a JSON backup.
2. On Play choose **Review campaign upgrade file** and select the supplied `scroll-campaign-upgrade.json`.
3. Review the explicit ability statuses and literal details. Approve the protected configuration and save.
4. The full day-token and cover stream is generated once, for days 0–99,999, by the same generator used for new campaigns. Earlier days are included. Stored random event dates are frozen on import, never displayed. The trigger-chained record remains explicitly unsupported without a made-up date.
5. Open Character and export the refreshed reference to your DM’s project. Copy the updated DM instructions from DM updates.

## During play

- **DM updates:** paste (concealed to protect hidden dates) or choose a file; preview, then confirm. Send the receipt back to the DM. Stale updates produce a copyable refresh block.
- **Travel:** request a destination. The app commits to the first event or fixed cover stop and shows the reached day and its token only after saving. **Resume travel** takes one tap. There is no next-stop countdown. Explicit skip through requires extra approval.
- **Time-scoped effects:** the DM supplies `effective_day`. If a stop precedes any effect, or the effects are unscoped, time commits alone; all non-time effects remain pending for a revised update. Repeating the original update ID never repeats time or rewards.
- **Day handoff:** send the token. Every day has one, including empty days. Unresolved opaque event IDs stay on Play until explicitly resolved after DM handling. Marking a handoff delivered does not resolve it.
- **Quick entry:** currency adjustments and consumable-use buttons are on Play. Changes still have a readable review and audit reason.
- **Sessions:** one notes field per session, a journal-derived since-last-session view, and a warning when closing without a day advance. Session actions never trigger events.
- **Character:** tap individual abilities for cost, range, effect and notes. Status is explicit: locked, trained but not yet quantified, or in development with linked threshold progress. External success/failure results advance training; they never silently pin an ability.

## Phone and deployment

Live app: https://lawdtsuku.github.io/scroll/. GitHub Pages deployment succeeded; the live app reports Offline ready. Only `dist/` is served. Physical iPhone verification is still pending. See DEPLOYMENT.md for backup transfer and installation steps.

After deployment, in iPhone Safari open the HTTPS site → Share → Add to Home Screen → Open as Web App. Open the installed app online once, restore your exported backup, then enable Airplane Mode and reopen. Verify Character, Play and a saved test change; reopen again to check persistence. Desktop responsive testing cannot substitute for this device check.

Device storage is separate: localhost, GitHub Pages, Safari and the installed web app may have different stores. Transfer using backups. Save a fresh backup after sessions.

## Validation

Run `npm test`. See VALIDATION.md for performed checks and outstanding deployment/device checks. See DM-UPDATE-GUIDE.md and SCHEMA.md for the current protocol.

Probabilistic cover is not a secrecy guarantee: independently pre-generated cover on about one-third of days obscures why a particular jump stopped, but does not promise identical statistical rates. Dates remain in IndexedDB and complete backup files; app views and diagnostic projections conceal them. This is not encryption or protection against inspecting storage.


