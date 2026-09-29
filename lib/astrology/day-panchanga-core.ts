import { DateTime } from "luxon";
import * as sweph from "sweph";
import { containingAngularInterval } from "./angular-events";
import { normalizeDegrees } from "./jyotish";
import { civilBoundary, civilDateStart } from "./month-panchanga-core";
import { panchangaInstant, panchangaSunMoon, solarEvents, utcToJulianDays } from "./panchanga-core";
import { PANCHANGA_PARTS, PANCHANGA_SOLVER_SECONDS } from "./panchanga-contract";
import { calculateTransit } from "./transit-core";
import { DAY_PANCHANGA_METHOD, DAY_PANCHANGA_VERSION, type DayPanchangaResult } from "./day-panchanga-contract";
import type { MonthInterval } from "./month-panchanga-contract";

/** Bracket every sign boundary of a continuous, forward-moving ascendant. */
export function risingSignIntervals(start: number, end: number, position: (jdUT1: number) => number, zone: string, step = 1 / 1440): MonthInterval[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 2.1 || !(step > 0 && step <= 1 / 720)) throw new Error("Invalid ascendant window");
  const out: MonthInterval[] = [];
  let previous = start, angle = normalizeDegrees(position(start)), unwrapped = angle, segment = panchangaInstant(start, "UT1", zone), index = Math.floor(angle / 30);
  for (let cursor = Math.min(start + step, end); previous < end; cursor = Math.min(cursor + step, end)) {
    const next = normalizeDegrees(position(cursor)), delta = normalizeDegrees(next - angle);
    if (!Number.isFinite(next) || delta <= 0 || delta >= 180) throw new Error("Ascendant is not continuously rising");
    const high = unwrapped + delta;
    for (let target = (Math.floor(unwrapped / 30) + 1) * 30; target <= high; target += 30) {
      let lo = previous, hi = cursor;
      for (let k = 0; k < 40 && (hi - lo) * 86400 > PANCHANGA_SOLVER_SECONDS; k++) {
        const mid = (lo + hi) / 2, value = unwrapped + normalizeDegrees(position(mid) - angle);
        if (value < target) lo = mid; else hi = mid;
      }
      const boundary = panchangaInstant((lo + hi) / 2, "UT1", zone);
      out.push({ ref: `day/lagna/${out.length}`, index, start: segment, end: boundary });
      segment = boundary; index = (index + 1) % 12;
    }
    previous = cursor; angle = next; unwrapped = high;
    if (out.length > 26) throw new Error("Ascendant interval limit exceeded");
  }
  if (segment.jd < end) out.push({ ref: `day/lagna/${out.length}`, index, start: segment, end: panchangaInstant(end, "UT1", zone) });
  return out;
}

export function calculateDayPanchanga(raw: unknown): DayPanchangaResult {
  const moment = calculateTransit(raw), input = moment.input, zone = input.timezone;
  const local = civilDateStart(input.date, zone), after = DateTime.fromISO(input.date, { zone: "UTC" }).plus({ days: 1 }).toISODate()!;
  const next = civilDateStart(after, zone), a = utcToJulianDays(local.toUTC()), b = utcToJulianDays(next.toUTC());
  const start = civilBoundary(local, a[1]), end = civilBoundary(next, b[1]);
  const cache = new Map<number, [number, number]>();
  const position = (jd: number) => { let value = cache.get(jd); if (!value) { value = panchangaSunMoon(jd); cache.set(jd, value); } return value; };
  const intervals = {} as DayPanchangaResult["intervals"];
  for (const part of [...PANCHANGA_PARTS, "moonSign"] as const) {
    const divisions = part === "moonSign" ? 12 : part === "karana" ? 60 : part === "tithi" ? 30 : 27;
    const phase = (jd: number) => { const [sun, moon] = position(jd); return ["moonSign", "nakshatra"].includes(part) ? moon : part === "yoga" ? sun + moon : moon - sun; };
    const items: MonthInterval[] = []; let cursor = a[0];
    while (!items.length || items.at(-1)!.end.jd < b[0]) {
      if (items.length >= 8) throw new Error("Day interval limit exceeded");
      const value = containingAngularInterval(cursor, divisions, phase);
      if (items.length && value.index !== (items.at(-1)!.index + 1) % divisions) throw new Error("Day interval continuity unavailable");
      items.push({ ref: `day/${part}/${items.length}`, index: value.index, start: items.at(-1)?.end ?? panchangaInstant(value.start, "TT", zone), end: panchangaInstant(value.end, "TT", zone) });
      cursor = value.end + PANCHANGA_SOLVER_SECONDS / 86400;
    }
    intervals[part] = items;
  }
  const c = sweph.constants, obliquity = sweph.calc(moment.time.jdTT, c.SE_ECL_NUT, 0);
  if (obliquity.flag < 0 || !Number.isFinite(obliquity.data[0])) throw new Error("Obliquity unavailable");
  let lagna: DayPanchangaResult["lagna"];
  if (Math.abs(input.latitude) + obliquity.data[0] >= 90) lagna = { status: "unavailable", reason: "polar-circle" };
  else {
    try { lagna = { status: "available", intervals: risingSignIntervals(a[1], b[1], jd => {
      const h = sweph.houses_ex(jd, c.SEFLG_SIDEREAL, input.latitude, input.longitude, "W");
      if (h.flag < 0 || !Number.isFinite(h.data.points[0])) throw new Error("Ascendant unavailable");
      return h.data.points[0];
    }, zone) }; } catch { lagna = { status: "unavailable", reason: "unresolved-motion" }; }
  }
  return { version: DAY_PANCHANGA_VERSION, method: DAY_PANCHANGA_METHOD, input, moment, sunriseConvention: "swiss-hindu-center-no-refraction", solverSeconds: 0.05,
    start, end, intervals, solarEvents: solarEvents(a[1] - 2, b[1] + 2, input), lagna };
}
