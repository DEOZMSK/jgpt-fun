import assert from "node:assert/strict";
import test from "node:test";
import { ashtakavarga, emptyAvSelection, isAvSelection } from "./astrology/ashtakavarga";
import type { PlanetName, VargaChart } from "./astrology/contracts";
import { WorkspaceController, type WorkspaceAction } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";
import { calculateAstrology } from "./astrology/engine-core";

const names: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const makeChart = (signs: number[], ascendantSign = 5): VargaChart => ({ method: "synthetic-sign-fixture", ascendant: ascendantSign * 30 + 5,
  planets: names.map((name, i) => ({ name, longitude: signs[i] * 30 + 5, sign: signs[i] })) });
// Rao chapter12 exercises19/20, chart6: only its published signs are needed.
const reference = makeChart([2, 11, 2, 2, 4, 0, 4, 6, 0]);
const expected = [
  [5,3,5,3,4,4,2,3,5,4,5,5], [3,2,5,3,6,3,4,5,5,5,3,5],
  [4,3,4,3,4,3,2,5,1,3,3,4], [7,4,7,4,4,3,4,4,4,3,6,4],
  [4,3,5,6,3,7,4,3,5,6,5,5], [8,7,4,3,3,2,4,6,4,4,4,3],
  [3,3,4,3,2,3,2,3,4,5,3,4]
];
test("all seven BAVs and SAV reproduce the published Rao exercise, with independent totals", () => {
  const result = ashtakavarga(reference, "D1");
  assert.deepEqual(result.bav.map(row => row.points), expected);
  assert.deepEqual(result.sav.points, [34,25,34,25,26,25,22,29,28,30,29,30]);
  assert.deepEqual(result.bav.map(row => row.total), [48,49,39,54,56,52,39]);
  assert.equal(result.sav.total, 337);
  assert.deepEqual(result.bav.find(row => row.planet === "Mercury")!.prastara.filter(row => row.points[0]).map(row => row.name), ["Sun", "Moon", "Mars", "Mercury", "Venus", "Saturn", "Lagna"]);
});

test("point provenance is immutable, sign-relative, node-independent and explicitly unreduced", () => {
  const original = structuredClone(reference), d9 = ashtakavarga(reference, "D9");
  assert.equal(d9.coordinateKind, "divisional-symbolic"); assert.equal(d9.reduction, "none");
  assert.ok(d9.bav.every(row => row.prastara.every(p => p.ref.startsWith("charts/D9/"))));
  assert.equal(d9.bav[0].prastara.length, 8);
  const changedNodes = makeChart([2,11,2,2,4,0,4,7,1]);
  assert.deepEqual(ashtakavarga(changedNodes, "D9").bav, d9.bav);
  for (let shift = 0; shift < 12; shift++) {
    const moved = makeChart(reference.planets.map(p => (p.sign + shift) % 12), (5 + shift) % 12);
    const actual = ashtakavarga(moved, "D1");
    for (let sign = 0; sign < 12; sign++) assert.equal(actual.sav.points[(sign + shift) % 12], d9.sav.points[sign]);
    assert.equal(actual.sav.total, 337);
  }
  assert.deepEqual(reference, original);
  assert.equal(isAvSelection(emptyAvSelection()), true);
  assert.equal(isAvSelection({ ...emptyAvSelection(), target: "Rahu" }), false);
  assert.equal(isAvSelection({ ...emptyAvSelection(), execute: "code" }), false);
  assert.throws(() => ashtakavarga({ ...reference, ascendant: NaN }, "D1"));
  assert.throws(() => ashtakavarga({ ...reference, planets: [...reference.planets.slice(1), reference.planets[1]] }, "D1"));
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) {
    if (this.fail) throw new WorkspaceError("storage_quota");
    if (revision !== this.revision) throw new WorkspaceError("storage_conflict");
    this.data = structuredClone(data); return ++this.revision;
  }
  close() {}
}
test("AV selection preserves results and language-independent state; context is bounded to the selected profile and target", async () => {
  const store = new Store(), c = new WorkspaceController(store, async input => calculateAstrology(input));
  await c.initialize(); await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  await c.dispatch({ type: "calculate", kind: "astrology" }); await c.dispatch({ type: "save-calculation" });
  const original = structuredClone(c.getSnapshot().data.calculations);
  const action = { type: "select-ashtakavarga", selection: { ...emptyAvSelection(), varga: "D9", target: "Mercury" } } as const;
  await c.dispatch(action); assert.equal(c.getSnapshot().error, null);
  const reductionAction = { ...action, selection: { ...action.selection, stage: "ekadhipatya" as const } };
  await c.dispatch(reductionAction);
  assert.deepEqual(c.getSnapshot().data.calculations, original);
  const reductionRestored = new WorkspaceController(store); await reductionRestored.initialize();
  assert.equal(reductionRestored.getSnapshot().data.ui.ashtakavarga.stage, "ekadhipatya"); reductionRestored.dispose();
  await c.dispatch({ type: "select-dasha-system", system: "yogini" });
  await c.dispatch(action); assert.deepEqual(c.getSnapshot().data.calculations, original);
  const old = JSON.parse(JSON.stringify(store.data)); delete old.ui.ashtakavarga;
  const decoded = decodeWorkspace(old); assert.deepEqual(decoded.ui.ashtakavarga, emptyAvSelection());
  assert.deepEqual(decoded.calculations, original); assert.equal(Object.hasOwn(old.ui, "ashtakavarga"), false);
  await c.dispatch({ type: "select-ashtakavarga", selection: { ...action.selection, target: "Rahu" } } as unknown as WorkspaceAction);
  assert.equal(c.getSnapshot().error, "invalid_action"); assert.deepEqual(c.getSnapshot().data.ui.ashtakavarga, action.selection);
  store.fail = true; await c.dispatch({ type: "select-ashtakavarga", selection: emptyAvSelection() });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.deepEqual(store.data.ui.ashtakavarga, action.selection);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); await c.dispatch(action);
  const restored = new WorkspaceController(store); await restored.initialize();
  assert.deepEqual(restored.getSnapshot().data.ui.ashtakavarga, action.selection);
  c.dispose(); restored.dispose();
});
