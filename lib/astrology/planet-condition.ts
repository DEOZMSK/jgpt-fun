import type { PlanetName, PlanetPosition, VargaChart } from "./contracts";

export const PLANET_CONDITION_METHOD = "seven-planet-signs-d1-moolatrikona-combustion-v2";
export const DIGNITY_SOURCE = "https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf#page=46";
export const MOOLATRIKONA_METHOD = "rao-seven-planet-d1-moolatrikona-v1";
export const MARS_MOOLATRIKONA_SOURCE = "https://www.siva.sh/horasara/2/8";
export const COMBUSTION_SOURCES = {
  Moon: "https://www.drikpanchang.com/planet/asta/chandra-asta-date-time.html",
  Mars: "https://www.drikpanchang.com/planet/asta/mangal-asta-date-time.html",
  Mercury: "https://www.drikpanchang.com/planet/asta/budha-asta-date-time.html",
  Jupiter: "https://www.drikpanchang.com/planet/asta/guru-asta-date-time.html",
  Venus: "https://www.drikpanchang.com/planet/asta/shukra-asta-date-time.html",
  Saturn: "https://www.drikpanchang.com/planet/asta/shani-asta-date-time.html",
} as const;
type ClassicalPlanet = Exclude<PlanetName, "Rahu" | "Ketu">;
const SIGNS: Record<ClassicalPlanet, { own: readonly number[]; exalted: number }> = {
  Sun: { own: [4], exalted: 0 }, Moon: { own: [3], exalted: 1 },
  Mars: { own: [0, 7], exalted: 9 }, Mercury: { own: [2, 5], exalted: 5 },
  Jupiter: { own: [8, 11], exalted: 3 }, Venus: { own: [1, 6], exalted: 11 },
  Saturn: { own: [9, 10], exalted: 6 },
};
export type SignDignity = Readonly<{ supported: boolean; exalted: boolean; debilitated: boolean; own: boolean }>;
export function signDignity(name: PlanetName, sign: number): SignDignity {
  if (!Number.isInteger(sign) || sign < 0 || sign > 11) throw new RangeError("Invalid zodiac sign");
  const rule = SIGNS[name as ClassicalPlanet];
  return { supported: !!rule, exalted: rule?.exalted === sign, debilitated: !!rule && (rule.exalted + 6) % 12 === sign, own: rule?.own.includes(sign) ?? false };
}
type PhysicalPosition = Pick<PlanetPosition, "name" | "longitude" | "speed">;
export type Combustion = Readonly<{ status: "combust" | "clear" | "unavailable" | "not-applicable"; separation: number | null; threshold: number | null }>;
const validLongitude = (v: number) => Number.isFinite(v) && v >= 0 && v < 360;
type MoolatrikonaRange = Readonly<{ sign: number; start: number; end: number }>;
const MOOLATRIKONA: Record<ClassicalPlanet, MoolatrikonaRange> = {
  Sun: { sign: 4, start: 0, end: 20 }, Moon: { sign: 1, start: 3, end: 30 },
  Mars: { sign: 0, start: 0, end: 12 }, Mercury: { sign: 5, start: 15, end: 20 },
  Jupiter: { sign: 8, start: 0, end: 10 }, Venus: { sign: 6, start: 0, end: 15 },
  Saturn: { sign: 10, start: 0, end: 20 },
};
export type Moolatrikona = Readonly<{ status: "in-range" | "outside-range" | "unavailable" | "unselected"; range: MoolatrikonaRange | null; longitude: number | null }>;
/** Half-open degree intervals use unrounded natal longitude, never symbolic varga degrees. */
export function planetaryMoolatrikona(name: PlanetName, physical: readonly Pick<PhysicalPosition, "name" | "longitude">[]): Moolatrikona {
  const range = MOOLATRIKONA[name as ClassicalPlanet];
  if (!range) return { status: "unselected", range: null, longitude: null };
  const positions = physical.filter(p => p.name === name);
  if (positions.length !== 1 || !validLongitude(positions[0].longitude)) return { status: "unavailable", range, longitude: null };
  const longitude = positions[0].longitude;
  const inside = longitude >= range.sign * 30 + range.start && longitude < range.sign * 30 + range.end;
  return { status: inside ? "in-range" : "outside-range", range, longitude };
}
/** Explicit longitude-orb convention, not heliacal visibility or a varga conjunction. */
export function planetaryCombustion(name: PlanetName, physical: readonly PhysicalPosition[]): Combustion {
  const blank = { separation: null, threshold: null };
  if (name === "Sun" || name === "Rahu" || name === "Ketu") return { status: "not-applicable", ...blank };
  const stars = physical.filter(p => p.name === "Sun"), planets = physical.filter(p => p.name === name);
  if (stars.length !== 1 || planets.length !== 1 || !validLongitude(stars[0].longitude) || !validLongitude(planets[0].longitude)) return { status: "unavailable", ...blank };
  const planet = planets[0];
  if ((name === "Mercury" || name === "Venus") && !Number.isFinite(planet.speed)) return { status: "unavailable", ...blank };
  const threshold = { Moon: 12, Mars: 17, Mercury: planet.speed < 0 ? 12 : 14, Jupiter: 11, Venus: planet.speed < 0 ? 8 : 10, Saturn: 15 }[name];
  const arc = Math.abs(planet.longitude - stars[0].longitude), separation = Math.min(arc, 360 - arc);
  return { status: separation < threshold ? "combust" : "clear", separation, threshold };
}
export function chartConditions(chart: VargaChart, physical: readonly PhysicalPosition[] = []) {
  return chart.planets.map(p => ({ name: p.name, sign: p.sign, longitude: p.longitude, dignity: signDignity(p.name, p.sign), combustion: planetaryCombustion(p.name, physical), moolatrikona: planetaryMoolatrikona(p.name, physical) }));
}
