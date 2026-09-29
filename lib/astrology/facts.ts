import type { CalculationProfile, SplitCalculationProfile, VargaCalculationProfile, PanchangaCalculationProfile, GeometricDashaCalculationProfile, VargaMap, ChartFact, NormalizedBirth, PlanetPosition, Varga, VargaChart } from "./contracts";
import { PANCHANGA_METHOD } from "./panchanga-contract";
import { nakshatraAt } from "./jyotish";
import { DASHA_RULES, SPLIT_DASHA_CONVENTIONS, GEOMETRIC_DASHA_CONVENTIONS } from "./dasha";

import { VARGA_METHODS } from "./varga-methods";
export { VARGA_METHODS } from "./varga-methods";
const BASE_METHODS = { D1: VARGA_METHODS.D1, D9: VARGA_METHODS.D9, D10: VARGA_METHODS.D10 };
export function calculationProfile(nodes: NormalizedBirth["nodes"]): CalculationProfile {
  return { id: "global-lahiri-whole-sign", version: 2, origin: "explicit-local-profile", ayanamsha: "Lahiri", zodiac: "sidereal", nodes, houseSystem: "whole-sign", yearDays: 365.25,
    methods: { ...BASE_METHODS, vimshottari: DASHA_RULES.vimshottari.method, yogini: DASHA_RULES.yogini.method, time: "iana-luxon-swiss-utc-to-jd-v2" } };
}
export function splitCalculationProfile(nodes: NormalizedBirth["nodes"]): SplitCalculationProfile {
  return { id: "global-lahiri-pushya-whole-sign", version: 3, origin: "explicit-local-profile", zodiac: "sidereal", nodes, houseSystem: "whole-sign",
    chart: { ayanamsha: "Lahiri", swissMode: 1 },
    dashas: { ayanamsha: "Swiss True Pushya", swissMode: 29, yearDays: { vimshottari: SPLIT_DASHA_CONVENTIONS.vimshottari.yearDays, yogini: SPLIT_DASHA_CONVENTIONS.yogini.yearDays } },
    methods: { ...BASE_METHODS, time: "iana-luxon-swiss-utc-to-jd-v2", vimshottari: SPLIT_DASHA_CONVENTIONS.vimshottari.method, yogini: SPLIT_DASHA_CONVENTIONS.yogini.method } };
}
export function vargaCalculationProfile(nodes: NormalizedBirth["nodes"]): VargaCalculationProfile {
  const profile = splitCalculationProfile(nodes);
  return { ...profile, version: 4, methods: { ...profile.methods, ...VARGA_METHODS } };
}
export function panchangaCalculationProfile(nodes: NormalizedBirth["nodes"]): PanchangaCalculationProfile {
  const profile = vargaCalculationProfile(nodes);
  return { ...profile, version: 5, methods: { ...profile.methods, panchanga: PANCHANGA_METHOD } };
}
export function geometricDashaCalculationProfile(nodes: NormalizedBirth["nodes"]): GeometricDashaCalculationProfile {
  const profile = panchangaCalculationProfile(nodes);
  return { ...profile, version: 6,
    dashas: { ...profile.dashas, positionKind: "geometric-geocentric", timeMethod: "civil-as-ut-swiss-deltat-v1" },
    methods: { ...profile.methods, vimshottari: GEOMETRIC_DASHA_CONVENTIONS.vimshottari.method, yogini: GEOMETRIC_DASHA_CONVENTIONS.yogini.method } };
}
export function chartFacts<T extends VargaMap<VargaChart>>(ascendant: number, planets: readonly PlanetPosition[], charts: T) {
  function facts(varga: Varga | null): ChartFact[] {
    const chartAsc = varga ? charts[varga]!.ascendant : ascendant;
    const items = varga ? charts[varga]!.planets : planets;
    return [{ name: "Lagna" as const, longitude: chartAsc }, ...items].map(p => {
      const natal = !varga, nak = natal ? nakshatraAt(p.longitude) : null;
      const speed = natal && p.name !== "Lagna" ? planets.find(planet => planet.name === p.name)!.speed : null;
      return { ref: natal ? `natal/${p.name}` : `varga/${varga}/${p.name}`, name: p.name, longitude: p.longitude, sign: Math.floor(p.longitude / 30), degree: p.longitude % 30,
        house: (Math.floor(p.longitude / 30) - Math.floor(chartAsc / 30) + 12) % 12 + 1,
        speed, retrograde: speed === null ? null : speed < 0, nakshatra: nak?.name ?? null, pada: nak?.pada ?? null,
        coordinateKind: natal ? "natal-sidereal" : "divisional-symbolic", method: natal ? "swiss-sidereal-whole-sign-v2" : VARGA_METHODS[varga], basisRef: natal ? null : `natal/${p.name}` };
    });
  }
  const vargas = {} as { [K in keyof T]: readonly ChartFact[] };
  for (const varga of Object.keys(charts) as (keyof T)[]) vargas[varga] = facts(varga as Varga);
  return { natal: facts(null), vargas };
}
