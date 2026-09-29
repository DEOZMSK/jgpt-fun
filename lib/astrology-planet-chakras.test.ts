import assert from "node:assert/strict";
import test from "node:test";
import type { PlanetName } from "./astrology/contracts";
import { planetChakras } from "./astrology/planet-chakras";
import { calculateAstrology } from "./astrology/engine-core";

test("all twelve signs use the reference's six chakra correspondences", () => {
  const expectedBySign = [3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 1, 2];
  for (let sign = 0; sign < 12; sign++) {
    const rows = planetChakras([{ name: "Sun", sign, speed: 1 }]);
    assert.deepEqual(rows.map(row => row.chakra), [6, 5, 4, 3, 2, 1]);
    assert.equal(rows.find(row => row.planets.length)?.chakra, expectedBySign[sign]);
    assert.equal(rows.flatMap(row => row.planets).length, 1);
  }
  assert.deepEqual(planetChakras([]).map(r => r.signs.map(s => s + 1)), [[5, 4], [6, 3], [7, 2], [8, 1], [9, 12], [10, 11]]);
});

test("nodes, retrograde motion and dense cells are preserved without mutating input", () => {
  const names: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  const positions = names.map((name, i) => ({ name, sign: i % 2 ? 9 : 10, speed: i % 2 ? -1 : 1 }));
  const before = structuredClone(positions), rows = planetChakras(positions);
  assert.deepEqual(rows.at(-1)!.planets, positions);
  assert.ok(rows.slice(0, -1).every(row => row.planets.length === 0));
  assert.deepEqual(positions, before);
  for (const sign of [-1, 12, 1.5, NaN]) assert.throws(() => planetChakras([{ name: "Sun", sign, speed: 0 }]), RangeError);
  assert.throws(() => planetChakras([positions[0], positions[0]]), RangeError);
});

test("native D1 places each of the nine planets exactly once and requires no new calculation state", () => {
  const result = calculateAstrology({ date: "2000-01-01", time: "12:00:00", place: "Synthetic UTC", timezone: "Etc/UTC", latitude: 0, longitude: 0, nodes: "true", accuracy: "exact" });
  const before = structuredClone(result), grouped = planetChakras(result.planets).flatMap(row => row.planets);
  assert.equal(grouped.length, 9); assert.equal(new Set(grouped.map(p => p.name)).size, 9);
  for (const planet of result.planets) assert.deepEqual(grouped.find(p => p.name === planet.name), planet);
  assert.deepEqual(result, before);
});
