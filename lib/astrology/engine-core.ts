import * as sweph from "sweph";
import { DateTime } from "luxon";
import { ASTROLOGY_VERSION, VARGAS, normalizeBirthInput, type CurrentAstrologyCalculation, type Varga } from "./contracts";
import { divisionalLongitude, lunarPanchanga, nakshatraAt, normalizeDegrees, vimshottariPeriods } from "./jyotish";

import { astronomyTime } from "./time-scales";
import { geometricDashaCalculationProfile, chartFacts, VARGA_METHODS } from "./facts";
import { birthPanchanga } from "./panchanga-core";
import { dashaResult, makePeriod, GEOMETRIC_DASHA_CONVENTIONS } from "./dasha";
import { yoginiDasha } from "./yogini";
import { initializeEngine } from "./swiss-runtime";
import { lahiriPositions } from "./positions-core";

// One synchronous critical section: no await, mutable request-specific sidereal
// settings, worker threads, remote services or stored personal data.
export function calculateAstrology(input: unknown): CurrentAstrologyCalculation {
  const birth = normalizeBirthInput(input);
  initializeEngine();
  const c = sweph.constants;
  const time = astronomyTime(birth, (input as Record<string, unknown>).utcOffsetMinutes != null);
  const julianDay = time.jdUT1;
  const dashaFlags = c.SEFLG_SWIEPH | c.SEFLG_SPEED | c.SEFLG_TRUEPOS;
  const { ascendant, planets, ayanamshaDegrees } = lahiriPositions(time, birth);
  const methods = VARGA_METHODS;
  const chartFor = (varga: Varga) => ({
    method: methods[varga], ascendant: divisionalLongitude(ascendant, varga),
    planets: planets.map((planet) => {
      const longitude = divisionalLongitude(planet.longitude, varga);
      return { name: planet.name, longitude, sign: Math.floor(longitude / 30) };
    })
  });
  const charts = {} as CurrentAstrologyCalculation["charts"];
  for (const varga of VARGAS) charts[varga] = chartFor(varga);
  let dashaBasis: CurrentAstrologyCalculation["dashaBasis"];
  // Swiss sidereal mode is process-local mutable state. Keep the entire pair
  // synchronous and restore chart mode even if a dasha call fails.
  try {
    sweph.set_sid_mode(c.SE_SIDM_TRUE_PUSHYA, 0, 0);
    // JHora-compatible dasha convention: the resolved civil Julian day is UT.
    // calc_ut applies Delta T once. The natal UTC -> TT/UT1 path stays separate.
    const jdUT = Date.parse(birth.utc) / 86_400_000 + 2440587.5;
    const delta = sweph.deltat_ex(jdUT, c.SEFLG_SWIEPH);
    const moon = sweph.calc_ut(jdUT, c.SE_MOON, dashaFlags | c.SEFLG_SIDEREAL);
    const tropical = sweph.calc_ut(jdUT, c.SE_MOON, dashaFlags);
    // TRUEPOS also changes the reference star of a true ayanamsha.
    const aya = sweph.get_ayanamsa_ex_ut(jdUT, dashaFlags);
    if (moon.flag < 0 || !(moon.flag & c.SEFLG_SWIEPH) || moon.data.some(n => !Number.isFinite(n))
      || tropical.flag < 0 || !(tropical.flag & c.SEFLG_SWIEPH) || !Number.isFinite(tropical.data[0])
      || aya.flag < 0 || !Number.isFinite(aya.data) || !Number.isFinite(delta.data)) throw new Error("Dasha basis unavailable");
    const longitude = normalizeDegrees(moon.data[0]), nak = nakshatraAt(longitude);
    dashaBasis = { ref: "dasha-basis/Moon", name: "Moon", method: "swiss-true-pushya-geometric-civil-ut-v6", ayanamsha: "Swiss True Pushya", swissMode: 29,
      ayanamshaDegrees: aya.data, longitude, speed: moon.data[3], nakshatra: nak.name, pada: nak.pada,
      positionKind: "geometric-geocentric", tropicalLongitude: normalizeDegrees(tropical.data[0]), timeRef: "dasha-time/jdUT",
      time: { ref: "dasha-time/jdUT", method: "civil-as-ut-swiss-deltat-v1", jdUT, jdTT: jdUT + delta.data } };
  } finally { sweph.set_sid_mode(c.SE_SIDM_LAHIRI, 0, 0); }
  const periods = vimshottariPeriods(dashaBasis.longitude, birth.utc, GEOMETRIC_DASHA_CONVENTIONS.vimshottari.yearDays).map(p => makePeriod("vimshottari", p.lord, Date.parse(p.start), Date.parse(p.end), p.level));
  return {
    formatVersion: 6, profile: geometricDashaCalculationProfile(birth.nodes), time, facts: chartFacts(ascendant, planets, charts), dashaBasis,
    panchangaDetails: birthPanchanga(birth, time),
    dashas: { vimshottari: dashaResult("vimshottari", periods, birth.utc, GEOMETRIC_DASHA_CONVENTIONS.vimshottari), yogini: yoginiDasha(dashaBasis.longitude, birth.utc, GEOMETRIC_DASHA_CONVENTIONS.yogini) },
    version: ASTROLOGY_VERSION, engineVersion: sweph.version(), birth, julianDay, ascendant, planets, charts,
    settings: { ayanamsha: "Lahiri", ayanamshaDegrees, zodiac: "sidereal", houseSystem: "whole-sign", yearDays: 365.24219 },
    panchanga: { ...lunarPanchanga(planets[0].longitude, planets[1].longitude), civilWeekday: DateTime.fromISO(birth.utc).setZone(birth.timezone).setLocale("en").weekdayLong! },
    periods,
    warnings: [
      "Local research preview. Jagannatha Hora acceptance and professional method review are still pending.",
      "Twenty explicitly named varga methods are included; user-specific variants are unconfirmed. D2 uses Sun/Leo and Moon/Cancer; D30 uses one-degree longitude units. Divisional coordinates are symbolic.",
      "Panchanga uses Lahiri and Swiss Hindu rising (solar center, no refraction). Polar dates without a daily sunrise pair have no assigned vara. Event-search tolerance is not a claim of observed accuracy.",
      "Historical civil time comes from IANA data and needs confirmation for disputed birth records.",
      "Dashas use geometric Swiss True Pushya with civil time treated as UT. Vimshottari year: 365.24219 days; one JHora reference agrees within 12 seconds, with broader acceptance pending. Yogini uses this Moon with 365.25 days; JHora Yogini options remain unverified.",
      ...(time.swissInputPolicy === "pre-1972-UT1" ? ["Before 1972 Swiss interprets the resolved civil instant as UT1; historical UTC corrections are not reconstructed."] : ["Swiss UTC conversion uses bundled leap seconds and its documented UT1 fallback; future and disputed historical dates need reference checks."])
    ]
  };
}
