import { ASTROLOGY_VERSION, PANCHANGA_ASTROLOGY_VERSION, VARGA_ASTROLOGY_VERSION, SPLIT_ASTROLOGY_VERSION, PREVIOUS_ASTROLOGY_VERSION, VARGAS, BASE_VARGAS, type AstrologyCalculationV2, type AstrologyCalculationV3, type AstrologyCalculationV4, type AstrologyCalculationV5, type CurrentAstrologyCalculation, type NormalizedBirth } from "./contracts";
import { calculationProfile, splitCalculationProfile, vargaCalculationProfile, panchangaCalculationProfile, geometricDashaCalculationProfile, chartFacts, VARGA_METHODS } from "./facts";
import { validPanchangaDetails } from "./validate-panchanga";
import { dashaResult, makePeriod, SPLIT_DASHA_CONVENTIONS, GEOMETRIC_DASHA_CONVENTIONS } from "./dasha";
import { divisionalLongitude, nakshatraAt, normalizeDegrees, vimshottariPeriods } from "./jyotish";
import { yoginiDasha } from "./yogini";

import { equalJson as equal } from "./json-equal";
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const bounded = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 80 && !/[\u0000-\u001f\u007f]/.test(v);

/** Internal consistency only, with no IANA lookup or native calculation of a saved snapshot. */
export function validVersionedResult(value: Record<string, unknown>, birth: NormalizedBirth): boolean {
  const geometric = value.version === ASTROLOGY_VERSION;
  const panchanga = geometric || value.version === PANCHANGA_ASTROLOGY_VERSION;
  const expanded = panchanga || value.version === VARGA_ASTROLOGY_VERSION;
  const split = expanded || value.version === SPLIT_ASTROLOGY_VERSION;
  if ((!split && value.version !== PREVIOUS_ASTROLOGY_VERSION) || value.formatVersion !== (geometric ? 6 : panchanga ? 5 : expanded ? 4 : split ? 3 : 2) || !record(value.time) || !record(value.facts) || !record(value.dashas)) return false;
  const result = value as unknown as CurrentAstrologyCalculation | AstrologyCalculationV5 | AstrologyCalculationV4 | AstrologyCalculationV3 | AstrologyCalculationV2, time = value.time;
  if (!equal(result.profile, geometric ? geometricDashaCalculationProfile(birth.nodes) : panchanga ? panchangaCalculationProfile(birth.nodes) : expanded ? vargaCalculationProfile(birth.nodes) : split ? splitCalculationProfile(birth.nodes) : calculationProfile(birth.nodes))) return false;
  if (time.method !== result.profile.methods.time || time.localTime !== birth.time || time.secondsDefaulted !== (birth.time.length === 5)
    || time.timezone !== birth.timezone || time.offsetMinutes !== birth.utcOffsetMinutes || time.utc !== birth.utc
    || !["explicit", "unambiguous-iana"].includes(time.offsetSelection as string) || time.planetScale !== "TT" || time.houseScale !== "UT1"
    || time.swissInputPolicy !== (birth.utc < "1972-01-01" ? "pre-1972-UT1" : "UTC-with-Swiss-UT1-fallback")) return false;
  if (typeof time.jdTT !== "number" || typeof time.jdUT1 !== "number" || !Number.isFinite(time.jdTT) || !Number.isFinite(time.jdUT1)
    || time.jdUT1 !== result.julianDay || Math.abs(time.jdTT - time.jdUT1) > 1
    || Math.abs(time.jdUT1 - (Date.parse(birth.utc) / 86400000 + 2440587.5)) > 1 / 86400) return false;
  const versions = time.dataVersions;
  if (!record(versions) || !bounded(versions.node) || !bounded(versions.luxon) || versions.swiss !== result.engineVersion || versions.leapSeconds !== "Swiss-bundled"
    || !(versions.icu === null || bounded(versions.icu)) || !(versions.tz === null || bounded(versions.tz))) return false;
  for (const varga of expanded ? VARGAS : BASE_VARGAS) {
    const chart = result.charts[varga];
    if (!chart || chart.method !== VARGA_METHODS[varga]) return false;
    if (expanded && (chart.ascendant !== divisionalLongitude(result.ascendant, varga)
      || chart.planets.some(p => p.longitude !== divisionalLongitude(result.planets.find(n => n.name === p.name)!.longitude, varga)))) return false;
  }
  if (!equal(result.facts, chartFacts(result.ascendant, result.planets, result.charts))) return false;
  let moonLongitude = result.planets.find(p => p.name === "Moon")!.longitude;
  if (split) {
    if (!("dashaBasis" in result) || !record(result.dashaBasis)) return false;
    const b = result.dashaBasis;
    if (typeof b.longitude !== "number" || !Number.isFinite(b.longitude) || b.longitude < 0 || b.longitude >= 360
      || typeof b.ayanamshaDegrees !== "number" || !Number.isFinite(b.ayanamshaDegrees) || b.ayanamshaDegrees < 0 || b.ayanamshaDegrees >= 360
      || typeof b.speed !== "number" || !Number.isFinite(b.speed)) return false;
    const nak = nakshatraAt(b.longitude);
    const common = { ref: "dasha-basis/Moon", name: "Moon", method: geometric ? "swiss-true-pushya-geometric-civil-ut-v6" : "swiss-true-pushya-v3", ayanamsha: "Swiss True Pushya", swissMode: 29,
      ayanamshaDegrees: b.ayanamshaDegrees, longitude: b.longitude, speed: b.speed, nakshatra: nak.name, pada: nak.pada };
    let separation: number;
    if (geometric) {
      if (!("time" in b) || !record(b.time) || typeof b.time.jdUT !== "number" || !Number.isFinite(b.time.jdUT)
        || typeof b.time.jdTT !== "number" || !Number.isFinite(b.time.jdTT) || Math.abs(b.time.jdTT - b.time.jdUT) > 1
        || b.time.jdUT !== Date.parse(birth.utc) / 86400000 + 2440587.5
        || !equal(b.time, { ref: "dasha-time/jdUT", method: "civil-as-ut-swiss-deltat-v1", jdUT: b.time.jdUT, jdTT: b.time.jdTT })
        || !("tropicalLongitude" in b) || typeof b.tropicalLongitude !== "number" || !Number.isFinite(b.tropicalLongitude) || b.tropicalLongitude < 0 || b.tropicalLongitude >= 360
        || !equal(b, { ...common, positionKind: "geometric-geocentric", tropicalLongitude: b.tropicalLongitude, timeRef: "dasha-time/jdUT", time: b.time })) return false;
      separation = normalizeDegrees(b.longitude - b.tropicalLongitude + b.ayanamshaDegrees);
    } else {
      if (!equal(b, { ...common, timeRef: "time/jdTT" })) return false;
      separation = normalizeDegrees(b.longitude - moonLongitude - result.settings.ayanamshaDegrees + b.ayanamshaDegrees);
    }
    if (Math.min(separation, 360 - separation) > 1e-7) return false;
    moonLongitude = b.longitude;
  }
  const conventions = geometric ? GEOMETRIC_DASHA_CONVENTIONS : split ? SPLIT_DASHA_CONVENTIONS : undefined;
  const periods = vimshottariPeriods(moonLongitude, birth.utc, conventions?.vimshottari.yearDays ?? 365.25)
    .map(p => makePeriod("vimshottari", p.lord, Date.parse(p.start), Date.parse(p.end), p.level));
  if (!equal(result.periods, periods) || !equal(result.dashas.vimshottari, dashaResult("vimshottari", periods, birth.utc, conventions?.vimshottari))
    || !equal(result.dashas.yogini, yoginiDasha(moonLongitude, birth.utc, conventions?.yogini))) return false;
  return !panchanga || validPanchangaDetails(value.panchangaDetails, result as CurrentAstrologyCalculation | AstrologyCalculationV5);
}
