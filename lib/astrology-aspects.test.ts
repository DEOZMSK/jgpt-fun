import assert from "node:assert/strict";
import test from "node:test";
import { chartAspects, emptyAspectSelection, grahaAspectSigns, isAspectSelection, rashiAspectSigns } from "./astrology/aspects";
import type { PlanetName, VargaChart } from "./astrology/contracts";
import { WorkspaceController, type WorkspaceAction } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";
import { calculateAstrology } from "./astrology/engine-core";

test("graha and rashi drishti reproduce Rao chapter10 examples and retain their separate node conventions", () => {
  // Example34: Jupiter Gemini -> Libra/Sagittarius/Aquarius, Mars Leo ->
  // Scorpio/Aquarius/Pisces, Saturn Sagittarius -> Aquarius/Gemini/Virgo.
  assert.deepEqual(grahaAspectSigns("Jupiter", 2), [6, 8, 10]);
  assert.deepEqual(grahaAspectSigns("Mars", 4), [7, 10, 11]);
  assert.deepEqual(grahaAspectSigns("Saturn", 8), [10, 2, 5]);
  assert.deepEqual(grahaAspectSigns("Sun", 1), [7]);
  assert.deepEqual(rashiAspectSigns(0), [4, 7, 10]);
  assert.deepEqual(rashiAspectSigns(1), [3, 6, 9]);
  assert.deepEqual(rashiAspectSigns(2), [5, 8, 11]);
  for (let sign = 0; sign < 12; sign++) {
    assert.deepEqual(grahaAspectSigns("Rahu", sign), []); assert.deepEqual(grahaAspectSigns("Ketu", sign), []);
    const targets = rashiAspectSigns(sign);
    assert.equal(targets.length, 3); assert.ok(!targets.includes(sign));
    for (const target of targets) assert.ok(rashiAspectSigns(target).includes(sign));
  }
  assert.throws(() => rashiAspectSigns(12)); assert.throws(() => grahaAspectSigns("Sun", -1));
});

const placements: [PlanetName, number][] = [["Sun", 1], ["Moon", 4], ["Mars", 7], ["Mercury", 1], ["Jupiter", 2], ["Venus", 11], ["Saturn", 8], ["Rahu", 7], ["Ketu", 1]];
const chart: VargaChart = { method: "synthetic-test-chart", ascendant: 215,
  planets: placements.map(([name, sign]) => ({ name, sign, longitude: sign * 30 + 5 })) };
test("relations retain sign/house provenance, node recipients and symbolic varga identity without changing the snapshot", () => {
  const original = structuredClone(chart), g = chartAspects(chart, emptyAspectSelection());
  assert.equal(g.rows.length, 13); assert.equal(g.coordinateKind, "natal-sidereal");
  const sun = g.rows.find(row => row.source === "Sun")!;
  assert.equal(sun.targetSign, 7); assert.equal(sun.targetHouse, 1);
  assert.deepEqual(sun.occupants.map(p => p.name), ["Lagna", "Mars", "Rahu"]);
  assert.ok(sun.occupants.every(p => p.ref.startsWith("charts/D1/")));
  assert.equal(new Set(g.rows.map(row => row.ref)).size, 13);
  const r = chartAspects(chart, { method: "rashi-sign-v1", varga: "D9" });
  assert.equal(r.rows.length, 27); assert.equal(r.coordinateKind, "divisional-symbolic");
  assert.equal(r.chartMethod, chart.method); assert.ok(r.rows.some(row => row.source === "Rahu"));
  assert.ok(r.rows.every(row => row.sourceRef.startsWith("charts/D9/")));
  assert.deepEqual(chart, original);
  assert.throws(() => chartAspects({ ...chart, planets: [...chart.planets.slice(1), chart.planets[1]] }, emptyAspectSelection()));
  assert.throws(() => chartAspects({ ...chart, ascendant: Number.NaN }, emptyAspectSelection()));
  assert.equal(isAspectSelection({ ...emptyAspectSelection(), orb: 5 }), false);
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { if (this.fail) throw new WorkspaceError("storage_quota"); if (revision !== this.revision) throw new WorkspaceError("storage_conflict"); this.data = structuredClone(data); return ++this.revision; }
  close() {}
}
test("aspect selection survives storage, preserves chart/dasha results and rejects invalid actions", async () => {
  const store = new Store(), c = new WorkspaceController(store, async input => calculateAstrology(input));
  await c.initialize(); await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  await c.dispatch({ type: "calculate", kind: "astrology" }); await c.dispatch({ type: "save-calculation" });
  assert.equal(c.getSnapshot().error, null);
  const original = structuredClone(c.getSnapshot().data.calculations);
  const action = { type: "select-aspects", selection: { method: "rashi-sign-v1", varga: "D9" } } as const;
  await c.dispatch(action); assert.equal(c.getSnapshot().error, null);
  await c.dispatch({ type: "select-dasha-system", system: "yogini" });
  assert.deepEqual(c.getSnapshot().data.ui.aspects, action.selection);
  await c.dispatch(action);
  await c.dispatch({ type: "select-aspects", selection: { method: "run-code", varga: "D1" } } as unknown as WorkspaceAction);
  assert.equal(c.getSnapshot().error, "invalid_action"); assert.deepEqual(c.getSnapshot().data.ui.aspects, action.selection);
  assert.deepEqual(c.getSnapshot().data.calculations, original);
  const old = JSON.parse(JSON.stringify(store.data)); delete old.ui.aspects;
  const migrated = decodeWorkspace(old);
  assert.deepEqual(migrated.ui.aspects, emptyAspectSelection()); assert.deepEqual(migrated.calculations, original);
  assert.ok(!Object.hasOwn(old.ui, "aspects"));
  store.fail = true; await c.dispatch({ type: "select-aspects", selection: emptyAspectSelection() });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.deepEqual(store.data.ui.aspects, action.selection);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); await c.dispatch(action); assert.equal(c.getSnapshot().storageError, null); validateWorkspace(store.data);
  const restored = new WorkspaceController(store); await restored.initialize();
  assert.deepEqual(restored.getSnapshot().data.ui.aspects, action.selection);
  c.dispose(); restored.dispose();
});
