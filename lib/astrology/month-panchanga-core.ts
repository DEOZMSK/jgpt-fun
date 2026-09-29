import { DateTime, VERSION as LUXON_VERSION } from "luxon";
import * as sweph from "sweph";
import { initializeEngine } from "./swiss-runtime";
import { containingAngularInterval } from "./angular-events";
import { panchangaInstant, panchangaSunMoon, solarEvents, utcToJulianDays } from "./panchanga-core";
import { lunarPanchanga } from "./jyotish";
import { PANCHANGA_METHOD, PANCHANGA_PARTS, PANCHANGA_SOLVER_SECONDS } from "./panchanga-contract";
import { MONTH_PANCHANGA_VERSION, calendarDates, normalizeMonthInput, type MonthInterval, type MonthPanchanga } from "./month-panchanga-contract";

/** A civil day starts at the earliest existing instant; a deleted date has no row interval. */
export function civilDateStart(date: string, zone: string): DateTime {
  const boundary = DateTime.fromISO(date + "T00:00", { zone }).startOf("day");
  return boundary.getPossibleOffsets().sort((a, b) => a.toMillis() - b.toMillis())[0];
}
export function civilBoundary(local: DateTime, jd: number, scale: "TT" | "UT1" = "UT1") {
  // Preserve the exact civil boundary; a floating JD roundtrip can label midnight
  // one millisecond before its calendar date, especially with historical offsets.
  return { jd, scale, utc: local.toUTC().toISO()!,
    local: { dateTime: local.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"), utcOffsetMinutes: local.offset } };
}
export function calculateMonthPanchanga(raw: unknown): MonthPanchanga {
  const input = normalizeMonthInput(raw);
  initializeEngine();
  const dates = calendarDates(input.month);
  const after = DateTime.fromISO(dates.at(-1)!, { zone: "UTC" }).plus({ days: 1 }).toISODate()!;
  const start = utcToJulianDays(civilDateStart(dates[0], input.timezone).toUTC());
  const end = utcToJulianDays(civilDateStart(after, input.timezone).toUTC());
  const events = solarEvents(start[1], end[1], input);
  const cache = new Map<number, [number, number]>();
  const positions = (jd: number) => { let p = cache.get(jd); if (!p) { p = panchangaSunMoon(jd); cache.set(jd, p); } return p; };
  const intervals = {} as MonthPanchanga["intervals"];
  for (const part of PANCHANGA_PARTS) {
    const divisions = part === "karana" ? 60 : part === "tithi" ? 30 : 27;
    const phase = (jd: number) => { const [sun, moon] = positions(jd); return part === "nakshatra" ? moon : part === "yoga" ? sun + moon : moon - sun; };
    const items: MonthInterval[] = []; let cursor = start[0];
    while (!items.length || items.at(-1)!.end.jd < end[0]) {
      if (items.length >= 80) throw new Error("Calendar interval limit exceeded");
      const i = containingAngularInterval(cursor, divisions, phase, PANCHANGA_SOLVER_SECONDS);
      const previous = items.at(-1);
      if (previous && i.index !== (previous.index + 1) % divisions) throw new Error("Calendar interval sequence unavailable");
      items.push({ ref: `month/${input.month}/${part}/${items.length}`, index: i.index,
        start: previous?.end ?? panchangaInstant(i.start, "TT", input.timezone), end: panchangaInstant(i.end, "TT", input.timezone) });
      cursor = i.end + PANCHANGA_SOLVER_SECONDS / 86400;
    }
    intervals[part] = items;
  }
  const days = dates.map((date, index) => {
    const local = civilDateStart(date, input.timezone);
    if (local.toISODate() !== date) return { date, start: null, end: null, sunrises: [], sunsets: [], anchors: [] };
    const nextLocal = civilDateStart(dates[index + 1] ?? after, input.timezone);
    const a = utcToJulianDays(local.toUTC()), b = utcToJulianDays(nextLocal.toUTC());
    const dayEvents = events.filter(e => e.at.jd >= a[1] && e.at.jd < b[1]);
    const sunrises = dayEvents.filter(e => e.kind === "sunrise").map(e => e.at), sunsets = dayEvents.filter(e => e.kind === "sunset").map(e => e.at);
    const anchors = sunrises.map(at => {
      // Delta T converts the UT1 event directly to TT, avoiding a lossy civil-time roundtrip.
      const delta = sweph.deltat_ex(at.jd, sweph.constants.SEFLG_SWIEPH);
      if (delta.error || !Number.isFinite(delta.data)) throw new Error("Calendar time scale unavailable");
      const tt = at.jd + delta.data, [sun, moon] = positions(tt);
      return { at: panchangaInstant(tt, "TT", input.timezone), sun, moon, elements: lunarPanchanga(sun, moon) };
    });
    return { date, start: civilBoundary(local, a[1]), end: civilBoundary(nextLocal, b[1]), sunrises, sunsets, anchors };
  });
  return { version: MONTH_PANCHANGA_VERSION, method: PANCHANGA_METHOD, input, engineVersion: sweph.version(),
    timeData: { node: process.versions.node, icu: process.versions.icu ?? null, tz: process.versions.tz ?? null, luxon: LUXON_VERSION },
    timePolicy: "Swiss UTC or documented UT1 fallback", sunriseConvention: "swiss-hindu-center-no-refraction", solverSeconds: PANCHANGA_SOLVER_SECONDS,
    start: civilBoundary(civilDateStart(dates[0], input.timezone), start[0], "TT"), end: civilBoundary(civilDateStart(after, input.timezone), end[0], "TT"), intervals, days };
}
