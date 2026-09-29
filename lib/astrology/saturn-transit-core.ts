import * as sweph from "sweph";
import { VERSION as LUXON_VERSION } from "luxon";
import { initializeEngine } from "./swiss-runtime";
import { lahiriMotion } from "./positions-core";
import { civilBoundary, civilDateStart } from "./month-panchanga-core";
import { panchangaInstant, utcToJulianDays } from "./panchanga-core";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD } from "./transit-events";
import { locateSaturnIngresses } from "./sade-sati";
import { SATURN_TRANSIT_VERSION, normalizeSaturnInput, type SaturnTransitResult } from "./saturn-transit-contract";

export function calculateSaturnTransits(raw: unknown): SaturnTransitResult {
  const input = normalizeSaturnInput(raw);
  initializeEngine();
  const start = utcToJulianDays(civilDateStart(`${input.fromYear}-01-01`, input.timezone).toUTC())[0];
  const end = utcToJulianDays(civilDateStart(`${input.toYear + 1}-01-01`, input.timezone).toUTC())[0];
  // Node mode has no effect on Saturn; no birth information is sent to this operation.
  const at = (jd: number) => lahiriMotion(jd, "Saturn", "mean");
  const events = locateSaturnIngresses(start, end, at).map(({ jd, ...e }, index) => ({ ...e, kind: "ingress" as const,
    ref: `saturn-ingress/${index}`, at: panchangaInstant(jd, "TT", input.timezone) }));
  return { version: SATURN_TRANSIT_VERSION, method: TRANSIT_EVENT_METHOD, input, engineVersion: sweph.version(),
    dataVersions: { node: process.versions.node, icu: process.versions.icu ?? null, tz: process.versions.tz ?? null, luxon: LUXON_VERSION },
    settings: { ayanamsha: "Lahiri", swissMode: 1, coordinates: "geocentric", timeScale: "TT", scanDays: EVENT_SCAN_DAYS, toleranceSeconds: EVENT_TOLERANCE_SECONDS },
    start: civilBoundary(civilDateStart(`${input.fromYear}-01-01`, input.timezone), start, "TT"), end: civilBoundary(civilDateStart(`${input.toYear + 1}-01-01`, input.timezone), end, "TT"), initialLongitude: at(start).longitude, events };
}
