import { ashtakavarga, AV_PLANETS, type AvPlanet } from "./ashtakavarga";
import type { Varga, VargaChart } from "./contracts";

// Rao 12.7; the occupied/empty equality case is explicit in Phaladeepika 26.20.
// Seven-planet occupancy excludes nodes and Lagna. See the method document.
export const AV_REDUCTION_METHOD = "rao-trikona-seven-planet-ekadhipatya-v1";
const PAIRS = [[0, 7], [1, 6], [2, 5], [8, 11], [9, 10]] as const;
const SIGN_WEIGHTS = [7, 10, 8, 4, 10, 6, 7, 8, 9, 5, 11, 12] as const;
const PLANET_WEIGHTS = [5, 5, 8, 5, 10, 7, 5] as const;
const total = (points: readonly number[]) => points.reduce((sum, value) => sum + value, 0);
function checkPoints(points: readonly number[]) {
  if (points.length !== 12 || Array.from(points).some(point => !Number.isInteger(point) || point < 0 || point > 8)) throw new RangeError("Invalid BAV points");
}

export function trikonaReduction(original: readonly number[]) {
  checkPoints(original);
  const points = [...original];
  const steps = Array.from({ length: 4 }, (_, start) => {
    const signs = [start, start + 4, start + 8];
    const before = signs.map(sign => original[sign]), subtracted = Math.min(...before);
    signs.forEach(sign => { points[sign] -= subtracted; });
    return { signs, before, subtracted, after: signs.map(sign => points[sign]) };
  });
  return { points, total: total(points), steps };
}

type PairRule = "zero-present" | "both-occupied" | "empty-lower-or-equal" | "empty-higher" | "both-empty-equal" | "both-empty-unequal";
export function ekadhipatyaReduction(trikona: readonly number[], occupied: readonly boolean[]) {
  checkPoints(trikona);
  if (occupied.length !== 12 || Array.from(occupied).some(value => typeof value !== "boolean")) throw new RangeError("Invalid sign occupancy");
  const points = [...trikona];
  const steps = PAIRS.map(([a, b]) => {
    let rule: PairRule;
    if (!points[a] || !points[b]) rule = "zero-present";
    else if (occupied[a] && occupied[b]) rule = "both-occupied";
    else if (occupied[a] || occupied[b]) {
      const filled = occupied[a] ? a : b, empty = occupied[a] ? b : a;
      rule = points[empty] <= points[filled] ? "empty-lower-or-equal" : "empty-higher";
      points[empty] = rule === "empty-lower-or-equal" ? 0 : points[filled];
    } else {
      rule = points[a] === points[b] ? "both-empty-equal" : "both-empty-unequal";
      points[a] = points[b] = rule === "both-empty-equal" ? 0 : Math.min(points[a], points[b]);
    }
    return { signs: [a, b], occupied: [occupied[a], occupied[b]], before: [trikona[a], trikona[b]], after: [points[a], points[b]], rule };
  });
  return { points, total: total(points), steps };
}

export function shodhyaPindas(reduced: readonly number[], planetSigns: readonly number[]) {
  checkPoints(reduced);
  if (planetSigns.length !== 7 || Array.from(planetSigns).some(sign => !Number.isInteger(sign) || sign < 0 || sign > 11)) throw new RangeError("Invalid pinda planet signs");
  const rashiTerms = reduced.map((points, sign) => ({ sign, points, weight: SIGN_WEIGHTS[sign], product: points * SIGN_WEIGHTS[sign] }));
  const grahaTerms = AV_PLANETS.map((planet, i) => ({ planet, sign: planetSigns[i], points: reduced[planetSigns[i]], weight: PLANET_WEIGHTS[i], product: reduced[planetSigns[i]] * PLANET_WEIGHTS[i] }));
  const rashi = total(rashiTerms.map(term => term.product)), graha = total(grahaTerms.map(term => term.product));
  return { rashi, graha, shodhya: rashi + graha, rashiTerms, grahaTerms };
}

/** Separate projection: never replaces original BAV/SAV or stored positions. */
export function reducedAshtakavarga(chart: VargaChart, varga: Varga) {
  const original = ashtakavarga(chart, varga);
  const planetSigns = AV_PLANETS.map(planet => chart.planets.find(row => row.name === planet)!.sign);
  const occupants = Array.from({ length: 12 }, (_, sign) => AV_PLANETS.filter((_, i) => planetSigns[i] === sign));
  const ref = `ashtakavarga/${AV_REDUCTION_METHOD}/${varga}`;
  const bav = original.bav.map(row => {
    const trikona = trikonaReduction(row.points), ekadhipatya = ekadhipatyaReduction(trikona.points, occupants.map(planets => planets.length > 0));
    return { planet: row.planet as AvPlanet, ref: `${ref}/${row.planet}`, originalRef: row.ref,
      original: { points: [...row.points], total: row.total }, trikona, ekadhipatya,
      pinda: { ...shodhyaPindas(ekadhipatya.points, planetSigns), ref: `${ref}/${row.planet}/pinda` } };
  });
  return { version: "global-ashtakavarga-reductions-v1" as const, method: AV_REDUCTION_METHOD, varga,
    basisRef: original.basisRef, chartMethod: chart.method, coordinateKind: original.coordinateKind,
    occupancy: occupants.map((planets, sign) => ({ sign, planets: planets.map(planet => ({ planet, ref: `${original.basisRef}/planets/${planet}` })) })), bav };
}
