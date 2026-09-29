# Mathematical baseline and controlled transfer

Initial source: GLOBAL working tree at 3b1eda5 plus its local changes on 2026-09-29.
The source manifest records hashes of every extracted `lib/astrology` module.
These are source provenance hashes, not a claim that the whole source commit was
published. The checked-in synthetic fixture was calculated in that working tree.
It contains no owner's chart or personal result.

Preserved profile: `global-jyotish-geometric-dasha-v6`, Lahiri sidereal natal charts,
whole-sign houses, explicit mean/true node choice. Dashas use a separate geometric
Swiss True Pushya Moon (mode 29), civil-as-UT with Swiss Delta T once. Vimshottari
uses 365.24219-day years; Yogini uses 365.25. Twenty explicitly named varga methods
and the current IANA/civil time rules remain unchanged. Old result versions retain
their validators and explicit provenance. Full Jagannatha Hora parity is pending.

`lib/lab-baseline.test.ts` compares three synthetic birth calculations and a transit,
including alternating settings in one process. Numeric tolerance is 1e-8 in stored
units, timestamps/methods match exactly. Node/ICU/tz metadata are recorded but not
forced equal between operating systems. Further reference acceptance is separate.

For a future GLOBAL transfer: choose a tested immutable laboratory commit; review
the diff of mathematical modules, contracts, result versions and synthetic tests;
confirm professional Swiss licensing and all contribution rights; run the same
baseline on GLOBAL; transfer only the selected engine/settings/UI changes; retain
GLOBAL's private archive, Auth, CRM, deployment and environment boundaries. Do not
merge complete application histories or set up automatic bidirectional syncing.
Record the accepted source SHA, method changes and migration behavior in both
projects. A settings-only change must not silently replace saved results.
