# JGPT-FUN

An independent open Jyotish calculation laboratory, licensed **AGPL-3.0-or-later**.
Professional natal and divisional charts, periods, transits and calendar tools,
powered by the native Swiss Ephemeris engine. Each browser starts with an empty
collection of charts, folders and notes.

## Run

Node.js 22, npm. No environment secrets are required.

```sh
npm ci --ignore-scripts
npm run prepare:data
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Open http://127.0.0.1:3110. For development use `npm run dev` instead of start;
never run duplicate listeners.
Public routes are `/ru/astrology` and `/en/astrology`. `/` opens the Russian home.
The collection starts empty. Charts, folders, notes and versioned results live
only in IndexedDB in this browser.
Clearing browser data loses the collection. No import or synchronization is included.

## Calculations and delivery

`global-jyotish-geometric-dasha-v6` is the preserved mathematical version, not a
claim that all JHora methods match. See [baseline](docs/engine-baseline.json) and
[calculation methods](docs/calculation-methods.md). The calculation API is a
server-side Node function using sweph 2.10.3-8. It has bounded JSON input, validated
methods, same-origin checks, per-instance request admission and no birth-data logs.
Request admission is not a distributed quota; platform limits remain relevant.

Vercel project `jgpt-fun`. Production branch `main`;
only `main` and intentional `release/**` branches deploy. PR CI runs checks on Linux
without a preview deployment. The UI source link points to the deployed Git SHA.
Intended primary domain: https://jgpt.fun; www redirects to the apex.
No offline caching of personal pages or server responses is enabled.

## License and contributions

Copyright (C) 2026 Artemiy / DEOZMSK. This program is free software under the GNU
Affero General Public License, version 3 or (at your option) any later version.
It is provided **without warranty**. See [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Network users must be offered the corresponding source of a modified deployment.
Contributors retain their rights. Third-party contributions must be reviewed
before any later closed-source reuse; AGPL acceptance is not permission to relicense.
Buying a Swiss professional license does not revoke existing open releases or
replace licenses of other components.
