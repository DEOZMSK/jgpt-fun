import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBirthInput, isAstrologyPreviewEnabled, AstrologyInputError } from "./astrology/contracts";
import { calculateAstrology } from "./astrology/engine-core";
import { divisionalLongitude, dashaChildren, lunarPanchanga, nakshatraAt, vimshottariPeriods } from "./astrology/jyotish";

const sample = { date: "2000-01-01", time: "12:00", place: "Synthetic Greenwich", timezone: "Etc/UTC", latitude: 51.48, longitude: 0, nodes: "mean", accuracy: "exact" };

test("birth normalization rejects nonexistent, ambiguous and uncertain local times", () => {
  assert.equal(normalizeBirthInput(sample).utc, "2000-01-01T12:00:00.000Z");
  const newYork = { ...sample, timezone: "America/New_York" };
  for (const [input, code] of [
    [{ ...newYork, date: "2024-03-10", time: "02:30" }, "nonexistent_time"],
    [{ ...newYork, date: "2024-11-03", time: "01:30" }, "ambiguous_time"],
    [{ ...sample, date: "2001-02-29" }, "nonexistent_time"],
    [{ ...sample, accuracy: "unknown" }, "uncertain_time"],
    [{ ...sample, latitude: NaN }, "invalid_latitude"],
    [{ ...sample, nodes: "unsupported" }, "invalid_nodes"],
    [{ ...sample, timezone: "Invented/Place" }, "invalid_timezone"],
    [{ ...sample, utcOffsetMinutes: 60 }, "invalid_offset"],
    [{ ...sample, extra: true }, "invalid_input"]
  ] as const) assert.throws(() => normalizeBirthInput(input), (error: unknown) => error instanceof AstrologyInputError && error.code === code);
  const ambiguous = { ...newYork, date: "2024-11-03", time: "01:30" };
  assert.equal(normalizeBirthInput({ ...ambiguous, utcOffsetMinutes: -240 }).utc, "2024-11-03T05:30:00.000Z");
  assert.equal(normalizeBirthInput({ ...ambiguous, utcOffsetMinutes: -300 }).utc, "2024-11-03T06:30:00.000Z");
});

test("D9 and Parashari D10 handle sign parity and exact division boundaries", () => {
  for (const [longitude, sign] of [[0,0],[30,9],[60,6],[90,3],[120,0],[359.999,11]]) {
    assert.equal(Math.floor(divisionalLongitude(longitude, "D9") / 30), sign);
  }
  for (const [longitude, expected] of [[0,0],[3,30],[30,270],[33,300],[60,60],[87,330],[330,210],[360,0]]) {
    assert.equal(divisionalLongitude(longitude, "D10"), expected);
  }
  assert.equal(Math.floor(divisionalLongitude(2.999999, "D10") / 30), 0);
  assert.equal(Math.floor(divisionalLongitude(3.000001, "D10") / 30), 1);
});

test("lunar periods have correct phase and fixed/moving karana boundaries", () => {
  assert.equal(lunarPanchanga(0, 0).karana, "Kimstughna");
  assert.equal(lunarPanchanga(0, 6).karana, "Bava");
  assert.equal(lunarPanchanga(0, 342).karana, "Shakuni");
  assert.equal(lunarPanchanga(0, 348).karana, "Chatushpada");
  assert.equal(lunarPanchanga(0, 354).karana, "Naga");
  assert.equal(lunarPanchanga(0, 179.99).tithi, 15);
  assert.equal(lunarPanchanga(0, 180).paksha, "Krishna");
  assert.equal(lunarPanchanga(350, 2).tithi, 2);
  assert.deepEqual(nakshatraAt(0), { index: 0, name: "Ashwini", pada: 1 });
  assert.equal(nakshatraAt(359.999).pada, 4);
});

test("Vimshottari is contiguous through four levels and retains its declared year convention", () => {
  const periods = vimshottariPeriods(0, "2000-01-01T00:00:00.000Z");
  assert.equal(periods[0].lord, "Ketu");
  assert.equal(periods[0].start, "2000-01-01T00:00:00.000Z");
  assert.equal(periods[0].end, "2006-12-31T18:00:00.000Z");
  let parent = periods[1];
  for (let level = 1; level <= 3; level++) {
    const children = dashaChildren(parent);
    assert.equal(children.length, 9);
    assert.equal(children[0].lord, parent.lord);
    assert.equal(children[0].start, parent.start);
    assert.equal(children[8].end, parent.end);
    for (let index = 1; index < children.length; index++) assert.equal(children[index - 1].end, children[index].start);
    parent = children[0];
    assert.equal(parent.level, level);
  }
  assert.deepEqual(dashaChildren(parent), []);
});

test("native Swiss calculation uses verified ephemerides and is deterministic across node modes", () => {
  const first = calculateAstrology(sample);
  // At J2000 UTC, TAI-UTC=32s and TT-TAI=32.184s (Swiss API section 9.2).
  assert.ok(Math.abs(first.time.jdTT - (2451545 + 64.184 / 86400)) < 1e-9);
  assert.equal(first.julianDay, first.time.jdUT1);
  assert.ok(Math.abs(first.time.jdUT1 - 2451545) < 1 / 86400);
  assert.equal(first.engineVersion, "2.10.03");
  // Regression sample from the pinned Swiss 2.10.03 binary, not JHora acceptance. v2 resolves UTC/UT1 (~0.355s here); retain the old coarse regression bound.
  assert.ok(Math.abs(first.planets[0].longitude - 256.51569618387066) < 0.00001);
  assert.equal(first.planets.length, 9);
  assert.equal((first.planets[8].longitude - first.planets[7].longitude + 360) % 360, 180);
  const trueNodes = calculateAstrology({ ...sample, nodes: "true" });
  assert.notEqual(trueNodes.planets[7].longitude, first.planets[7].longitude);
  assert.deepEqual(calculateAstrology(sample), first);
  assert.equal(first.settings.yearDays, 365.24219);
  assert.ok(first.warnings.some((warning) => warning.includes("Jagannatha Hora")));
});

test("preview cannot be enabled in a production or Vercel runtime", () => {
  assert.equal(isAstrologyPreviewEnabled({ NODE_ENV: "development", ASTROLOGY_PREVIEW_ENABLED: "true" }), true);
  assert.equal(isAstrologyPreviewEnabled({ NODE_ENV: "production", ASTROLOGY_PREVIEW_ENABLED: "true" }), false);
  assert.equal(isAstrologyPreviewEnabled({ NODE_ENV: "development", ASTROLOGY_PREVIEW_ENABLED: "true", VERCEL: "1" }), false);
  assert.equal(isAstrologyPreviewEnabled({}), false);
});
