import type { PlanetName, PlanetPosition } from "./contracts";

export const PLANET_CHAKRA_METHOD = "astro-expert-six-sign-pairs-d1-v1";
export const PLANET_CHAKRA_SOURCE = "https://ru.astro.expert/";
/** Zero-based D1 signs, in the order displayed by the reference's six-row table. */
const PAIRS = [
  { chakra: 6, signs: [4, 3] }, { chakra: 5, signs: [5, 2] },
  { chakra: 4, signs: [6, 1] }, { chakra: 3, signs: [7, 0] },
  { chakra: 2, signs: [8, 11] }, { chakra: 1, signs: [9, 10] },
] as const;
const PLANETS: readonly PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
type Position = Pick<PlanetPosition, "name" | "sign" | "speed">;

/** Group saved natal positions only; the ascendant and selected varga are irrelevant. */
export function planetChakras(natal: readonly Position[]) {
  const seen = new Set<PlanetName>();
  for (const planet of natal) {
    if (!PLANETS.includes(planet.name) || seen.has(planet.name) || !Number.isInteger(planet.sign) || planet.sign < 0 || planet.sign > 11) throw new RangeError("Invalid or duplicate natal planet");
    seen.add(planet.name);
  }
  return PAIRS.map(pair => ({ chakra: pair.chakra, signs: pair.signs,
    planets: natal.filter(p => pair.signs.some(sign => sign === p.sign)),
  }));
}
