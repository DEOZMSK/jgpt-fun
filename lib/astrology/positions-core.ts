import * as sweph from "sweph";
import type { CalculationTime, PlanetName } from "./contracts";
import { nakshatraAt, normalizeDegrees } from "./jyotish";

/** Single-body geocentric longitude/speed for bounded event searches; no houses or natal periods. */
export function lahiriMotion(jdTT: number, name: PlanetName, nodes: "mean" | "true") {
  const c = sweph.constants;
  const ids = { Sun: c.SE_SUN, Moon: c.SE_MOON, Mars: c.SE_MARS, Mercury: c.SE_MERCURY, Jupiter: c.SE_JUPITER, Venus: c.SE_VENUS, Saturn: c.SE_SATURN,
    Rahu: nodes === "mean" ? c.SE_MEAN_NODE : c.SE_TRUE_NODE, Ketu: nodes === "mean" ? c.SE_MEAN_NODE : c.SE_TRUE_NODE };
  const p = sweph.calc(jdTT, ids[name], c.SEFLG_SWIEPH | c.SEFLG_SPEED | c.SEFLG_SIDEREAL);
  if (p.flag < 0 || !(p.flag & c.SEFLG_SWIEPH) || p.data.some(n => !Number.isFinite(n))) throw new Error("Transit ephemeris unavailable");
  return { longitude: normalizeDegrees(p.data[0] + (name === "Ketu" ? 180 : 0)), speed: p.data[3] };
}

/** Caller initializes Lahiri and keeps all Swiss calls in one synchronous section. */
export function lahiriPositions(time: Pick<CalculationTime, "jdTT" | "jdUT1">, location: { latitude: number; longitude: number; nodes: "mean" | "true" }) {
  const c = sweph.constants, flags = c.SEFLG_SWIEPH | c.SEFLG_SPEED | c.SEFLG_SIDEREAL;
  const bodies: ReadonlyArray<[PlanetName, number]> = [
    ["Sun", c.SE_SUN], ["Moon", c.SE_MOON], ["Mars", c.SE_MARS], ["Mercury", c.SE_MERCURY],
    ["Jupiter", c.SE_JUPITER], ["Venus", c.SE_VENUS], ["Saturn", c.SE_SATURN],
    ["Rahu", location.nodes === "mean" ? c.SE_MEAN_NODE : c.SE_TRUE_NODE]
  ];
  const planets = bodies.map(([name, body]) => {
    const result = sweph.calc(time.jdTT, body, flags);
    if (result.flag < 0 || (result.flag & c.SEFLG_SWIEPH) === 0 || result.data.some(n => !Number.isFinite(n))) throw new Error("High precision ephemeris unavailable");
    const longitude = normalizeDegrees(result.data[0]), nakshatra = nakshatraAt(longitude);
    return { name, longitude, speed: result.data[3], sign: Math.floor(longitude / 30), degree: longitude % 30, nakshatra: nakshatra.name, pada: nakshatra.pada };
  });
  const rahu = planets[7], longitude = normalizeDegrees(rahu.longitude + 180), nakshatra = nakshatraAt(longitude);
  planets.push({ name: "Ketu", longitude, speed: rahu.speed, sign: Math.floor(longitude / 30), degree: longitude % 30, nakshatra: nakshatra.name, pada: nakshatra.pada });
  const houses = sweph.houses_ex(time.jdUT1, c.SEFLG_SIDEREAL, location.latitude, location.longitude, "W");
  if (houses.flag < 0 || !Number.isFinite(houses.data.points[0])) throw new Error("Ascendant unavailable");
  const aya = sweph.get_ayanamsa_ex(time.jdTT, c.SEFLG_SWIEPH);
  if (aya.flag < 0 || !Number.isFinite(aya.data)) throw new Error("Chart ayanamsha unavailable");
  return { ascendant: normalizeDegrees(houses.data.points[0]), planets, ayanamshaDegrees: aya.data };
}
