import * as sweph from "sweph";
import { VERSION as LUXON_VERSION } from "luxon";
import { initializeEngine } from "./swiss-runtime";
import { lahiriMotion } from "./positions-core";
import { civilBoundary, civilDateStart } from "./month-panchanga-core";
import { panchangaInstant, utcToJulianDays } from "./panchanga-core";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD, locateTransitEvents } from "./transit-events";
import { EVENT_PLANETS, YEAR_TRANSIT_VERSION, normalizeYearTransitInput, type YearTransitResult } from "./year-transit-contract";

export function calculateYearTransits(raw: unknown): YearTransitResult {
  const input = normalizeYearTransitInput(raw);
  initializeEngine();
  const start = utcToJulianDays(civilDateStart(`${input.year}-01-01`, input.timezone).toUTC())[0];
  const end = utcToJulianDays(civilDateStart(`${input.year + 1}-01-01`, input.timezone).toUTC())[0];
  const initial = EVENT_PLANETS.map(planet => { const p = lahiriMotion(start, planet, input.nodes); return { planet, ...p, sign: Math.floor(p.longitude / 30) }; });
  const events = EVENT_PLANETS.flatMap(planet => locateTransitEvents(start, end, jd => lahiriMotion(jd, planet, input.nodes)).map(({ jd, ...event }) => ({ ...event, planet, at: panchangaInstant(jd, "TT", input.timezone) })))
    .sort((a, b) => a.at.jd - b.at.jd || EVENT_PLANETS.indexOf(a.planet) - EVENT_PLANETS.indexOf(b.planet) || a.kind.localeCompare(b.kind))
    .map((e, index) => ({ ref: `transit-event/${input.year}/${index}`, ...e }));
  return { version: YEAR_TRANSIT_VERSION, method: TRANSIT_EVENT_METHOD, input, engineVersion: sweph.version(),
    dataVersions: { node: process.versions.node, icu: process.versions.icu ?? null, tz: process.versions.tz ?? null, luxon: LUXON_VERSION },
    settings: { ayanamsha: "Lahiri", swissMode: 1, coordinates: "geocentric", timeScale: "TT", scanDays: EVENT_SCAN_DAYS, toleranceSeconds: EVENT_TOLERANCE_SECONDS },
    start: civilBoundary(civilDateStart(`${input.year}-01-01`, input.timezone), start, "TT"), end: civilBoundary(civilDateStart(`${input.year + 1}-01-01`, input.timezone), end, "TT"), initial, events };
}
