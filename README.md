# Scroll

An offline-capable, local-first campaign companion. Character abilities, resource tracking, reviewed DM imports, training thresholds, and a day-triggered scheduler with opaque tokens.

Rolls happen externally. Campaign data stays in browser storage and user-exported backups.

## Use

Open the GitHub Pages site after deployment. On iPhone, use Safari → Share → Add to Home Screen. Open the installed app online once before testing offline access. Transfer your existing campaign by restoring a backup; localhost and the hosted site have separate storage.

## Development

Run `npm start` and open http://127.0.0.1:4173/. Run `npm test` for automated checks. Only `dist/` is published.

See [DM update guide](DM-UPDATE-GUIDE.md) and [schema](SCHEMA.md).

No campaign backups, migration packets, or private schedules are included in this repository.
