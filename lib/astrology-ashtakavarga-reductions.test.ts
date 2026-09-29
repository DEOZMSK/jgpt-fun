import assert from "node:assert/strict";
import test from "node:test";
import { ashtakavarga, emptyAvSelection, isAvSelection } from "./astrology/ashtakavarga";
import { ekadhipatyaReduction, reducedAshtakavarga, shodhyaPindas, trikonaReduction } from "./astrology/ashtakavarga-reductions";
import { AV_PLANETS } from "./astrology/ashtakavarga";
import type { VargaChart } from "./astrology/contracts";
import { decodeWorkspace, emptyWorkspace } from "./local-workspace/model";

const signs = [2, 11, 2, 2, 4, 0, 4];
const reference: VargaChart = { method: "published-sign-fixture", ascendant: 155,
  planets: [...AV_PLANETS, "Rahu" as const, "Ketu" as const].map((name, i) => ({ name, sign: [...signs, 6, 0][i], longitude: [...signs, 6, 0][i] * 30 + 5 })) };

test("Rao examples 40, 41 and 43 reproduce Mercury reductions and all three pindas", () => {
  const original = structuredClone(reference), raw = ashtakavarga(reference, "D1"), reduced = reducedAshtakavarga(reference, "D1");
  const mercury = reduced.bav.find(row => row.planet === "Mercury")!;
  assert.deepEqual(mercury.original.points, [7,4,7,4,4,3,4,4,4,3,6,4]);
  assert.deepEqual(mercury.trikona.points, [3,1,3,0,0,0,0,0,0,0,2,0]);
  assert.deepEqual(mercury.ekadhipatya.points, [3,1,3,0,0,0,0,0,0,0,2,0]);
  assert.equal(mercury.pinda.rashi, 77); assert.equal(mercury.pinda.graha, 75); assert.equal(mercury.pinda.shodhya, 152);
  assert.equal(mercury.originalRef, raw.bav.find(row => row.planet === "Mercury")!.ref);
  assert.equal(raw.sav.total, 337); assert.deepEqual(reference, original);
  const movedNodes: VargaChart = { ...reference, planets: reference.planets.map(row => row.name === "Rahu" ? { ...row, sign: 1, longitude: 35 } : row.name === "Ketu" ? { ...row, sign: 7, longitude: 215 } : { ...row }) };
  assert.deepEqual(reducedAshtakavarga(movedNodes, "D1"), reduced);
  assert.deepEqual(reduced.occupancy.flatMap(row => row.planets).map(row => row.planet).sort(), [...AV_PLANETS].sort());
  assert.equal(reducedAshtakavarga(reference, "D9").coordinateKind, "divisional-symbolic");
  assert.ok(reducedAshtakavarga(reference, "D9").bav.every(row => row.originalRef.includes("/D9/")));
});

test("Trikona subtracts the minimum and preserves the explicit Rao two-zero convention", () => {
  for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) for (let c = 0; c <= 8; c++) {
    const points = Array(12).fill(0); points[0] = a; points[4] = b; points[8] = c;
    const result = trikonaReduction(points);
    assert.equal(Math.min(result.points[0], result.points[4], result.points[8]), 0);
    assert.equal(result.points[0] - result.points[4], a - b);
    assert.equal(result.points[4] - result.points[8], b - c);
    assert.ok(result.points.every((value, sign) => value >= 0 && value <= points[sign]));
  }
  const twoZeros = [7,0,0,0,0,0,0,0,0,0,0,0]; assert.deepEqual(trikonaReduction(twoZeros).points, twoZeros);
});

test("Ekadhipatya covers every occupancy branch, equality, zero priority and singleton exemptions", () => {
  const run = (a: number, b: number, filledA: boolean, filledB: boolean) => {
    const points = Array(12).fill(0), occupied = Array(12).fill(false); points[1] = a; points[6] = b; points[3] = 7; points[4] = 8;
    occupied[1] = filledA; occupied[6] = filledB;
    const result = ekadhipatyaReduction(points, occupied);
    assert.equal(result.points[3], 7); assert.equal(result.points[4], 8);
    assert.equal(points[1], a); assert.equal(points[6], b);
    return [result.points[1], result.points[6]];
  };
  assert.deepEqual(run(4,2,true,true), [4,2]); assert.deepEqual(run(4,2,true,false), [4,0]);
  assert.deepEqual(run(4,2,false,true), [2,2]); assert.deepEqual(run(4,2,false,false), [2,2]);
  assert.deepEqual(run(2,2,false,false), [0,0]); assert.deepEqual(run(2,2,true,false), [2,0]);
  assert.deepEqual(run(2,2,false,true), [0,2]); assert.deepEqual(run(2,4,true,false), [2,2]);
  assert.deepEqual(run(0,4,true,false), [0,4]); assert.deepEqual(run(4,0,false,true), [4,0]);
});

test("BPHS chapter 69 worked Sun pinda totals independently verify the weight tables", () => {
  const actual = shodhyaPindas([0,1,1,4,1,0,0,4,1,3,0,0], [9,2,1,10,10,10,7]);
  assert.equal(actual.rashi, 100); assert.equal(actual.graha, 48); assert.equal(actual.shodhya, 148);
  assert.equal(actual.grahaTerms.length, 7); assert.equal(actual.rashiTerms.length, 12);
});

test("reduction inputs reject malformed counts/occupancy and old UI state gains only the stage", () => {
  assert.throws(() => trikonaReduction(Array(12).fill(NaN))); assert.throws(() => trikonaReduction(Array(11).fill(1)));
  assert.throws(() => trikonaReduction(Array(12).fill(9))); assert.throws(() => trikonaReduction(Array(12).fill(0.5)));
  assert.throws(() => trikonaReduction(Array(12))); assert.throws(() => ekadhipatyaReduction(Array(12).fill(1), Array(12)));
  assert.throws(() => shodhyaPindas(Array(12).fill(1), [0,0,0,0,0,0,12]));
  const old = JSON.parse(JSON.stringify(emptyWorkspace())); delete old.ui.ashtakavarga.stage;
  const before = JSON.stringify(old), decoded = decodeWorkspace(old);
  assert.equal(JSON.stringify(old), before); assert.deepEqual(decoded.ui.ashtakavarga, emptyAvSelection());
  assert.deepEqual(decoded.calculations, old.calculations);
  assert.equal(isAvSelection({ ...emptyAvSelection(), stage: "ekadhipatya" }), true);
  assert.equal(isAvSelection({ ...emptyAvSelection(), stage: "unknown" }), false);
  assert.equal(isAvSelection({ ...emptyAvSelection(), stage: "trikona", extra: "execute" }), false);
});
