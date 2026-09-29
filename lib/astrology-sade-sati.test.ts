import assert from "node:assert/strict";
import test from "node:test";
import { locateSaturnIngresses, sadeSatiIntervals, sadeSatiPhase } from "./astrology/sade-sati";
import { calculateSaturnTransits } from "./astrology/saturn-transit-core";
import { emptySadeSatiWorkspace, normalizeSaturnInput, sadeSatiOutdated, type SaturnTransitResult } from "./astrology/saturn-transit-contract";
import { validSaturnTransits } from "./astrology/validate-saturn-transits";
import { initializeEngine } from "./astrology/swiss-runtime";
import { lahiriMotion } from "./astrology/positions-core";
import { calculateYearTransits } from "./astrology/year-transit-core";
import { calculateAstrology } from "./astrology/engine-core";
import { normalizeDegrees } from "./astrology/jyotish";
import { WorkspaceController, type SaturnTransitTransport } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

test("Sade Sati uses only the three whole signs around every natal Moon, including the zodiac seam", () => {
  for (let moon = 0; moon < 12; moon++) for (let saturn = 0; saturn < 12; saturn++) {
    const expected = saturn === moon ? 1 : saturn === (moon + 11) % 12 ? 12 : saturn === (moon + 1) % 12 ? 2 : null;
    assert.equal(sadeSatiPhase(saturn, moon), expected);
  }
  assert.throws(() => sadeSatiPhase(12, 0), RangeError);
  assert.throws(() => sadeSatiPhase(0, NaN), RangeError);
  const at = (day: number) => ({ jd: day, scale: "TT" as const, utc: `synthetic-${day}`, local: null });
  const signs = [10, 11, 10, 11, 0, 11, 0, 1, 2, 1, 2];
  const timeline = { start: at(0), end: at(110), initialLongitude: 315,
    events: signs.slice(1).map((toSign, i) => ({ ref: `saturn-ingress/${i}`, kind: "ingress", at: at((i + 1) * 10), fromSign: signs[i], toSign,
      direction: toSign === (signs[i] + 1) % 12 ? "direct" : "retrograde" })) } as SaturnTransitResult;
  const rows = sadeSatiIntervals(timeline, 29.999);
  assert.deepEqual(rows.map(r => [r.start.jd, r.end.jd, r.phase, r.episode]), [
    [10, 20, 12, 1], [30, 40, 12, 2], [40, 50, 1, 2], [50, 60, 12, 2], [60, 70, 1, 2], [70, 80, 2, 2], [90, 100, 2, 3]
  ]);
  assert.equal(rows.at(-1)!.entryDirection, "retrograde");
  assert.ok(rows.every(r => !r.clippedStart && !r.clippedEnd));
  const clipped = sadeSatiIntervals({ ...timeline, initialLongitude: 0, events: [] }, 0);
  assert.equal(clipped.length, 1); assert.ok(clipped[0].clippedStart && clipped[0].clippedEnd);
  assert.throws(() => sadeSatiIntervals(timeline, 360), RangeError);
  const seam = locateSaturnIngresses(0, 730, jd => ({ longitude: normalizeDegrees(30 + (jd - 365) * 0.01), speed: 0.01 }));
  assert.equal(seam.length, 1, "overlap does not duplicate the event on a window edge");
  assert.ok(Math.abs(seam[0].jd - 365) * 86400 <= 0.1);
});

const input = { fromYear: 2020, toYear: 2035, timezone: "Etc/UTC" };
let cached: SaturnTransitResult | undefined;
const timeline = () => structuredClone(cached ??= calculateSaturnTransits(input));

test("native Saturn range retains all crossings and agrees with the yearly solver within its bracket precision", () => {
  const r = timeline(); assert.ok(validSaturnTransits(r)); initializeEngine();
  assert.ok(r.events.some(e => e.direction === "retrograde"));
  for (const e of r.events) {
    assert.equal(Math.floor(lahiriMotion(e.at.jd - 1 / 86400, "Saturn", "mean").longitude / 30), e.fromSign);
    assert.equal(Math.floor(lahiriMotion(e.at.jd + 1 / 86400, "Saturn", "mean").longitude / 30), e.toSign);
  }
  const y = calculateYearTransits({ year: 2025, timezone: input.timezone, nodes: "true" }).events.filter(e => e.planet === "Saturn" && e.kind === "ingress");
  const same = r.events.filter(e => e.at.utc.startsWith("2025"));
  assert.equal(same.length, y.length);
  for (let i = 0; i < same.length; i++) { assert.equal(same[i].toSign, y[i].toSign); assert.ok(Math.abs(same[i].at.jd - y[i].at.jd) * 86400 < 0.11); }
  for (let moon = 0; moon < 12; moon++) for (const row of sadeSatiIntervals(r, moon * 30)) {
    const saturn = lahiriMotion((row.start.jd + row.end.jd) / 2, "Saturn", "mean");
    assert.equal(Math.floor(saturn.longitude / 30), row.saturnSign);
    assert.equal(sadeSatiPhase(row.saturnSign, moon), row.phase);
  }
});

test("the entire supported 1900-2100 range is bounded and stored validation rejects broken continuity", () => {
  const full = calculateSaturnTransits({ fromYear: 1900, toYear: 2100, timezone: "Asia/Bishkek" });
  assert.ok(validSaturnTransits(full)); assert.ok(full.events.length > 80 && full.events.length < 1000);
  assert.equal(full.start.local!.dateTime.slice(0, 10), "1900-01-01");
  assert.equal(full.end.local!.dateTime.slice(0, 10), "2101-01-01");
  const historical = structuredClone(full); historical.input.timezone = "Former/Zone";
  assert.ok(validSaturnTransits(historical), "old clock labels do not require a currently installed IANA zone");
  for (const bad of [{ fromYear: 1899 }, { toYear: 2101 }, { fromYear: 2036 }, { timezone: "Former/Zone" }, { nodes: "true" }]) assert.throws(() => normalizeSaturnInput({ ...input, ...bad }));
  for (const mutate of [
    (r: SaturnTransitResult) => { r.events[0].ref = "outside"; },
    (r: SaturnTransitResult) => { r.events[0].bracket[1] += 1; },
    (r: SaturnTransitResult) => { r.events[0].toSign = r.events[0].fromSign; },
    (r: SaturnTransitResult) => { r.events.splice(1, 1); r.events.forEach((e, n) => e.ref = `saturn-ingress/${n}`); },
    (r: SaturnTransitResult) => { r.events[0].at = { ...r.events[0].at, jd: r.start.jd - 1 }; },
    (r: SaturnTransitResult) => { r.initialLongitude = NaN; }
  ]) { const r = timeline(); mutate(r); assert.equal(validSaturnTransits(r), false); }
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { if (this.fail) throw new WorkspaceError("storage_quota"); if (revision !== this.revision) throw new WorkspaceError("storage_conflict"); this.data = structuredClone(data); return ++this.revision; }
  close() {}
}
const make = (store: Store, transport: SaturnTransitTransport = async i => calculateSaturnTransits(i)) => new WorkspaceController(store, async i => calculateAstrology(i), () => new Date("2026-09-07T12:00:00Z"), () => crypto.randomUUID(), undefined, undefined, undefined, transport);

test("Sade Sati state persists independently, preserves natal snapshots and accepts old documents", async () => {
  const store = new Store(), c = make(store); await c.initialize(); await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  await c.dispatch({ type: "calculate", kind: "astrology" });
  assert.equal(c.getSnapshot().error, null);
  const natal = structuredClone(c.getSnapshot().results.astrology);
  await c.dispatch({ type: "sade-sati-use-chart" });
  assert.deepEqual(c.getSnapshot().data.ui.sadeSati.draft, { fromYear: "2000", toYear: "2100", timezone: "Asia/Bishkek" });
  await c.dispatch({ type: "sade-sati-edit", patch: { fromYear: "2020", toYear: "2035", timezone: "Etc/UTC" } });
  await c.dispatch({ type: "sade-sati-calculate" }); assert.equal(c.getSnapshot().error, null);
  assert.deepEqual(c.getSnapshot().results.astrology, natal); validateWorkspace(c.getSnapshot().data);
  await c.dispatch({ type: "select-panel", panel: "sade-sati" });
  await c.dispatch({ type: "select-panel", panel: "periods" });
  const next = make(store); await next.initialize(); assert.deepEqual(next.getSnapshot().data.ui.sadeSati, c.getSnapshot().data.ui.sadeSati);
  await c.dispatch({ type: "sade-sati-edit", patch: { toYear: "2036" } }); assert.ok(sadeSatiOutdated(c.getSnapshot().data.ui.sadeSati));
  const old = structuredClone(store.data) as unknown as { ui: Record<string, unknown> }; delete old.ui.sadeSati;
  assert.deepEqual(decodeWorkspace(old).ui.sadeSati, emptySadeSatiWorkspace());
});

test("Saturn responses are validated, stale requests rejected and failed writes do not overwrite durable data", async () => {
  const store = new Store(), c = make(store, async () => timeline()); await c.initialize();
  await c.dispatch({ type: "sade-sati-edit", patch: { fromYear: "2020", toYear: "2035", timezone: "Etc/UTC" } });
  store.fail = true; await c.dispatch({ type: "sade-sati-calculate" }); assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.equal(store.data.ui.sadeSati.result, null);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); assert.ok(store.data.ui.sadeSati.result);
  let resolve!: (r: SaturnTransitResult) => void;
  const delayed = make(store, () => new Promise(r => { resolve = r; })); await delayed.initialize(); const p = delayed.dispatch({ type: "sade-sati-calculate" });
  await delayed.dispatch({ type: "sade-sati-edit", patch: { toYear: "2036" } }); resolve(timeline()); await p;
  assert.equal(delayed.getSnapshot().error, "calculation_changed");
  const forged = make(store, async () => { const r = timeline(); r.input.fromYear = 2021; return r; }); await forged.initialize();
  await forged.dispatch({ type: "sade-sati-calculate" }); assert.equal(forged.getSnapshot().error, "invalid_saturn_timeline");
});
