import assert from "node:assert/strict";
import test from "node:test";
import type { PlanetName } from "./astrology/contracts";
import { chartConditions, planetaryCombustion, planetaryMoolatrikona, signDignity } from "./astrology/planet-condition";
import { chartTextRows } from "./astrology/chart-text-layout";
import { NORTH_CELLS, NORTH_SIGN_LABELS } from "./astrology/chart-geometry";
import { calculateAstrology } from "./astrology/engine-core";
import { WorkspaceController } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

test("published seven-planet sign rules cover every exaltation, fall and domicile", () => {
  const reference: [PlanetName, number, number, number[]][] = [
    ["Sun", 0, 6, [4]], ["Moon", 1, 7, [3]], ["Mars", 9, 3, [0, 7]],
    ["Mercury", 5, 11, [2, 5]], ["Jupiter", 3, 9, [8, 11]], ["Venus", 11, 5, [1, 6]], ["Saturn", 6, 0, [9, 10]],
  ];
  for (const [name, exalted, fallen, own] of reference) for (let sign = 0; sign < 12; sign++) {
    assert.deepEqual(signDignity(name, sign), { supported: true, exalted: sign === exalted, debilitated: sign === fallen, own: own.includes(sign) });
  }
  assert.equal(signDignity("Mercury", 5).own, true);
  for (const node of ["Rahu", "Ketu"] as const) for (let sign = 0; sign < 12; sign++) assert.deepEqual(signDignity(node, sign), { supported: false, exalted: false, debilitated: false, own: false });
  for (const sign of [-1, 12, 2.5, NaN, Infinity]) assert.throws(() => signDignity("Sun", sign), RangeError);
});
const physical = (name: PlanetName, distance: number, speed = 1) => [{ name: "Sun" as const, longitude: 0, speed: 1 }, { name, longitude: distance, speed }];
test("all six orbs use strict unrounded boundaries and the short arc in both directions", () => {
  for (const [name, orb] of [["Moon", 12], ["Mars", 17], ["Mercury", 14], ["Jupiter", 11], ["Venus", 10], ["Saturn", 15]] as [PlanetName, number][]) {
    assert.equal(planetaryCombustion(name, physical(name, orb - 1e-8)).status, "combust");
    assert.equal(planetaryCombustion(name, physical(name, orb)).status, "clear");
    assert.equal(planetaryCombustion(name, physical(name, orb + 1e-8)).status, "clear");
    assert.equal(planetaryCombustion(name, physical(name, 360 - orb + 1e-8)).status, "combust");
    assert.equal(planetaryCombustion(name, physical(name, 360 - orb)).status, "clear");
    assert.equal(planetaryCombustion(name, physical(name, 180)).separation, 180);
  }
  assert.equal(planetaryCombustion("Mars", [{ name: "Sun", longitude: 359, speed: 1 }, { name: "Mars", longitude: 1, speed: 1 }]).separation, 2);
});
test("Mercury and Venus use narrower retrograde orbs; zero speed takes the direct convention", () => {
  for (const [name, distance, orb] of [["Mercury", 13, 12], ["Venus", 9, 8]] as [PlanetName, number, number][]) {
    assert.equal(planetaryCombustion(name, physical(name, distance, 0)).status, "combust");
    assert.deepEqual(planetaryCombustion(name, physical(name, distance, -0.01)), { status: "clear", separation: distance, threshold: orb });
    assert.equal(planetaryCombustion(name, physical(name, orb - 1e-8, -1)).status, "combust");
    assert.equal(planetaryCombustion(name, physical(name, orb, -1)).status, "clear");
  }
});
test("missing or ambiguous physical data never becomes a false clear result", () => {
  for (const positions of [[], physical("Mercury", NaN), physical("Mercury", -1), physical("Mercury", 360), physical("Mercury", 1, NaN), [...physical("Mercury", 1), ...physical("Mercury", 1)]]) assert.equal(planetaryCombustion("Mercury", positions).status, "unavailable");
  for (const name of ["Sun", "Rahu", "Ketu"] as const) assert.equal(planetaryCombustion(name, []).status, "not-applicable");
});

test("Rao moolatrikona ranges include the lower edge and exclude the upper edge for all seven planets", () => {
  // Absolute zodiac degrees from the documented source table, not production constants.
  const reference: [PlanetName, number, number][] = [
    ["Sun", 120, 140], ["Moon", 33, 60], ["Mars", 0, 12], ["Mercury", 165, 170],
    ["Jupiter", 240, 250], ["Venus", 180, 195], ["Saturn", 300, 320],
  ];
  for (const [name, lower, upper] of reference) {
    const at = (longitude: number) => planetaryMoolatrikona(name, [{ name, longitude }]);
    assert.equal(at((lower - 1e-8 + 360) % 360).status, "outside-range", name);
    assert.equal(at(lower).status, "in-range", name);
    assert.equal(at(upper - 1e-8).status, "in-range", name);
    assert.equal(at(upper).status, "outside-range", name);
    assert.equal(at(upper + 1e-8).status, "outside-range", name);
    assert.equal(at((lower + 30) % 360).status, "outside-range", name);
  }
  // Resolve the printed Mars/Leo inconsistency with table 6 and Hora Sara 2.8.
  assert.equal(planetaryMoolatrikona("Mars", [{ name: "Mars", longitude: 125 }]).status, "outside-range");
});

test("moolatrikona never substitutes missing positions, duplicate planets or node conventions", () => {
  for (const longitude of [-1, 360, NaN, Infinity]) assert.equal(planetaryMoolatrikona("Sun", [{ name: "Sun", longitude }]).status, "unavailable");
  assert.equal(planetaryMoolatrikona("Sun", []).status, "unavailable");
  assert.equal(planetaryMoolatrikona("Sun", [{ name: "Sun", longitude: 130 }, { name: "Sun", longitude: 130 }]).status, "unavailable");
  for (const name of ["Rahu", "Ketu"] as const) assert.deepEqual(planetaryMoolatrikona(name, [{ name, longitude: 130 }]), { status: "unselected", longitude: null, range: null });
});

test("physical moolatrikona remains independent of symbolic varga dignity and degrees", () => {
  const natal = [{ name: "Mercury" as const, longitude: 166, speed: -0.1 }];
  const chart = { method: "synthetic", ascendant: 0, planets: [{ name: "Mercury" as const, longitude: 166, sign: 5 }] };
  const before = structuredClone({ natal, chart });
  const d1 = chartConditions(chart, natal)[0];
  const d9 = chartConditions({ ...chart, planets: [{ name: "Mercury", longitude: 331, sign: 11 }] }, natal)[0];
  assert.equal(d1.dignity.exalted, true); assert.equal(d9.dignity.debilitated, true);
  assert.equal(d1.moolatrikona.status, "in-range"); assert.deepEqual(d1.moolatrikona, d9.moolatrikona);
  assert.equal(chartConditions(chart)[0].moolatrikona.status, "unavailable");
  assert.deepEqual({ natal, chart }, before);
});
test("divisional dignity changes independently while combustion retains its physical D1 basis", () => {
  const chart = { method: "synthetic", ascendant: 0, planets: [{ name: "Mercury" as const, longitude: 165, sign: 5 }] };
  const positions = physical("Mercury", 5), before = structuredClone({ chart, positions });
  const a = chartConditions(chart, positions)[0];
  assert.equal(a.dignity.exalted, true); assert.equal(a.combustion.status, "combust");
  const b = chartConditions({ ...chart, planets: [{ name: "Mercury", longitude: 335, sign: 11 }] }, positions)[0];
  assert.equal(b.dignity.debilitated, true); assert.deepEqual(a.combustion, b.combustion);
  assert.equal(chartConditions(chart)[0].combustion.status, "unavailable");
  assert.deepEqual({ chart, positions }, before);
});
test("marked dense chart labels fit each northern cell alongside overlay labels", () => {
  for (let cell = 0; cell < NORTH_CELLS.length; cell++) {
    const tokens = [{ label: "Asc", layer: "natal" as const }, ...Array.from({ length: 9 }, () => ({ label: "Me↑*", compactLabel: "Me", layer: "natal" as const, own: true })), ...Array.from({ length: 9 }, () => ({ label: "Me", layer: "transits" as const }))];
    const rows = chartTextRows(NORTH_CELLS[cell].points, tokens, NORTH_SIGN_LABELS[cell]);
    assert.equal(rows.flatMap(r => r.tokens).length, tokens.length);
    assert.equal(rows.flatMap(r => r.tokens).filter(t => t.own).length, 9);
    assert.ok(rows.every(r => r.fontSize >= 10));
  }
});
const birth = { date: "2000-01-01", time: "12:00:00", place: "Synthetic UTC", timezone: "Etc/UTC", latitude: 0, longitude: 0, nodes: "true", accuracy: "exact" } as const;
test("native calculation supplies consistent conditions for all saved vargas without changing snapshots", () => {
  const natal = calculateAstrology(birth), before = structuredClone(natal);
  const base = chartConditions(natal.charts.D1, natal.planets).map(r => [r.combustion, r.moolatrikona]);
  for (const chart of Object.values(natal.charts)) assert.deepEqual(chartConditions(chart, natal.planets).map(r => [r.combustion, r.moolatrikona]), base);
  assert.deepEqual(natal, before);
});
test("reading selection keeps its panel, persists the varga, and preserves saved calculations", async () => {
  let data = emptyWorkspace(), revision = 0;
  const store: WorkspaceStorage = { async load() { return { data: decodeWorkspace(data), revision }; }, async save(value, expected) { assert.equal(expected, revision); data = decodeWorkspace(structuredClone(value)); return ++revision; }, close() {} };
  const controller = new WorkspaceController(store, async input => calculateAstrology(input));
  await controller.initialize();
  await controller.dispatch({ type: "create-profile", draft: { ...sampleDraft(), place: birth.place, timezone: birth.timezone, latitude: "0", longitude: "0" } });
  await controller.dispatch({ type: "calculate", kind: "astrology" }); await controller.dispatch({ type: "save-calculation" });
  const saved = structuredClone(data.calculations);
  await controller.dispatch({ type: "select-panel", panel: "readings" }); await controller.dispatch({ type: "select-varga", varga: "D9" });
  assert.equal(data.ui.workbench.panel, "readings"); assert.equal(data.ui.varga, "D9"); assert.deepEqual(data.calculations, saved);
  const restored = new WorkspaceController(store); await restored.initialize(); assert.equal(restored.getSnapshot().data.ui.workbench.panel, "readings");
  await controller.dispatch({ type: "select-panel", panel: "vargas" }); await controller.dispatch({ type: "select-varga", varga: "D10" }); assert.equal(data.ui.workbench.panel, "vargas");
  controller.dispose(); restored.dispose();
});
