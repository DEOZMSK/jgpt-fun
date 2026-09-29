import assert from "node:assert/strict";
import test from "node:test";
import { locateTransitEvents } from "./astrology/transit-events";
import { normalizeDegrees } from "./astrology/jyotish";
import { calculateYearTransits } from "./astrology/year-transit-core";
import { EVENT_PLANETS, emptyYearTransitWorkspace, normalizeYearTransitInput, yearTransitOutdated, type YearTransitResult } from "./astrology/year-transit-contract";
import { validYearTransits } from "./astrology/validate-year-transits";
import { initializeEngine } from "./astrology/swiss-runtime";
import { lahiriMotion } from "./astrology/positions-core";
import { WorkspaceController, type YearTransitTransport } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

test("event solver handles the zodiac seam, both directions, station-split returns and boundary tangency", () => {
  const direct = locateTransitEvents(0, 1, t => ({ longitude: normalizeDegrees(359 + 2 * t), speed: 2 }));
  assert.equal(direct.length, 1); assert.equal(direct[0].jd, 0.5); assert.equal(direct[0].fromSign, 11); assert.equal(direct[0].toSign, 0);
  const retro = locateTransitEvents(0, 1, t => ({ longitude: normalizeDegrees(1 - 2 * t), speed: -2 }));
  assert.equal(retro.length, 1); assert.equal(retro[0].fromSign, 0); assert.equal(retro[0].toSign, 11);
  const loop = locateTransitEvents(0, 1, t => ({ longitude: normalizeDegrees(359 + 8 * t - 8 * t * t), speed: 8 - 16 * t }));
  assert.deepEqual(loop.map(e => [e.kind, e.direction]), [["ingress", "direct"], ["station", "retrograde"], ["ingress", "retrograde"]]);
  assert.ok(Math.abs(loop[0].jd - (1 - Math.sqrt(0.5)) / 2) < 0.1 / 86400);
  assert.ok(Math.abs(loop[2].jd - (1 + Math.sqrt(0.5)) / 2) < 0.1 / 86400);
  const touch = locateTransitEvents(0, 1, t => ({ longitude: 29 + 4 * t - 4 * t * t, speed: 4 - 8 * t }));
  assert.deepEqual(touch.map(e => e.kind), ["station"]);
  assert.equal(locateTransitEvents(0, 1, t => ({ longitude: 30 + t, speed: 1 }))[0].jd, 0, "start is included");
  assert.equal(locateTransitEvents(0, 1, t => ({ longitude: 29 + t, speed: 1 })).length, 0, "end is excluded");
  assert.throws(() => locateTransitEvents(0, 371, () => ({ longitude: 0, speed: 1 })), RangeError);
  assert.throws(() => locateTransitEvents(0, 1, () => ({ longitude: NaN, speed: 1 })));
  assert.throws(() => locateTransitEvents(0, 1, () => ({ longitude: 0, speed: 99 })));
});

const input = { year: 2026, timezone: "Etc/UTC", nodes: "true" as const };
let cached: YearTransitResult | undefined;
const timeline = () => structuredClone(cached ??= calculateYearTransits(input));

test("native year events keep count/order under doubled scan density and bracket actual direction/sign changes", () => {
  const r = timeline(); assert.ok(validYearTransits(r)); assert.ok(r.events.length > 200);
  initializeEngine();
  for (const planet of EVENT_PLANETS) {
    const normal = r.events.filter(e => e.planet === planet), dense = locateTransitEvents(r.start.jd, r.end.jd, jd => lahiriMotion(jd, planet, input.nodes), 1 / 16);
    assert.equal(dense.length, normal.length, planet);
    for (let n = 0; n < normal.length; n++) {
      const e = normal[n], refined = dense[n];
      assert.equal(e.kind, refined.kind); assert.equal(e.direction, refined.direction); assert.equal(e.fromSign, refined.fromSign); assert.equal(e.toSign, refined.toSign);
      assert.ok(Math.abs(e.at.jd - refined.jd) * 86400 <= 0.11, `${planet}/${n}`);
      const before = lahiriMotion(e.at.jd - 1 / 86400, planet, input.nodes), after = lahiriMotion(e.at.jd + 1 / 86400, planet, input.nodes);
      if (e.kind === "ingress") { assert.equal(Math.floor(before.longitude / 30), e.fromSign); assert.equal(Math.floor(after.longitude / 30), e.toSign); }
      else { assert.ok(before.speed * after.speed < 0); assert.equal(after.speed < 0 ? "retrograde" : "direct", e.direction); }
    }
  }
  assert.equal(r.events.filter(e => e.planet === "Mercury" && e.kind === "station").length, 6);
  const mean = calculateYearTransits({ ...input, nodes: "mean" }); assert.ok(validYearTransits(mean));
  assert.equal(mean.events.filter(e => ["Rahu", "Ketu"].includes(e.planet) && e.kind === "station").length, 0);
});

test("year ranges retain historical/DST offsets and reject corrupt event continuity", () => {
  for (const [year, timezone] of [[1900, "Asia/Bishkek"], [1972, "Etc/UTC"], [2024, "America/New_York"], [2100, "Pacific/Apia"]] as const) assert.ok(validYearTransits(calculateYearTransits({ year, timezone, nodes: "mean" })), `${year}/${timezone}`);
  for (const bad of [{ year: 2101 }, { year: "2026" }, { timezone: "Etc/Unknown" }, { extra: "x" }]) assert.throws(() => normalizeYearTransitInput({ ...input, ...bad }));
  const edits: ((r: YearTransitResult) => void)[] = [
    r => { r.events[0].ref = "external"; }, r => { r.events[0].toSign = r.events[0].fromSign; }, r => { r.events[0].bracket[1] += 1; },
    r => { r.events.reverse(); }, r => { r.events[0].at = { ...r.events[0].at, jd: r.start.jd - 1 }; }, r => { r.initial[0].speed = Infinity; },
    r => { r.settings.swissMode = 29 as never; }, r => { r.input.year = 2025; }, r => { r.events = r.events.filter(e => e.planet !== "Ketu"); }
  ];
  for (const edit of edits) { const r = timeline(); edit(r); assert.equal(validYearTransits(r), false); }
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { if (this.fail) throw new WorkspaceError("storage_quota"); if (revision !== this.revision) throw new WorkspaceError("storage_conflict"); this.data = structuredClone(data); return ++this.revision; }
  close() {}
}
const make = (s: Store, transport: YearTransitTransport = async i => calculateYearTransits(i)) => new WorkspaceController(s, undefined, () => new Date("2026-09-07T12:00:00.000Z"), () => crypto.randomUUID(), undefined, undefined, transport);

test("year controls preserve chart state, save filters, reload and copy an explicitly rounded moment to transit", async () => {
  const store = new Store(), c = make(store); await c.initialize();
  await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  const profiles = structuredClone(c.getSnapshot().data.profiles);
  await c.dispatch({ type: "year-transits-use-profile" }); assert.equal(c.getSnapshot().data.ui.yearTransits.draft.year, "2026");
  await c.dispatch({ type: "year-transits-calculate" }); assert.equal(c.getSnapshot().error, null);
  await c.dispatch({ type: "year-transits-filter", planet: "Mercury", kind: "station" });
  validateWorkspace(c.getSnapshot().data);
  const reloaded = make(store); await reloaded.initialize(); assert.deepEqual(reloaded.getSnapshot().data.ui.yearTransits, c.getSnapshot().data.ui.yearTransits);
  const e = c.getSnapshot().data.ui.yearTransits.result!.events.find(e => e.planet === "Mercury" && e.kind === "station")!;
  await c.dispatch({ type: "year-transits-open", ref: e.ref }); assert.equal(c.getSnapshot().data.ui.workbench.panel, "transits");
  assert.equal(c.getSnapshot().data.ui.transit.draft.timezone, "Asia/Bishkek"); assert.deepEqual(c.getSnapshot().data.profiles, profiles);
  await c.dispatch({ type: "year-transits-edit", patch: { year: "2027" } }); assert.ok(yearTransitOutdated(c.getSnapshot().data.ui.yearTransits));
  const old = structuredClone(store.data) as unknown as { ui: Record<string, unknown> }; delete old.ui.yearTransits;
  assert.deepEqual(decodeWorkspace(old).ui.yearTransits, emptyYearTransitWorkspace());
  await c.dispatch({ type: "year-transits-open", ref: "https://outside.invalid" }); assert.equal(c.getSnapshot().error, "invalid_action");
});

test("year request rejects stale/forged results and failed writes preserve the previous durable timeline", async () => {
  const store = new Store(), c = make(store); await c.initialize(); await c.dispatch({ type: "year-transits-edit", patch: { year: "2026", timezone: "Etc/UTC", nodes: "true" } }); await c.dispatch({ type: "year-transits-calculate" });
  const old = structuredClone(store.data.ui.yearTransits.result); await c.dispatch({ type: "year-transits-edit", patch: { nodes: "mean" } });
  store.fail = true; await c.dispatch({ type: "year-transits-calculate" }); assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.deepEqual(store.data.ui.yearTransits.result, old);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); assert.equal(store.data.ui.yearTransits.result!.input.nodes, "mean");
  let resolve!: (v: YearTransitResult) => void;
  const delayed = make(store, () => new Promise(r => { resolve = r; })); await delayed.initialize(); const p = delayed.dispatch({ type: "year-transits-calculate" });
  await delayed.dispatch({ type: "year-transits-edit", patch: { year: "2027" } }); resolve(calculateYearTransits({ ...input, nodes: "mean" })); await p; assert.equal(delayed.getSnapshot().error, "calculation_changed");
  const forged = make(store, async i => calculateYearTransits({ ...i, year: 2028 })); await forged.initialize(); await forged.dispatch({ type: "year-transits-calculate" }); assert.equal(forged.getSnapshot().error, "invalid_transit_events");
});
