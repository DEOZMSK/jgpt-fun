import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { daySolarPeriods, solarPeriodAt, solarPeriodSelection, type DaySolarPeriod } from "./astrology/day-solar-periods";
import { muhurtaDefinition } from "./astrology/muhurta-definitions";
import { calculateDayPanchanga } from "./astrology/day-panchanga-core";
import { astrologyName } from "./astrology/workspace-copy";
import type { SolarEvent } from "./astrology/panchanga-contract";

function event(kind: SolarEvent["kind"], utc: string, zone = "Etc/UTC"): SolarEvent {
  const at = DateTime.fromISO(utc, { zone: "UTC" }).setZone(zone), ms = Date.parse(utc);
  return { kind, ref: `fixture/${kind}`, at: { jd: 2440587.5 + ms / 86400000, scale: "UT1", utc,
    local: { dateTime: at.toFormat("yyyy-MM-dd'T'HH:mm:ss"), utcOffsetMinutes: at.offset } } };
}
const ordinary = () => daySolarPeriods([
  event("sunrise", "2026-09-07T06:00:00.000Z"), event("sunset", "2026-09-07T18:30:00.000Z"), event("sunrise", "2026-09-08T05:58:00.000Z")
]);

test("each actual solar half has complete, gap-free divisions with independent durations", () => {
  const rows = ordinary();
  for (const kind of ["muhurta", "yamardha"] as const) {
    const list = rows.filter(r => r.kind === kind), count = kind === "muhurta" ? 15 : 8;
    assert.equal(list.length, 2 * count);
    assert.equal(list[0].start, Date.parse("2026-09-07T06:00:00.000Z"));
    assert.equal(list[count].start, Date.parse("2026-09-07T18:30:00.000Z"));
    assert.equal(list.at(-1)!.end, Date.parse("2026-09-08T05:58:00.000Z"));
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; assert.equal(p.half, i < count ? "day" : "night"); assert.equal(p.index, i % count);
      if (i) assert.equal(p.start, list[i - 1].end);
      assert.ok(Math.abs(p.end - p.start - (i < count ? 750 : 688) * 60000 / count) < 0.001);
    }
  }
});

test("night keeps its sunrise weekday and has exclusive sunset, midnight and sunrise boundaries", () => {
  const rows = ordinary(), nights = rows.filter(p => p.kind === "muhurta" && p.half === "night");
  const atMidnight = solarPeriodAt(rows, "muhurta", Date.parse("2026-09-08T00:00:00.000Z"))!;
  assert.equal(atMidnight.weekday, 1); assert.equal(atMidnight.solarDate, "2026-09-07"); assert.equal(atMidnight.half, "night");
  for (const p of nights) {
    assert.equal(solarPeriodAt(rows, "muhurta", p.start), p);
    assert.notEqual(solarPeriodAt(rows, "muhurta", p.end), p);
  }
  assert.equal(solarPeriodAt(rows, "muhurta", nights.at(-1)!.end), null);
  assert.equal(solarPeriodAt(rows, "muhurta", NaN), null);
});

test("published Richmond Do Ghati example agrees at its one-minute display precision", () => {
  // Drik Do Ghati page, 2026-09-08, Richmond, Australia: 06:32 / 18:04 / 06:30.
  // This checks division arithmetic against displayed times, not solar-event accuracy.
  const zone = "Australia/Melbourne", utc = (value: string) => DateTime.fromISO(value, { zone }).toUTC().toISO()!;
  const rows = daySolarPeriods([event("sunrise", utc("2026-09-08T06:32:00"), zone), event("sunset", utc("2026-09-08T18:04:00"), zone), event("sunrise", utc("2026-09-09T06:30:00"), zone)]);
  for (const [half, index, start, end] of [
    ["day", 0, "2026-09-08T06:32", "2026-09-08T07:18"], ["day", 7, "2026-09-08T11:55", "2026-09-08T12:41"],
    ["night", 0, "2026-09-08T18:04", "2026-09-08T18:54"], ["night", 7, "2026-09-08T23:52", "2026-09-09T00:42"],
    ["night", 14, "2026-09-09T05:40", "2026-09-09T06:30"]
  ] as const) {
    const p = rows.find(r => r.kind === "muhurta" && r.half === half && r.index === index)!;
    assert.ok(Math.abs(p.start - Date.parse(utc(start))) <= 60000);
    assert.ok(Math.abs(p.end - Date.parse(utc(end))) <= 60000);
  }
});

test("traditional muhurta identities distinguish both halves and the Wednesday Abhijit restriction", () => {
  const periods = ordinary().filter(p => p.kind === "muhurta");
  for (const [index, name, quality] of [[0,"Rudra","unfavorable"],[2,"Mitra","favorable"],[10,"Indragni","unfavorable"],[15,"Ishwara","unfavorable"],[20,"Yama","unfavorable"],[22,"Brahma","favorable"],[29,"Samirana","favorable"]] as const) {
    assert.equal(muhurtaDefinition(periods[index])?.name, name); assert.equal(muhurtaDefinition(periods[index])?.quality, quality);
  }
  const eighth = periods[7];
  assert.equal(muhurtaDefinition({ ...eighth, weekday: 3 })?.quality, "restricted");
  assert.equal(muhurtaDefinition({ ...eighth, weekday: 4 })?.quality, "favorable");
  assert.equal(muhurtaDefinition({ ...periods[22], weekday: 3 })?.quality, "favorable");
  for (const p of periods) { const d = muhurtaDefinition(p)!; assert.match(astrologyName(d.name, "ru"), /[А-Яа-я]/); }
  for (const p of [{...eighth,index:15}, {...eighth,index:-1}, {...eighth,half:null}, {...eighth,kind:"yamardha" as const}]) assert.equal(muhurtaDefinition(p), null);
});

test("period selection stays inside the visible interval at fractional-second and civil-day edges", () => {
  const p: DaySolarPeriod = { ...ordinary()[0], start: 1000.5, end: 3500.5 };
  assert.equal(solarPeriodSelection(p, 0, 10000), 2000);
  assert.equal(solarPeriodSelection(p, 2000.5, 10000), 3000);
  assert.equal(solarPeriodSelection(p, 3000.5, 10000), null);
  assert.equal(solarPeriodSelection(p, 0, 1500), null);
  assert.equal(solarPeriodSelection(p, NaN, 10000), null);
});

test("native DST and midnight windows retain a full night without changing its solar weekday", () => {
  for (const date of ["2024-03-10", "2024-11-03"]) {
    const r = calculateDayPanchanga({date,time:"12:00:00",place:"Synthetic New York",timezone:"America/New_York",latitude:40.7,longitude:-74,nodes:"true"});
    const rows = daySolarPeriods(r.solarEvents), start = Date.parse(r.start.utc), end = Date.parse(r.end.utc);
    for (const kind of ["muhurta", "yamardha"] as const) {
      const visible = rows.filter(p => p.kind === kind && p.start < end && p.end > start);
      assert.ok(visible.length > 0); assert.ok(visible[0].start <= start); assert.ok(visible.at(-1)!.end >= end);
      for (let i = 1; i < visible.length; i++) assert.equal(visible[i].start, visible[i-1].end);
      const beforeDawn = solarPeriodAt(rows, kind, start + 3600000)!;
      assert.equal(beforeDawn.half,"night"); assert.equal(beforeDawn.weekday,6);
    }
  }
});

test("absent and nonordinary solar pairs do not receive nighttime divisions", () => {
  assert.deepEqual(daySolarPeriods([]), []);
  assert.deepEqual(daySolarPeriods([event("sunrise","2026-09-07T06:00:00Z"),event("sunrise","2026-09-08T06:00:00Z")]),[]);
  assert.deepEqual(daySolarPeriods([event("sunrise","2026-09-07T06:00:00Z"),event("sunset","2026-09-07T18:00:00Z"),event("sunrise","2026-09-09T06:00:00Z")]),[]);
});
