import { DAY_PANCHANGA_METHOD, DAY_PANCHANGA_VERSION, type DayPanchangaResult } from "./day-panchanga-contract";
import { validTransitResult } from "./validate-transit";
import { validCalendarInstant } from "./validate-panchanga";
import { PANCHANGA_PARTS } from "./panchanga-contract";
import type { MonthInterval } from "./month-panchanga-contract";
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Validate saved structure and relations without recalculating ephemerides or current IANA data. */
export function validDayPanchanga(raw: unknown): raw is DayPanchangaResult {
  if (!rec(raw) || !keys(raw, ["version", "method", "input", "moment", "sunriseConvention", "solverSeconds", "start", "end", "solarEvents", "intervals", "lagna"])
    || raw.version !== DAY_PANCHANGA_VERSION || raw.method !== DAY_PANCHANGA_METHOD || raw.sunriseConvention !== "swiss-hindu-center-no-refraction" || raw.solverSeconds !== 0.05
    || !validTransitResult(raw.moment) || !eq(raw.input, raw.moment.input)) return false;
  const r = raw as unknown as DayPanchangaResult, ref = r.moment.time.jdUT1;
  if (!validCalendarInstant(r.start, "UT1", ref) || !validCalendarInstant(r.end, "UT1", ref)) return false;
  const start = Date.parse(r.start.utc), end = Date.parse(r.end.utc), at = Date.parse(r.moment.instant.utc);
  if (!(start <= at && at < end) || end - start < 12 * 3600000 || end - start > 50 * 3600000 || r.start.local?.dateTime.slice(0, 10) !== r.input.date) return false;
  if (!rec(r.intervals) || !keys(r.intervals, [...PANCHANGA_PARTS, "moonSign"])) return false;
  const checkIntervals = (items: unknown, name: string, divisions: number, scale: "TT" | "UT1", max: number) => {
    if (!Array.isArray(items) || !items.length || items.length > max) return false;
    for (let j = 0; j < items.length; j++) {
      const v = items[j];
      if (!rec(v) || !keys(v, ["ref", "index", "start", "end"]) || v.ref !== `day/${name}/${j}` || !Number.isInteger(v.index) || Number(v.index) < 0 || Number(v.index) >= divisions
        || !validCalendarInstant(v.start, scale, ref) || !validCalendarInstant(v.end, scale, ref)) return false;
      const i = v as unknown as MonthInterval;
      if (i.start.jd >= i.end.jd || i.end.jd - i.start.jd > 3.1) return false;
      if (j && (i.index !== (items[j - 1].index + 1) % divisions || !eq(i.start, items[j - 1].end))) return false;
    }
    return Date.parse(items[0].start.utc) <= start + 2 && Date.parse(items.at(-1).end.utc) >= end - 2;
  };
  for (const part of [...PANCHANGA_PARTS, "moonSign"] as const) if (!checkIntervals(r.intervals[part], part, part === "moonSign" ? 12 : part === "tithi" ? 30 : part === "karana" ? 60 : 27, "TT", 8)) return false;
  if (!rec(r.lagna)) return false;
  if (r.lagna.status === "available") { if (!keys(r.lagna, ["status", "intervals"]) || !checkIntervals(r.lagna.intervals, "lagna", 12, "UT1", 27)) return false; }
  else if (!keys(r.lagna, ["status", "reason"]) || r.lagna.status !== "unavailable" || !["polar-circle", "unresolved-motion"].includes(r.lagna.reason)) return false;
  if (!Array.isArray(r.solarEvents) || r.solarEvents.length > 16) return false;
  const counts = { sunrise: 0, sunset: 0 }; let last = -Infinity;
  for (const e of r.solarEvents) {
    if (!rec(e) || !keys(e, ["ref", "kind", "at"]) || !["sunrise", "sunset"].includes(e.kind) || !validCalendarInstant(e.at, "UT1", ref)
      || e.ref !== `panchanga/${e.kind}/${counts[e.kind]++}` || e.at.jd <= last || e.at.jd < r.start.jd - 2 || e.at.jd >= r.end.jd + 2) return false;
    last = e.at.jd;
  }
  return true;
}
