import { validCalendarInstant } from "./validate-panchanga";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD, motionAt } from "./transit-events";
import { SATURN_TRANSIT_VERSION, normalizeSaturnInput, type SaturnTransitResult } from "./saturn-transit-contract";

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const label = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v);
const finite = (v: unknown, bound: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= bound;
const degree = (v: unknown): v is number => finite(v, 360) && v >= 0 && v < 360;
const sign = (v: unknown) => Number.isInteger(v) && Number(v) >= 0 && Number(v) < 12;

/** Structural validation of immutable saved events, independent of current Swiss/IANA data. */
export function validSaturnTransits(raw: unknown): raw is SaturnTransitResult {
  if (!rec(raw) || !keys(raw, ["version", "method", "input", "engineVersion", "dataVersions", "settings", "start", "end", "initialLongitude", "events"])
    || raw.version !== SATURN_TRANSIT_VERSION || raw.method !== TRANSIT_EVENT_METHOD || !label(raw.engineVersion) || !rec(raw.dataVersions) || !degree(raw.initialLongitude)) return false;
  let input;
  try { input = normalizeSaturnInput(raw.input, false); if (!equal(input, raw.input)) return false; } catch { return false; }
  const v = raw.dataVersions;
  if (!keys(v, ["node", "icu", "tz", "luxon"]) || !label(v.node) || !label(v.luxon) || ![v.icu, v.tz].every(x => x === null || label(x))) return false;
  if (!equal(raw.settings, { ayanamsha: "Lahiri", swissMode: 1, coordinates: "geocentric", timeScale: "TT", scanDays: EVENT_SCAN_DAYS, toleranceSeconds: EVENT_TOLERANCE_SECONDS })) return false;
  const origin = Date.UTC(input.fromYear, 0, 1) / 86400000 + 2440587.5;
  const last = Date.UTC(input.toYear + 1, 0, 1) / 86400000 + 2440587.5;
  if (!validCalendarInstant(raw.start, "TT", origin, 2) || !validCalendarInstant(raw.end, "TT", last, 2) || !Array.isArray(raw.events) || raw.events.length > 1000) return false;
  const r = raw as unknown as SaturnTransitResult;
  if (Math.abs(r.start.jd - origin) > 1.02 || Math.abs(r.end.jd - last) > 1.02 || r.end.jd <= r.start.jd) return false;
  let currentSign = Math.floor(r.initialLongitude / 30), previous = -Infinity;
  for (let index = 0; index < r.events.length; index++) {
    const e = raw.events[index];
    if (!rec(e) || !keys(e, ["ref", "kind", "at", "bracket", "longitude", "speed", "direction", "fromSign", "toSign"]) || e.ref !== `saturn-ingress/${index}`
      || e.kind !== "ingress" || !["direct", "retrograde"].includes(e.direction as string) || !sign(e.fromSign) || !sign(e.toSign) || !degree(e.longitude)
      || !finite(e.speed, 1) || !validCalendarInstant(e.at, "TT", origin, last - origin + 2) || !Array.isArray(e.bracket) || e.bracket.length !== 2 || !e.bracket.every(x => finite(x, 3000000))) return false;
    const event = r.events[index];
    if (event.at.jd < r.start.jd || event.at.jd >= r.end.jd || event.at.jd - previous < 0.2 / 86400
      || event.bracket[0] > event.at.jd || event.bracket[1] < event.at.jd || (event.bracket[1] - event.bracket[0]) * 86400 > EVENT_TOLERANCE_SECONDS + 0.0001
      || event.toSign !== (event.fromSign + (event.direction === "direct" ? 1 : 11)) % 12
      || event.longitude !== (event.direction === "direct" ? event.toSign : event.fromSign) * 30 || motionAt(event.speed) !== event.direction
      || (event.at.jd - r.start.jd > EVENT_TOLERANCE_SECONDS / 86400 && event.fromSign !== currentSign)) return false;
    currentSign = event.toSign; previous = event.at.jd;
  }
  return true;
}
