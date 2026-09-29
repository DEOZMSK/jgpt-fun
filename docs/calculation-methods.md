# Calculation baseline

The source manifest records hashes of all mathematical modules in the initial
2026-09-29 laboratory baseline. The control fixtures use synthetic birth details.

Preserved method identifier: `global-jyotish-geometric-dasha-v6`. This legacy
identifier is retained for result compatibility. Natal charts use Lahiri,
whole-sign houses and an explicit mean/true node selection. Dashas use a separate
geometric Swiss True Pushya Moon (mode 29), civil-as-UT with Swiss Delta T once.
Vimshottari uses 365.24219-day years; Yogini uses 365.25. Twenty named varga methods
and IANA/civil time handling are preserved. Full Jagannatha Hora parity is pending.

`lib/lab-baseline.test.ts` compares three synthetic birth calculations and a transit,
including alternating node settings in one process. Numeric tolerance is 1e-8 in
stored units; timestamps and methods match exactly. Node/ICU/tz metadata are
recorded but may differ across operating systems.

Record changes to mathematical methods with explicit versions and control tests.
Saved results keep their original version and are never silently replaced.
