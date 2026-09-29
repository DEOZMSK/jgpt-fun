import { DateTime } from "luxon";
import { EVENT_PLANETS, YEAR_TRANSIT_VERSION, normalizeYearTransitInput, type YearTransitResult } from "./year-transit-contract";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD, motionAt } from "./transit-events";
import { validCalendarInstant } from "./validate-panchanga";
import { normalizeDegrees } from "./jyotish";

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const label = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v);
const finite = (v: unknown, bound: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= bound;
const degree = (v: unknown): v is number => finite(v, 360) && v >= 0 && v < 360;
const sign = (v: unknown) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 11;

/** Validate stored structure and event continuity without a fresh native or IANA calculation. */
export function validYearTransits(raw: unknown): raw is YearTransitResult {
  if (!rec(raw) || !keys(raw, ["version", "method", "input", "engineVersion", "dataVersions", "settings", "start", "end", "initial", "events"])
    || raw.version !== YEAR_TRANSIT_VERSION || raw.method !== TRANSIT_EVENT_METHOD || !label(raw.engineVersion) || !rec(raw.dataVersions)) return false;
  let input;
  try { input = normalizeYearTransitInput(raw.input, false); if (!equal(input, raw.input)) return false; } catch { return false; }
  const v = raw.dataVersions;
  if (!keys(v, ["node", "icu", "tz", "luxon"]) || !label(v.node) || !label(v.luxon) || ![v.icu, v.tz].every(x => x === null || label(x))) return false;
  if (!equal(raw.settings, { ayanamsha: "Lahiri", swissMode: 1, coordinates: "geocentric", timeScale: "TT", scanDays: EVENT_SCAN_DAYS, toleranceSeconds: EVENT_TOLERANCE_SECONDS })) return false;
  const origin = Date.UTC(input.year, 0, 1) / 86400000 + 2440587.5, days = DateTime.utc(input.year).daysInYear;
  if (!validCalendarInstant(raw.start, "TT", origin, 372) || !validCalendarInstant(raw.end, "TT", origin, 372)) return false;
  const r = raw as unknown as YearTransitResult;
  if (Math.abs(r.start.jd - origin) > 1.02 || Math.abs(r.end.jd - origin - days) > 1.02 || r.end.jd - r.start.jd < days - 2 || r.end.jd - r.start.jd > days + 2
    || !Array.isArray(raw.initial) || raw.initial.length !== 9 || !Array.isArray(raw.events) || raw.events.length > 1000) return false;
  for (let n = 0; n < EVENT_PLANETS.length; n++) {
    const p = raw.initial[n];
    if (!rec(p) || !keys(p, ["planet", "longitude", "speed", "sign"]) || p.planet !== EVENT_PLANETS[n] || !degree(p.longitude) || !finite(p.speed, 40) || p.sign !== Math.floor(p.longitude / 30)) return false;
  }
  if (Math.abs(normalizeDegrees(r.initial[7].longitude + 180) - r.initial[8].longitude) > 1e-9 || r.initial[7].speed !== r.initial[8].speed) return false;
  const state = new Map(r.initial.map(p => [p.planet, { sign: p.sign, direction: motionAt(p.speed), last: -Infinity }]));
  for (let n = 0; n < r.events.length; n++) {
    const e = raw.events[n];
    if (!rec(e) || !keys(e, ["ref", "bracket", "kind", "longitude", "speed", "direction", "fromSign", "toSign", "planet", "at"])
      || e.ref !== `transit-event/${input.year}/${n}` || !EVENT_PLANETS.includes(e.planet as never) || !["ingress", "station"].includes(e.kind as string)
      || !["direct", "retrograde"].includes(e.direction as string) || !sign(e.fromSign) || !sign(e.toSign) || !degree(e.longitude) || !finite(e.speed, 40)
      || !validCalendarInstant(e.at, "TT", origin, 372) || !Array.isArray(e.bracket) || e.bracket.length !== 2 || !e.bracket.every(x => finite(x, 3000000))) return false;
    const event = r.events[n], previous = r.events[n - 1], s = state.get(event.planet)!;
    if (event.at.jd < r.start.jd || event.at.jd >= r.end.jd || event.bracket[0] > event.at.jd || event.bracket[1] < event.at.jd
      || (event.bracket[1] - event.bracket[0]) * 86400 > EVENT_TOLERANCE_SECONDS + 0.0001
      || (previous && (previous.at.jd > event.at.jd || (previous.at.jd === event.at.jd && EVENT_PLANETS.indexOf(previous.planet) > EVENT_PLANETS.indexOf(event.planet))))
      || event.at.jd - s.last < 0.2 / 86400) return false;
    const atStart = Math.abs(event.at.jd - r.start.jd) < EVENT_TOLERANCE_SECONDS / 86400;
    if (event.kind === "ingress") {
      const to = (event.fromSign + (event.direction === "direct" ? 1 : 11)) % 12;
      if (event.toSign !== to || event.longitude !== (event.direction === "direct" ? to : event.fromSign) * 30
        || (!atStart && (event.fromSign !== s.sign || event.direction !== s.direction)) || motionAt(event.speed) !== event.direction) return false;
      s.sign = to; s.direction = event.direction;
    } else {
      if (event.fromSign !== event.toSign || event.fromSign !== Math.floor(event.longitude / 30) || Math.abs(event.speed) > 1e-5
        || (!atStart && event.direction === s.direction) || ["Sun", "Moon"].includes(event.planet) || (input.nodes === "mean" && ["Rahu", "Ketu"].includes(event.planet))) return false;
      s.direction = event.direction;
    }
    s.last = event.at.jd;
  }
  const rahu = r.events.filter(e => e.planet === "Rahu"), ketu = r.events.filter(e => e.planet === "Ketu");
  if (rahu.length !== ketu.length) return false;
  return rahu.every((a, n) => { const b = ketu[n]; return a.kind === b.kind && a.direction === b.direction && Math.abs(a.at.jd - b.at.jd) * 86400 <= 0.2
    && b.fromSign === (a.fromSign + 6) % 12 && b.toSign === (a.toSign + 6) % 12; });
}
