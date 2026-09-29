import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { tithiDetails, nakshatraDetails, karanaDetails, yogaDetails, yogaRestriction, panchangaIntervalAt } from "./astrology/panchanga-details";
import { calculateDayPanchanga } from "./astrology/day-panchanga-core";
import { lunarPanchanga } from "./astrology/jyotish";
import { PANCHANGA_PARTS } from "./astrology/panchanga-contract";
import { astrologyName } from "./astrology/workspace-copy";
import type { MonthInterval } from "./astrology/month-panchanga-contract";

test("tithi names and planetary lords restart each fortnight, with a separate new-moon rule", () => {
  // Rao, Table 3; Brihat Samhita 99.1-2 for deities and groups.
  assert.deepEqual(tithiDetails(0), { name: "Pratipada", number: 1, pakshaNumber: 1, paksha: "Shukla", group: "Nanda", lord: "Sun", deity: "Brahma" });
  assert.equal(tithiDetails(15)!.lord, "Sun"); assert.equal(tithiDetails(15)!.paksha, "Krishna");
  assert.equal(tithiDetails(14)!.name, "Purnima"); assert.equal(tithiDetails(14)!.lord, "Saturn");
  assert.equal(tithiDetails(29)!.name, "Amavasya"); assert.equal(tithiDetails(29)!.lord, "Rahu"); assert.equal(tithiDetails(29)!.deity, "Pitrs");
  assert.equal(tithiDetails(23)!.group, "Rikta"); assert.equal(tithiDetails(24)!.group, "Purna");
  assert.equal(tithiDetails(25)!.deity, "Shiva"); assert.equal(tithiDetails(26)!.lord, "Mercury");
});

test("all 60 half-tithis use the correct fixed/repeating cycle and Vishti restriction", () => {
  // Brihat Samhita 99.4-7: seven repeating karanas, eight occurrences each.
  const rows = Array.from({ length: 60 }, (_, i) => karanaDetails(i)!);
  assert.deepEqual(rows.filter(r => r.fixed).map(r => [r.halfTithi, r.name, r.deity]), [[1,"Kimstughna","Vayu"],[58,"Shakuni","Kali"],[59,"Chatushpada","Vrisha"],[60,"Naga","Sarpa"]]);
  const repeating = rows.filter(r => !r.fixed);
  for (const name of Array.from(new Set(repeating.map(r => r.name)))) assert.equal(repeating.filter(r => r.name === name).length, 8);
  assert.equal(rows[56].name, "Vishti"); assert.equal(rows[56].quality, "restricted");
  assert.equal(rows[57].quality, "activity-dependent"); assert.equal(rows[2].deity, "Brahma"); assert.equal(rows[3].deity, "Mitra");
  assert.equal(rows[53].number,4); assert.equal(rows[53].name,"Taitila");
  assert.equal(rows[58].half, 1); assert.equal(rows[59].half, 2); assert.equal(rows[59].tithiIndex, 29);
});

test("27-sector nakshatra types preserve the published grouping without an inserted Abhijit", () => {
  const rows = Array.from({length:27}, (_, i) => nakshatraDetails(i)!);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.nature] = (counts[row.nature] ?? 0) + 1;
  assert.deepEqual(counts, { quick:3, fierce:5, mixed:2, fixed:4, gentle:4, sharp:4, movable:5 });
  assert.equal(rows[7].lord, "Saturn"); assert.equal(rows[7].deity, "Brihaspati");
  assert.equal(rows[18].deity, "Nirriti"); assert.equal(rows[19].deity, "Apas"); assert.equal(rows[20].deity, "Vishwedeva");
  assert.equal(rows[26].name, "Revati"); assert.equal(rows[26].lord, "Mercury");
});

test("yoga restrictions use named initial durations, full intervals, or the actual first half", () => {
  // Narada 56.212b-215a: Vishkambha/Vajra 3, Ganda/Atiganda 6,
  // Vyaghata 9, Shula 5 nadikas; Vyatipata/Vaidhriti whole; Parigha first half.
  const start = Date.parse("2026-09-08T22:00:00Z"), end = Date.parse("2026-09-10T01:20:00Z");
  for (const [index, minutes] of [[0,72],[14,72],[5,144],[9,144],[12,216],[8,120]]) {
    const r = yogaRestriction(index, start, end)!;
    assert.equal(r.end - r.start, minutes * 60000); assert.equal(r.rule, "initial-nadikas");
  }
  for (const i of [16,26]) assert.deepEqual(yogaRestriction(i,start,end), {start,end,rule:"whole",nadikas:null});
  assert.equal(yogaRestriction(18,start,end)!.end, Date.parse("2026-09-09T11:40:00Z"));
  for (const i of [1,2,3,4,6,7,10,11,13,15,17,19,20,21,22,23,24,25]) assert.equal(yogaRestriction(i,start,end), null);
  assert.equal(yogaRestriction(12,start,start+60000)!.end, start+60000);
  assert.equal(yogaDetails(24)!.deity, "Ashvins"); assert.equal(yogaDetails(25)!.deity, "Pitrs");
});

test("nadika durations remain elapsed time across a daylight-saving rollback", () => {
  const start = Date.parse("2024-11-03T05:30:00Z"), end = Date.parse("2024-11-04T05:30:00Z");
  const r = yogaRestriction(0,start,end)!;
  assert.equal(r.end, Date.parse("2024-11-03T06:42:00Z"));
  assert.equal(DateTime.fromMillis(start,{zone:"America/New_York"}).offset,-240);
  assert.equal(DateTime.fromMillis(r.end,{zone:"America/New_York"}).offset,-300);
});

test("interval lookup uses UTC half-open ownership across an index wrap and rejects ambiguity", () => {
  const instant = (utc:string) => ({utc, jd:0, scale:"TT" as const, local:null});
  const a: MonthInterval = {ref:"a",index:29,start:instant("2026-09-08T00:00:00.123Z"),end:instant("2026-09-08T12:00:00.123Z")};
  const b = {...a,ref:"b",index:0,start:a.end,end:instant("2026-09-09T01:00:00.123Z")};
  const boundary = Date.parse(a.end.utc);
  assert.equal(panchangaIntervalAt([a,b],"tithi",boundary-1),a);
  assert.equal(panchangaIntervalAt([a,b],"tithi",boundary),b);
  assert.equal(panchangaIntervalAt([a,b],"tithi",boundary+1),b);
  assert.equal(panchangaIntervalAt([a,b],"tithi",Date.parse(b.end.utc)),null);
  assert.equal(panchangaIntervalAt([a,a],"tithi",boundary-1),null);
  assert.equal(panchangaIntervalAt([{...a,index:30}],"tithi",boundary-1),null);
  assert.equal(panchangaIntervalAt([a,b],"tithi",NaN),null);
});

test("selected details agree with the native moment and remain available during polar day", () => {
  for (const latitude of [0,78]) {
    const result = calculateDayPanchanga({ date:"2026-06-21", time:"12:00:00", place:"Synthetic details",timezone:"Etc/UTC",latitude,longitude:15,nodes:"true" });
    const before = JSON.stringify(result), at = Date.parse(result.moment.instant.utc);
    const sun = result.moment.planets.find(p=>p.name==="Sun")!.longitude, moon = result.moment.planets.find(p=>p.name==="Moon")!.longitude;
    const actual = lunarPanchanga(sun,moon);
    const rows = Object.fromEntries(PANCHANGA_PARTS.map(part=>[part,panchangaIntervalAt(result.intervals[part],part,at)!]));
    assert.equal(tithiDetails(rows.tithi.index)!.number,actual.tithi);
    assert.equal(nakshatraDetails(rows.nakshatra.index)!.name,actual.nakshatra);
    assert.equal(yogaDetails(rows.yoga.index)!.name,actual.yoga);
    assert.equal(karanaDetails(rows.karana.index)!.name,actual.karana);
    assert.equal(JSON.stringify(result),before);
  }
});

test("detail domains reject invalid indexes and all displayed Sanskrit names have Russian copy", () => {
  for (const [lookup,count] of [[tithiDetails,30],[nakshatraDetails,27],[yogaDetails,27],[karanaDetails,60]] as const) {
    for (const bad of [-1,0.5,count,Infinity,NaN]) assert.equal(lookup(bad),null);
    for (let i=0;i<count;i++) { const row=lookup(i)!; assert.match(astrologyName(row.name,"ru"),/[А-Яа-я]/); assert.match(astrologyName(row.deity,"ru"),/[А-Яа-я]/); }
  }
  for (const [index,start,end] of [[27,0,1],[0,NaN,1],[0,0,Infinity],[0,1,1],[0,2,1]]) assert.equal(yogaRestriction(index,start,end),null);
});
