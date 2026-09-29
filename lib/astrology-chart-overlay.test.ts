import assert from "node:assert/strict";
import test from "node:test";
import { calculateAstrology } from "./astrology/engine-core";
import { calculateTransit } from "./astrology/transit-core";
import { chartOverlay, overlayTransitDraft, overlayTransitReady } from "./astrology/chart-overlay";
import { chartTextRows, type ChartTextToken } from "./astrology/chart-text-layout";
import { emptyTransitWorkspace, transitInput } from "./astrology/transit-contract";
import { NORTH_CELLS, NORTH_SIGN_LABELS } from "./astrology/chart-geometry";
import { decodeWorkspace, emptyWorkspace, sampleDraft, type WorkspaceData } from "./local-workspace/model";
import { WorkspaceController, type TransitTransport, type WorkspaceAction } from "./local-workspace/controller";
import type { WorkspaceStorage } from "./local-workspace/storage";

const birth = { date: "2000-01-01", time: "12:00:00", place: "Synthetic UTC", timezone: "Etc/UTC", latitude: 0, longitude: 0, nodes: "true", accuracy: "exact" } as const;
const natal = calculateAstrology(birth);
class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0;
  async load() { return { data: decodeWorkspace(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { assert.equal(revision, this.revision); this.data = decodeWorkspace(structuredClone(data)); return ++this.revision; }
  close() {}
}
async function ready(transport: TransitTransport = async input => calculateTransit(input)) {
  const store = new Store(), c = new WorkspaceController(store, async input => calculateAstrology(input), () => new Date("2026-09-07T12:00:00Z"), undefined, undefined, transport);
  await c.initialize(); await c.dispatch({ type: "create-profile", draft: { ...sampleDraft(), place: birth.place, timezone: birth.timezone, latitude: "0", longitude: "0" } });
  await c.dispatch({ type: "calculate", kind: "astrology" }); await c.dispatch({ type: "save-calculation" });
  return { c, store };
}

test("overlay aspects use the existing seven-planet D1 method without changing natal positions", () => {
  const before = structuredClone(natal), layer = chartOverlay(natal, "aspects", emptyTransitWorkspace())!;
  assert.equal(layer.mode, "aspects"); assert.equal(layer.markers.length, 13);
  const mars = natal.planets.find(p => p.name === "Mars")!;
  assert.deepEqual(layer.markers.filter(p => p.name === "Mars").map(p => p.sign), [3, 6, 7].map(offset => (mars.sign + offset) % 12));
  assert.equal(layer.markers.some(p => p.name === "Rahu" || p.name === "Ketu"), false);
  assert.equal(new Set(layer.markers.map(p => p.ref)).size, layer.markers.length);
  assert.deepEqual(natal, before); assert.equal(chartOverlay(natal, "none", emptyTransitWorkspace()), null);
});

test("transit overlay keeps natal orientation and rejects stale or mismatched transit settings", () => {
  const draft = overlayTransitDraft(natal, "2026-09-07T12:00:00.000Z"), transit = { ...emptyTransitWorkspace(), draft, result: calculateTransit(transitInput(draft)) };
  const layer = chartOverlay(natal, "transits", transit)!;
  assert.equal(layer.markers.length, 9); assert.deepEqual(layer.markers.map(p => [p.name, p.sign]), transit.result.planets.map(p => [p.name, p.sign]));
  assert.notEqual(natal.ascendant, transit.result.ascendant);
  assert.equal(overlayTransitReady(natal, { ...transit, draft: { ...draft, time: "13:00:00" } }), false);
  assert.equal(chartOverlay(natal, "transits", { ...transit, draft: { ...draft, nodes: "mean" } }), null);
  assert.equal(chartOverlay({ ...natal, birth: { ...natal.birth, longitude: 1 } }, "transits", transit), null);
});

test("UTC overlay moments distinguish both DST occurrences and reject invalid dates", () => {
  const ny = { ...natal, birth: { ...natal.birth, timezone: "America/New_York" } };
  const first = overlayTransitDraft(ny, "2026-11-01T05:30:00Z"), second = overlayTransitDraft(ny, "2026-11-01T06:30:00Z");
  assert.equal(first.time, "01:30:00"); assert.equal(second.time, "01:30:00");
  assert.equal(first.utcOffsetMinutes, "-240"); assert.equal(second.utcOffsetMinutes, "-300");
  assert.notEqual(calculateTransit(transitInput(first)).instant.utc, calculateTransit(transitInput(second)).instant.utc);
  for (const value of ["now", "2026-02-30T00:00:00Z", "2026-01-01", "2200-01-01T12:00:00Z"]) assert.throws(() => overlayTransitDraft(natal, value));
});

test("switches are mutually exclusive, reusable and persistent without changing saved charts", async () => {
  let calls = 0; const { c, store } = await ready(async input => { calls++; return calculateTransit(input); });
  const saved = structuredClone(store.data.calculations);
  await c.dispatch({ type: "set-chart-overlay", mode: "aspects" }); assert.equal(c.getSnapshot().data.ui.chartOverlay, "aspects"); assert.equal(calls, 0);
  await c.dispatch({ type: "set-chart-overlay", mode: "transits" }); assert.equal(c.getSnapshot().data.ui.chartOverlay, "transits"); assert.equal(calls, 1);
  await c.dispatch({ type: "set-chart-overlay", mode: "none" }); assert.equal(c.getSnapshot().data.ui.chartOverlay, "none");
  await c.dispatch({ type: "set-chart-overlay", mode: "transits" }); assert.equal(calls, 1);
  await c.dispatch({ type: "overlay-transit-at", utc: "2026-09-08T00:00:00Z" }); assert.equal(calls, 2); assert.equal(c.getSnapshot().data.ui.transit.result?.instant.utc, "2026-09-08T00:00:00.000Z");
  assert.deepEqual(store.data.calculations, saved);
  const restored = new WorkspaceController(store); await restored.initialize(); assert.equal(restored.getSnapshot().data.ui.chartOverlay, "transits");
  await c.dispatch({ type: "new-profile" }); assert.equal(c.getSnapshot().data.ui.chartOverlay, "none"); c.dispose(); restored.dispose();
});

test("invalid actions and failed transit calculations never display an old layer for a new moment", async () => {
  let fail = false; const { c } = await ready(async input => { if (fail) throw new Error("Synthetic outage"); return calculateTransit(input); });
  await c.dispatch({ type: "set-chart-overlay", mode: "transits" }); fail = true;
  await c.dispatch({ type: "overlay-transit-at", utc: "2026-09-09T12:00:00Z" }); assert.equal(c.getSnapshot().error, "operation_failed");
  assert.equal(chartOverlay(c.getSnapshot().results.astrology!.kind === "astrology" ? c.getSnapshot().results.astrology!.result as typeof natal : natal, "transits", c.getSnapshot().data.ui.transit), null);
  await c.dispatch({ type: "set-chart-overlay", mode: "both" } as unknown as WorkspaceAction); assert.equal(c.getSnapshot().error, "invalid_action");
  await c.dispatch({ type: "set-chart-overlay", mode: "aspects", extra: true } as unknown as WorkspaceAction); assert.equal(c.getSnapshot().error, "invalid_action");
  await c.dispatch({ type: "new-profile" }); await c.dispatch({ type: "set-chart-overlay", mode: "aspects" }); assert.equal(c.getSnapshot().error, "calculation_missing"); c.dispose();
});

test("old workspace state defaults both switches off without altering stored snapshots", async () => {
  const { c, store } = await ready(), old = structuredClone(store.data) as unknown as { ui: Record<string, unknown>; calculations: unknown };
  delete old.ui.chartOverlay; const bytes = JSON.stringify(old); const decoded = decodeWorkspace(old);
  assert.equal(decoded.ui.chartOverlay, "none"); assert.deepEqual(decoded.calculations, old.calculations); assert.equal(JSON.stringify(old), bytes); c.dispose();
});

test("chart typography lays out every natal and overlay token in both chart geometries", () => {
  const shapes = [...NORTH_CELLS.map((cell, i) => ({ points: cell.points, reserved: NORTH_SIGN_LABELS[i] })), { points: "0,26 100,26 100,100 0,100", reserved: undefined }];
  for (const shape of shapes) for (let count = 1; count <= 19; count++) {
    const tokens: ChartTextToken[] = Array.from({ length: count }, (_, i) => ({ label: i === 0 ? "Asc" : "Mo", layer: i < 10 ? "natal" : "transits", ref: String(i) }));
    let rows: ReturnType<typeof chartTextRows> = [];
    assert.doesNotThrow(() => { rows = chartTextRows(shape.points, tokens, shape.reserved); }, `${shape.points}: ${count} labels`);
    assert.deepEqual(rows.flatMap(row => row.tokens), tokens);
    assert.ok(rows.every(row => row.fontSize >= 10 && row.tokens.every(token => token.layer === row.tokens[0].layer)));
    assert.ok(rows.every((row, i) => !i || row.y > rows[i - 1].y));
  }
});
