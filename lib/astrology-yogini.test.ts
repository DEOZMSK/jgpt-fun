import assert from "node:assert/strict";
import test from "node:test";
import { calculateAstrology } from "./astrology/engine-core";
import { normalizeBirthInput } from "./astrology/contracts";
import { astronomyTime } from "./astrology/time-scales";
import { yoginiDasha } from "./astrology/yogini";
import { DASHA_YEAR_MS, dashaChildren, periodAt, resolveCalculationRef } from "./astrology/dasha";
import { divisionalLongitude } from "./astrology/jyotish";

const sample = { date: "2000-01-01", time: "12:00", place: "Synthetic Greenwich", timezone: "Etc/UTC", latitude: 51.48, longitude: 0, nodes: "true", accuracy: "exact" };
test("seconds survive civil normalization, midnight, DST and explicit overlap selection", () => {
  assert.equal(normalizeBirthInput({ ...sample, time: "12:00:37" }).utc, "2000-01-01T12:00:37.000Z");
  assert.equal(normalizeBirthInput({ ...sample, time: "00:00:01", timezone: "Asia/Kolkata" }).utc, "1999-12-31T18:30:01.000Z");
  for (const time of ["12:00:60", "24:00:00", "12:00:1", "12:00:00.1"]) assert.throws(() => normalizeBirthInput({ ...sample, time }));
  assert.throws(() => normalizeBirthInput({ ...sample, date: "2024-03-10", time: "02:30:15", timezone: "America/New_York" }));
  const overlap = { ...sample, date: "2024-11-03", time: "01:30:42", timezone: "America/New_York" };
  assert.throws(() => normalizeBirthInput(overlap));
  assert.equal(normalizeBirthInput({ ...overlap, utcOffsetMinutes: -240 }).utc, "2024-11-03T05:30:42.000Z");
  assert.equal(normalizeBirthInput({ ...overlap, utcOffsetMinutes: -300 }).utc, "2024-11-03T06:30:42.000Z");
});
test("Swiss conversion labels TT/UT1 and its pre-1972 policy, without historical UTC inventions", () => {
  for (const [date, time, pre] of [["1971-12-31", "23:59:59", true], ["1972-01-01", "00:00:00", false], ["1961-01-01", "00:00:00", true]] as const) {
    const birth = normalizeBirthInput({ ...sample, date, time }), result = astronomyTime(birth, false);
    const civilJD = Date.parse(birth.utc) / 86400000 + 2440587.5;
    assert.equal(result.swissInputPolicy === "pre-1972-UT1", pre);
    if (pre) assert.ok(Math.abs(result.jdUT1 - civilJD) < 1e-9);
    else assert.ok(Math.abs((result.jdTT - civilJD) * 86400 - 42.184) < 0.0001);
    assert.equal(result.planetScale, "TT"); assert.equal(result.houseScale, "UT1");
  }
  const a = calculateAstrology(sample), b = calculateAstrology({ ...sample, time: "12:00:00" }), c = calculateAstrology({ ...sample, time: "12:00:01" });
  assert.deepEqual(a.planets, b.planets); assert.deepEqual(a.charts, b.charts);
  assert.notEqual(a.planets[1].longitude, c.planets[1].longitude);
  assert.ok(Math.abs((c.time.jdTT - a.time.jdTT) * 86400 - 1) < 0.0001);
  assert.equal(a.time.secondsDefaulted, true); assert.equal(b.time.secondsDefaulted, false);
  assert.ok(a.time.dataVersions.tz); assert.equal(a.time.dataVersions.swiss, a.engineVersion);
});
test("all 27 Yogini starting lords match Rao's nakshatra mapping, including the Revati/Ashwini discontinuity", () => {
  const expected = ["Mars", "Mercury", "Saturn", "Venus", "Rahu", "Moon", "Sun", "Jupiter", "Mars", "Mercury", "Saturn", "Venus", "Rahu", "Moon", "Sun", "Jupiter", "Mars", "Mercury", "Saturn", "Venus", "Rahu", "Moon", "Sun", "Jupiter", "Mars", "Mercury", "Saturn"];
  const years: Record<string, number> = { Moon: 1, Sun: 2, Jupiter: 3, Mars: 4, Mercury: 5, Saturn: 6, Venus: 7, Rahu: 8 };
  for (let k = 0; k < 27; k++) {
    const birth = "2000-01-01T00:00:00.000Z", middle = yoginiDasha((k + 0.5) * 360 / 27, birth);
    assert.equal(middle.periods[0].lord, expected[k], `nakshatra ${k + 1}`);
    assert.ok(Math.abs(middle.birthBalance.remainingYears - years[expected[k]] / 2) < 1e-9);
    assert.equal(middle.birthBalance.fullStart, new Date(Date.parse(birth) - years[expected[k]] / 2 * DASHA_YEAR_MS).toISOString());
    const boundary = k * 360 / 27;
    const exact = yoginiDasha(boundary, birth);
    assert.equal(exact.periods[0].lord, expected[k]);
    assert.equal(exact.birthBalance.fullStart, birth);
    assert.equal(yoginiDasha(boundary + 1e-8, birth).periods[0].lord, expected[k]);
    assert.equal(yoginiDasha(boundary - 1e-8, birth).periods[0].lord, expected[(k + 26) % 27]);
  }
  assert.equal(yoginiDasha(0, "2000-01-01T00:00:00Z").periods[0].lord, "Mars");
  assert.equal(yoginiDasha(360, "2000-01-01T00:00:00Z").periods[0].lord, "Mars");
});
test("Yogini repeats 36-year cycles beyond age 120, and every child partitions its parent through four levels", () => {
  const birth = "2000-01-01T00:00:00.000Z", result = yoginiDasha(10, birth), periods = result.periods;
  assert.ok(Date.parse(periods[0].start) < Date.parse(birth));
  assert.ok(Date.parse(periods.at(-1)!.end) >= Date.parse(birth) + 120 * DASHA_YEAR_MS);
  assert.ok(Date.parse(periods.at(-1)!.start) < Date.parse(birth) + 120 * DASHA_YEAR_MS);
  assert.equal(Date.parse(periods[8].start) - Date.parse(periods[0].start), 36 * DASHA_YEAR_MS);
  const check = (parent: typeof periods[number]) => {
    const children = dashaChildren(parent);
    if (parent.level === 3) { assert.equal(children.length, 0); return; }
    assert.equal(children.length, 8); assert.equal(children[0].lord, parent.lord);
    assert.equal(children[0].start, parent.start); assert.equal(children.at(-1)!.end, parent.end);
    assert.equal(children.reduce((sum, p) => sum + Date.parse(p.end) - Date.parse(p.start), 0), Date.parse(parent.end) - Date.parse(parent.start));
    children.forEach((p, i) => { if (i) assert.equal(children[i - 1].end, p.start); assert.ok(p.ref?.startsWith("dasha/yogini/")); check(p); });
  };
  periods.forEach((p, i) => { if (i) assert.equal(periods[i - 1].end, p.start); check(p); });
  assert.equal(periodAt(periods, periods[0].end), periods[1]);
});
test("v2 separates natal facts from symbolic vargas and retains the existing D1/D9/D10 methods", () => {
  const result = calculateAstrology(sample), refs = new Set<string>();
  assert.equal(result.facts.natal.length, 10);
  for (const f of result.facts.natal) {
    assert.ok(!refs.has(f.ref)); refs.add(f.ref);
    assert.equal(f.coordinateKind, "natal-sidereal"); assert.ok(f.nakshatra); assert.ok(f.pada);
    assert.equal(f.retrograde, f.speed === null ? null : f.speed < 0);
  }
  for (const varga of ["D1", "D9", "D10"] as const) for (const f of result.facts.vargas[varga]) {
    const natal = result.facts.natal.find(n => n.name === f.name)!;
    assert.equal(f.longitude, divisionalLongitude(natal.longitude, varga));
    assert.equal(f.basisRef, natal.ref); assert.equal(f.nakshatra, null); assert.equal(f.speed, null);
    assert.equal(f.coordinateKind, "divisional-symbolic"); assert.equal(f.method, result.profile.methods[varga]);
  }
  assert.equal(result.facts.natal[0].name, "Lagna"); assert.equal(result.facts.natal[0].house, 1);
  assert.equal(result.dashas.yogini.basisRef, "dasha-basis/Moon");
  assert.equal(resolveCalculationRef(result, "natal/Moon"), result.facts.natal.find(f => f.name === "Moon"));
  const leaf = dashaChildren(dashaChildren(dashaChildren(result.dashas.yogini.periods[0])[2])[3])[4];
  assert.deepEqual(resolveCalculationRef(result, leaf.ref!), leaf);
  assert.equal(resolveCalculationRef(result, "https://outside.invalid"), undefined);
});
