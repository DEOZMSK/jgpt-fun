import * as sweph from "sweph";
import { DateTime } from "luxon";
import type { CalculationTime, NormalizedBirth } from "./contracts";
import { containingAngularInterval } from "./angular-events";
import { normalizeDegrees } from "./jyotish";
import { PANCHANGA_METHOD, PANCHANGA_SOLVER_SECONDS, VARA_LORDS, type BirthPanchanga, type PanchangaInstant, type SolarEvent } from "./panchanga-contract";

const c = sweph.constants;

/** Preserve a possible second 60; Date/ISO normalization would erase a leap second. */
export function swissCalendarLabel(date: sweph.DateObject2) {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const millis = Math.floor(date.second * 1000);
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}T${pad(date.hour)}:${pad(date.minute)}:${pad(Math.floor(millis / 1000))}.${pad(millis % 1000, 3)}Z`;
}
export function panchangaInstant(jd: number, scale: "TT" | "UT1", timezone = "Etc/UTC"): PanchangaInstant {
  if (!Number.isFinite(jd)) throw new Error("Invalid event instant");
  const calendar = scale === "TT" ? sweph.jdet_to_utc(jd, c.SE_GREG_CAL) : sweph.jdut1_to_utc(jd, c.SE_GREG_CAL);
  const utc = swissCalendarLabel(calendar);
  // ISO/Luxon cannot represent a leap second: retain UTC and omit its local label.
  const localTime = DateTime.fromISO(utc, { zone: timezone });
  const local = localTime.isValid ? { dateTime: localTime.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"), utcOffsetMinutes: localTime.offset } : null;
  return { jd, scale, utc, local };
}
export function utcToJulianDays(utc: DateTime) {
  const jd = sweph.utc_to_jd(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second + utc.millisecond / 1000, c.SE_GREG_CAL);
  if (jd.flag < 0 || jd.data.some(n => !Number.isFinite(n))) throw new Error("Panchanga civil time unavailable");
  return jd.data;
}

export function panchangaSunMoon(jdTT: number) {
  return [c.SE_SUN, c.SE_MOON].map(body => {
    const position = sweph.calc(jdTT, body, c.SEFLG_SWIEPH | c.SEFLG_SIDEREAL);
    if (position.flag < 0 || !(position.flag & c.SEFLG_SWIEPH) || !Number.isFinite(position.data[0])) throw new Error("Panchanga ephemeris unavailable");
    return normalizeDegrees(position.data[0]);
  }) as [number, number];
}

export function solarEvents(start: number, end: number, birth: Pick<NormalizedBirth, "longitude" | "latitude" | "timezone">): SolarEvent[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 40) throw new Error("Invalid solar search window");
  const events: SolarEvent[] = [];
  for (const kind of ["sunrise", "sunset"] as const) {
    let cursor = start;
    // The bounded scan also handles a polar event appearing after a no-event day.
    for (let n = 0; cursor < end && n < Math.ceil((end - start) * 4) + 4; n++) {
      const event = sweph.rise_trans(cursor, c.SE_SUN, null, c.SEFLG_SWIEPH,
        (kind === "sunrise" ? c.SE_CALC_RISE : c.SE_CALC_SET) | c.SE_BIT_HINDU_RISING,
        [birth.longitude, birth.latitude, 0], 0, 0);
      if (event.flag === -2) { cursor += 0.25; continue; }
      if (event.flag !== 0 || !Number.isFinite(event.data) || event.data < cursor) throw new Error("Solar event unavailable");
      if (event.data >= end) break;
      events.push({ ref: `panchanga/${kind}/${events.filter(e => e.kind === kind).length}`, kind, at: panchangaInstant(event.data, "UT1", birth.timezone) });
      // rise_trans can return the same crossing a few seconds later when seeded
      // immediately after its estimate. A one-minute exclusion window advances
      // past that solution, not to another same-kind daily solar crossing.
      cursor = event.data + 1 / 1440;
    }
  }
  return events.sort((a, b) => a.at.jd - b.at.jd);
}

/** Use only a nearby daily sunrise pair; do not invent a polar calendar rule. */
export function varaForBirth(jdUT1: number, events: readonly SolarEvent[], timezone: string): BirthPanchanga["vara"] {
  const rises = events.filter(e => e.kind === "sunrise").sort((a, b) => a.at.jd - b.at.jd);
  const previous = rises.filter(e => e.at.jd <= jdUT1).at(-1), next = rises.find(e => e.at.jd > jdUT1);
  if (!previous || !next || next.at.jd - previous.at.jd > 1.5) return { status: "unavailable", ref: "panchanga/vara", reason: "no-daily-sunrise-pair" };
  const local = DateTime.fromISO(previous.at.utc, { zone: timezone }), weekday = local.weekday;
  if (!Number.isInteger(weekday)) throw new Error("Vara local date unavailable");
  return { status: "available", ref: "panchanga/vara", weekday, lord: VARA_LORDS[weekday - 1], localDate: local.toISODate()!, utcOffsetMinutes: local.offset,
    start: previous.at, end: next.at, sunriseRefs: [previous.ref, next.ref] };
}

/** Called inside the engine's synchronous Lahiri critical section. */
export function birthPanchanga(birth: NormalizedBirth, time: CalculationTime): BirthPanchanga {
  const cache = new Map<number, [number, number]>();
  const positions = (jd: number) => {
    let pair = cache.get(jd);
    if (!pair) { pair = panchangaSunMoon(jd); cache.set(jd, pair); }
    return pair;
  };
  const phase = (kind: "difference" | "sum" | "moon") => (jd: number) => {
    const [sun, moon] = positions(jd);
    return kind === "moon" ? moon : kind === "sum" ? sun + moon : moon - sun;
  };
  const interval = (part: "tithi" | "nakshatra" | "yoga" | "karana", divisions: number, kind: "difference" | "sum" | "moon") => {
    const found = containingAngularInterval(time.jdTT, divisions, phase(kind), PANCHANGA_SOLVER_SECONDS);
    return { ref: `panchanga/${part}`, index: found.index, start: panchangaInstant(found.start, "TT", birth.timezone), end: panchangaInstant(found.end, "TT", birth.timezone),
      basisRefs: kind === "moon" ? ["natal/Moon"] : ["natal/Sun", "natal/Moon"] };
  };
  const local = DateTime.fromISO(birth.utc, { zone: birth.timezone });
  const start = utcToJulianDays(local.startOf("day").toUTC())[1], end = utcToJulianDays(local.startOf("day").plus({ days: 1 }).toUTC())[1];
  const events = solarEvents(start - 2, end + 2, birth);
  return { method: PANCHANGA_METHOD, ayanamsha: "Lahiri", coordinateKind: "geocentric-sidereal",
    sunriseConvention: "swiss-hindu-center-no-refraction", calendarPolicy: "Swiss UTC or documented UT1 fallback", solverSeconds: PANCHANGA_SOLVER_SECONDS,
    intervals: { tithi: interval("tithi", 30, "difference"), nakshatra: interval("nakshatra", 27, "moon"), yoga: interval("yoga", 27, "sum"), karana: interval("karana", 60, "difference") },
    civilDay: { date: birth.date, timezone: birth.timezone, start: panchangaInstant(start, "UT1", birth.timezone), end: panchangaInstant(end, "UT1", birth.timezone) },
    solarEvents: events, vara: varaForBirth(time.jdUT1, events, birth.timezone) };
}
