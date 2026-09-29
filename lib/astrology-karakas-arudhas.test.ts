import assert from "node:assert/strict";
import test from "node:test";
import { arudhaSign, bhavaArudhas, charaKarakas, grahaArudhas, emptyArudhaSelection, isArudhaSelection } from "./astrology/karakas-arudhas";
import type { PlanetName, VargaChart } from "./astrology/contracts";
import { WorkspaceController, type WorkspaceAction } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";
import { calculateAstrology } from "./astrology/engine-core";

const names: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
function chart(longitudes: number[], ascendant = 150): VargaChart {
  return { method: "synthetic-reference-placements", ascendant,
    planets: names.map((name, i) => ({ name, longitude: longitudes[i], sign: Math.floor(longitudes[i] / 30) })) };
}
const deg = (sign: number, degree: number, minute = 0) => sign * 30 + degree + minute / 60;

test("eight chara karakas match Rao example28, use reversed Rahu and retain natal provenance", () => {
  const input = chart([deg(2, 12, 47), deg(0, 20, 28), deg(2, 13, 51), deg(2, 25, 18), deg(1, 5, 40), deg(2, 17, 21), deg(1, 2, 28), deg(3, 1, 43), deg(9, 1, 43)]);
  const before = structuredClone(input), result = charaKarakas(input);
  // Table14's last planet label repeats Venus; the given 2Ta28 is Saturn.
  assert.deepEqual(result.rows.map(row => row.planets[0].name), ["Rahu", "Mercury", "Moon", "Venus", "Mars", "Sun", "Jupiter", "Saturn"]);
  assert.ok(Math.abs(result.rows[0].planets[0].advancement - (28 + 17 / 60)) < 1e-10);
  assert.equal(result.rows[0].planets[0].ref, "charts/D1/planets/Rahu");
  assert.equal(result.requiresSthiraResolution, false); assert.deepEqual(input, before);
  const boundary = chart([1, 2, 3, 4, 5, 6, 7, 0, 180]);
  assert.equal(charaKarakas(boundary).rows[0].planets[0].advancement, 30);
  assert.throws(() => charaKarakas(chart([1, 2, 3, 4, 5, 6, 7, 360, 180])));
});

test("ties share a rank and leave vacancies; display rounding does not create artificial ties", () => {
  const equal = chart([10, 40, 65, 94, 123, 152, 181, 239.5, 59.5]);
  const facts = charaKarakas(equal);
  assert.deepEqual(facts.rows[0].planets.map(p => p.name), ["Sun", "Moon"]);
  assert.equal(facts.rows[0].status, "shared"); assert.equal(facts.rows[1].status, "vacant-after-tie");
  assert.equal(facts.requiresSthiraResolution, true); assert.equal(facts.rows.flatMap(row => row.planets).length, 8);
  const close = chart([10, 40.0000001, 65, 94, 123, 152, 181, 239.5, 59.5]);
  assert.equal(charaKarakas(close).rows[0].planets[0].name, "Moon");
  assert.equal(charaKarakas(close).requiresSthiraResolution, false);
  assert.throws(() => charaKarakas({ ...equal, planets: [...equal.planets.slice(1), equal.planets[1]] }));
});

const example29 = chart([335, 65, 5, 340, 15, 345, 25, 95, 275]);
test("nine graha arudhas reproduce Rao example30 including owned-sign choices and exceptions", () => {
  const original = structuredClone(example29), facts = grahaArudhas(example29, "D1");
  assert.deepEqual(facts.rows.map(row => row.sign), [9, 4, 9, 2, 10, 1, 3, 5, 5]);
  assert.deepEqual(facts.rows.map(row => row.selectedOwnedSign), [4, 3, 0, 2, 11, 6, 9, 10, 7]);
  assert.deepEqual(facts.rows.map(row => row.count), [6, 2, 1, 4, 12, 8, 10, 8, 11]);
  assert.equal(facts.rows[2].exception, "first");
  assert.equal(facts.rows[3].exception, "seventh");
  assert.equal(facts.rows[6].exception, "seventh");
  assert.equal(facts.rows[5].strength.rule, "lord-oddity");
  assert.equal(facts.rows[5].planetRef, "charts/D1/planets/Venus");
  assert.equal(new Set(facts.rows.map(row => row.ref)).size, 9);
  assert.deepEqual(example29, original);
});

test("graha owned-sign strength stops at the first differing rule and retains comparison evidence", () => {
  const inSigns = (signs: number[]) => chart(signs.map(sign => deg(sign, 5)));
  const occupants = grahaArudhas(example29, "D1").rows[2];
  assert.equal(occupants.strength.rule, "occupants");
  assert.deepEqual(occupants.strength.checks, [{ rule: "occupants", scores: [3, 0] }]);
  const support = grahaArudhas(inSigns([1, 2, 4, 4, 11, 1, 2, 9, 3]), "D1").rows[2];
  assert.equal(support.selectedOwnedSign, 0);
  assert.deepEqual(support.strength.checks, [
    { rule: "occupants", scores: [0, 0] }, { rule: "rashi-support", scores: [2, 0] }
  ]);
  const exalted = grahaArudhas(inSigns([0, 5, 3, 10, 1, 6, 9, 2, 8]), "D1").rows[3];
  assert.equal(exalted.selectedOwnedSign, 2); // Rao's Rahu exaltation in Gemini.
  assert.deepEqual(exalted.strength.checks, [
    { rule: "occupants", scores: [1, 1] }, { rule: "rashi-support", scores: [0, 0] },
    { rule: "exalted-occupant", scores: [1, 0] }
  ]);
  const parity = grahaArudhas(inSigns(names.map(() => 4)), "D1").rows[3];
  assert.equal(parity.selectedOwnedSign, 5);
  assert.equal(parity.strength.rule, "lord-oddity");
  assert.deepEqual(parity.strength.checks.at(-1)?.scores, [0, 1]);
  // Both Mercury roles support Gemini and Virgo; one is not silently deduplicated.
  const repeated = grahaArudhas(inSigns(names.map(() => 11)), "D1").rows[3];
  assert.deepEqual(repeated.strength.checks[1], { rule: "rashi-support", scores: [3, 3] });
});

test("planetary arudhas use their own planet rather than the resolved bhava co-lord", () => {
  const input = chart([5, 35, 215, 65, 125, 155, 305, 95, 275]);
  assert.deepEqual(bhavaArudhas(input, emptyArudhaSelection()).coLords.map(row => row.candidates), [["Ketu"], ["Rahu"]]);
  const facts = grahaArudhas(input, "D1");
  assert.equal(facts.rows[2].strength.owner, "Mars");
  assert.equal(facts.rows[6].strength.owner, "Saturn");
  assert.deepEqual(facts.rows[7].ownedSigns, [10]);
  assert.deepEqual(facts.rows[8].ownedSigns, [7]);
  for (const row of facts.rows) assert.notEqual((row.sign - row.sourceSign + 12) % 12, 0);
  for (const row of facts.rows) assert.notEqual((row.sign - row.sourceSign + 12) % 12, 6);
});

test("graha arudhas preserve symbolic provenance and are independent of lagna and array ordering", () => {
  const d1 = grahaArudhas(example29, "D1"), d9 = grahaArudhas(example29, "D9");
  assert.equal(d9.coordinateKind, "divisional-symbolic");
  assert.equal(d9.basisRef, "charts/D9");
  assert.deepEqual(d9.rows.map(row => row.sign), d1.rows.map(row => row.sign));
  assert.ok(d9.rows.every(row => row.planetRef.startsWith("charts/D9/planets/") && row.ref.includes("/D9/")));
  assert.deepEqual(grahaArudhas({ ...example29, ascendant: 0, planets: [...example29.planets].reverse() }, "D1"), d1);
  assert.throws(() => grahaArudhas(example29, "D999" as "D1"));
  assert.throws(() => grahaArudhas(chart([1, 2, 3, 4, 5, 6, 7, NaN, 180]), "D1"));
  assert.throws(() => grahaArudhas({ ...example29, planets: [...example29.planets.slice(1), example29.planets[1]] }, "D1"));
});

test("owned-sign parity resolves tied comparisons across every owner position without degree rounding", () => {
  for (let sign = 0; sign < 12; sign++) for (const degree of [0, 29.999999999]) {
    const facts = grahaArudhas(chart(names.map(() => deg(sign, degree))), "D1");
    for (const row of facts.rows) {
      assert.ok(row.ownedSigns.includes(row.selectedOwnedSign));
      assert.ok(Number.isInteger(row.sign) && row.sign >= 0 && row.sign < 12);
      assert.ok(row.strength.checks.length <= 4);
      if (row.strength.rule === "lord-oddity") assert.notEqual(row.selectedOwnedSign % 2, sign % 2);
    }
  }
});

test("twelve bhava arudhas reproduce Rao example29 including both exceptions and co-lords", () => {
  const original = structuredClone(example29), result = bhavaArudhas(example29, emptyArudhaSelection());
  assert.deepEqual(result.rows.map(row => row.sign), [2, 4, 5, 4, 0, 2, 1, 9, 9, 5, 1, 6]);
  assert.equal(result.coLordResolution, "unique");
  assert.deepEqual(result.coLords.map(row => row.candidates), [["Mars"], ["Saturn"]]);
  assert.equal(result.rows[0].label, "AL"); assert.equal(result.rows[11].label, "UL");
  assert.equal(result.rows[0].options[0].exception, "first");
  assert.equal(result.rows[4].options[0].exception, "seventh");
  assert.equal(result.rows[4].options[0].provisional, 3); // Cancer -> tenth is Aries, not Capricorn.
  assert.equal(result.rows[9].sign, 5); // Sagittarius -> tenth is Virgo.
  assert.equal(result.rows[0].options[0].lordRef, "charts/D1/planets/Mercury");
  assert.equal(new Set(result.rows.map(row => row.ref)).size, 12); assert.deepEqual(example29, original);
  assert.equal(bhavaArudhas(example29, { ...emptyArudhaSelection(), varga: "D9" }).coordinateKind, "divisional-symbolic");
});

test("forward count covers all source/lord pairs and rejects malformed selections", () => {
  const offsets = [9, 2, 4, 3, 8, 10, 9, 2, 4, 3, 8, 10];
  for (let source = 0; source < 12; source++) for (let distance = 0; distance < 12; distance++) {
    const result = arudhaSign(source, (source + distance) % 12);
    assert.equal(result.sign, (source + offsets[distance]) % 12);
    assert.equal(result.count, distance + 1);
  }
  assert.throws(() => arudhaSign(12, 0)); assert.throws(() => arudhaSign(0, NaN));
  assert.equal(isArudhaSelection({ ...emptyArudhaSelection(), script: "arbitrary" }), false);
  assert.equal(isArudhaSelection({ method: "unknown", varga: "D1" }), false);
  assert.throws(() => bhavaArudhas(chart([1, 2, 3, 4, 5, 6, 7, 8, Infinity]), emptyArudhaSelection()));
});

test("co-lord ties remain alternatives; outside-own-sign rule precedes all strength comparisons", () => {
  const tied = bhavaArudhas(chart(names.map(() => 15)), emptyArudhaSelection());
  assert.equal(tied.coLordResolution, "multiple-or-tied");
  assert.deepEqual(tied.coLords.map(row => row.candidates), [["Mars", "Ketu"], ["Saturn", "Rahu"]]);
  assert.equal(tied.rows.find(row => row.sourceSign === 7)?.lordResolved, false);
  const own = chart([5, 35, 215, 65, 125, 155, 305, 95, 275]);
  const out = bhavaArudhas(own, emptyArudhaSelection());
  assert.deepEqual(out.coLords.map(row => row.candidates), [["Ketu"], ["Rahu"]]);
  assert.ok(out.coLords.every(row => row.decisions.every(d => d.rule === "outside-own-sign")));
  const distinct = bhavaArudhas(chart([125, 35, 15, 155, 65, 335, 305, 285, 105]), emptyArudhaSelection());
  const sc = distinct.rows.find(row => row.sourceSign === 7)!;
  assert.equal(sc.sign, null); assert.equal(sc.lordResolved, false);
  assert.deepEqual(sc.options.map(option => [option.lord, option.sign]), [["Mars", 5], ["Ketu", 11]]);
});

test("Rao co-lord support counts repeated roles and exaltation follows only tied earlier rules", () => {
  // Section15.5.1: Saturn Gemini with Mercury receives two roles; Rahu Aries receives its dispositor Mars Leo.
  // Sun with Rahu equalizes companions; the other synthetic placements do not change the stated support.
  const support = bhavaArudhas(chart([5, 245, 125, 65, 35, 185, 75, 15, 195]), emptyArudhaSelection());
  const aq = support.coLords.find(row => row.sign === "Aquarius")!;
  assert.deepEqual(aq.candidates, ["Saturn"]);
  assert.ok(aq.decisions.every(d => d.rule === "rashi-support" && d.scores[0] === 2 && d.scores[1] === 1));
  const exalted = bhavaArudhas(chart([35, 65, 5, 155, 305, 335, 185, 95, 275]), emptyArudhaSelection());
  const exaltedAq = exalted.coLords.find(row => row.sign === "Aquarius")!;
  assert.deepEqual(exaltedAq.candidates, ["Saturn"]);
  assert.ok(exaltedAq.decisions.every(d => d.rule === "exaltation"));
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
test("analysis survives reload and failed writes, preserves old snapshots", async () => {
  const store = new Store(), c = new WorkspaceController(store, async input => calculateAstrology(input));
  await c.initialize(); await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  await c.dispatch({ type: "calculate", kind: "astrology" }); await c.dispatch({ type: "save-calculation" });
  const original = structuredClone(c.getSnapshot().data.calculations);
  const action = { type: "select-arudhas", selection: { ...emptyArudhaSelection(), varga: "D9" } } as const;
  await c.dispatch(action); assert.equal(c.getSnapshot().error, null);
  await c.dispatch({ type: "select-panel", panel: "karakas" });
  await c.dispatch({ type: "select-dasha-system", system: "yogini" });
  await c.dispatch(action); assert.deepEqual(c.getSnapshot().data.calculations, original);
  const old = JSON.parse(JSON.stringify(store.data)); delete old.ui.arudhas;
  const decoded = decodeWorkspace(old); assert.deepEqual(decoded.ui.arudhas, emptyArudhaSelection());
  assert.deepEqual(decoded.calculations, original); assert.equal(Object.hasOwn(old.ui, "arudhas"), false);
  await c.dispatch({ type: "select-arudhas", selection: { method: "unknown", varga: "D1" } } as unknown as WorkspaceAction);
  assert.equal(c.getSnapshot().error, "invalid_action"); assert.deepEqual(c.getSnapshot().data.ui.arudhas, action.selection);
  store.fail = true; await c.dispatch({ type: "select-arudhas", selection: emptyArudhaSelection() });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.deepEqual(store.data.ui.arudhas, action.selection);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); await c.dispatch(action);
  const restored = new WorkspaceController(store); await restored.initialize();
  assert.deepEqual(restored.getSnapshot().data.ui.arudhas, action.selection);
  c.dispose(); restored.dispose();
});
