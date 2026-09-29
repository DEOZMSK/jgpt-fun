import assert from "node:assert/strict";
import test from "node:test";
import { initializeEngine } from "./astrology/swiss-runtime";
import { lahiriMotion } from "./astrology/positions-core";
import { locateTransitEvents } from "./astrology/transit-events";

// Read from Astrodienst's hosted swetest 2.10.03 on 2026-09-07, not generated
// by this project. Same Swiss engine family: integration evidence, not an
// independent astronomical model or acceptance of Drik/JHora conventions.
// Command: -eswe -p6 -sid1 -fPLS; -ut is UT1, not UTC. Compare the returned TT.
// Full URLs and precision are recorded in docs/astrology-transit-reference.md.
const references = [
  { id: "2025-direct-before", tt: 2460764.177974265, longitude: 329 + 59 / 60 + 59.9941 / 3600, speed: (7 * 60 + 14.8064) / 3600 },
  { id: "2025-direct-after", tt: 2460764.177997413, longitude: 330 + 0.0042 / 3600, speed: (7 * 60 + 14.8063) / 3600 },
  { id: "2017-retro-before", tt: 2457925.464893352, longitude: 240 + 0.0059 / 3600, speed: -(4 * 60 + 23.9626) / 3600 },
  { id: "2017-retro-after", tt: 2457925.464939648, longitude: 239 + 59 / 60 + 59.9937 / 3600, speed: -(4 * 60 + 23.9626) / 3600 },
  { id: "2023-position", tt: 2459962.106356239, longitude: 300 + 33.0043 / 3600, speed: (6 * 60 + 43.6361) / 3600 },
] as const;

test("Lahiri Saturn positions match five hosted Astrodienst samples at their printed TT and angular precision", () => {
  initializeEngine();
  for (const reference of references) {
    const actual = lahiriMotion(reference.tt, "Saturn", "true");
    // The reference rounds to 0.0001 arcsecond and 1e-9 Julian day.
    assert.ok(Math.abs(actual.longitude - reference.longitude) * 3600 < 0.0002, `${reference.id}: longitude`);
    assert.ok(Math.abs(actual.speed - reference.speed) * 3600 < 0.0002, `${reference.id}: speed`);
  }
});

test("direct and retrograde ingress roots lie inside externally observed sign-change brackets", () => {
  initializeEngine();
  for (const [before, after, from, to] of [[references[0], references[1], 10, 11], [references[2], references[3], 8, 7]] as const) {
    assert.equal(Math.floor(before.longitude / 30), from);
    assert.equal(Math.floor(after.longitude / 30), to);
    const events = locateTransitEvents(before.tt, after.tt, jd => lahiriMotion(jd, "Saturn", "true"));
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, "ingress");
    assert.equal(events[0].fromSign, from);
    assert.equal(events[0].toSign, to);
    assert.ok(events[0].jd > before.tt && events[0].jd < after.tt);
  }
});
