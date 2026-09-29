import { DateTime } from "luxon";
import type { CurrentAstrologyCalculation, AstrologyCalculationV5 } from "./contracts";
import { lunarPanchanga, normalizeDegrees } from "./jyotish";
import { PANCHANGA_METHOD, PANCHANGA_PARTS, PANCHANGA_SOLVER_SECONDS, VARA_LORDS } from "./panchanga-contract";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).length === allowed.length && allowed.every(k => Object.hasOwn(v, k));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
import { equalJson as equal } from "./json-equal";

function calendarMillis(v: unknown): number {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:[0-6]\d\.\d{3}Z$/.test(v)) return NaN;
  const leap = v.slice(17, 19) === "60";
  if (Number(v.slice(17, 19)) > 60 || (leap && (v.slice(11, 16) !== "23:59" || !["06-30", "12-31"].includes(v.slice(5, 10)) || v < "1972"))) return NaN;
  const ordinary = leap ? `${v.slice(0, 17)}59${v.slice(19)}` : v;
  const parsed = DateTime.fromISO(ordinary, { zone: "UTC" });
  if (!parsed.isValid || parsed.toISO() !== ordinary) return NaN;
  return parsed.toMillis() + (leap ? 1000 : 0);
}
export function validCalendarInstant(v: unknown, scale: "TT" | "UT1", birthJd: number, maxDays = 6): boolean {
  if (!record(v) || !keys(v, ["jd", "scale", "utc", "local"]) || v.scale !== scale || !finite(v.jd) || Math.abs(v.jd - birthJd) > maxDays) return false;
  const utc = calendarMillis(v.utc);
  if (v.local === null) { if (String(v.utc).slice(17, 19) !== "60") return false; }
  else {
    if (!record(v.local) || !keys(v.local, ["dateTime", "utcOffsetMinutes"]) || typeof v.local.dateTime !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(v.local.dateTime)
      || !finite(v.local.utcOffsetMinutes) || Math.abs(v.local.utcOffsetMinutes) > 840) return false;
    const local = DateTime.fromISO(v.local.dateTime, { zone: "UTC" });
    if (!local.isValid || local.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS") !== v.local.dateTime || Math.abs(local.toMillis() - v.local.utcOffsetMinutes * 60000 - utc) > 1) return false;
  }
  return Number.isFinite(utc) && Math.abs(v.jd - (utc / 86400000 + 2440587.5)) < (scale === "TT" ? 0.02 : 2 / 86400);
}
const instant = validCalendarInstant;

/** Strict structure/internal relations only; saved events never call Swiss or today's IANA data. */
export function validPanchangaDetails(raw: unknown, result: CurrentAstrologyCalculation | AstrologyCalculationV5): boolean {
  if (!record(raw) || !keys(raw, ["method", "ayanamsha", "coordinateKind", "sunriseConvention", "calendarPolicy", "solverSeconds", "intervals", "civilDay", "solarEvents", "vara"])
    || raw.method !== PANCHANGA_METHOD || raw.ayanamsha !== "Lahiri" || raw.coordinateKind !== "geocentric-sidereal"
    || raw.sunriseConvention !== "swiss-hindu-center-no-refraction" || raw.calendarPolicy !== "Swiss UTC or documented UT1 fallback" || raw.solverSeconds !== PANCHANGA_SOLVER_SECONDS
    || !record(raw.intervals) || !keys(raw.intervals, [...PANCHANGA_PARTS])) return false;
  const sun = result.planets.find(p => p.name === "Sun")!.longitude, moon = result.planets.find(p => p.name === "Moon")!.longitude;
  const basic = lunarPanchanga(sun, moon);
  if (!equal(result.panchanga, { ...basic, civilWeekday: DateTime.fromISO(result.birth.date, { zone: "UTC" }).setLocale("en").weekdayLong })) return false;
  const angles = { tithi: normalizeDegrees(moon - sun), karana: normalizeDegrees(moon - sun), nakshatra: moon, yoga: normalizeDegrees(sun + moon) };
  const divisions = { tithi: 30, karana: 60, nakshatra: 27, yoga: 27 };
  for (const part of PANCHANGA_PARTS) {
    const i = raw.intervals[part];
    let index = 0;
    while (index + 1 < divisions[part] && angles[part] >= (index + 1) * 360 / divisions[part]) index++;
    if (!record(i) || !keys(i, ["ref", "index", "start", "end", "basisRefs"]) || i.ref !== `panchanga/${part}` || i.index !== index
      || !instant(i.start, "TT", result.time.jdTT) || !instant(i.end, "TT", result.time.jdTT)
      || !equal(i.basisRefs, part === "nakshatra" ? ["natal/Moon"] : ["natal/Sun", "natal/Moon"])) return false;
    const start = i.start as { jd: number }, end = i.end as { jd: number };
    if (start.jd > result.time.jdTT || end.jd <= result.time.jdTT || end.jd - start.jd <= 0 || end.jd - start.jd > 3) return false;
  }
  const day = raw.civilDay;
  if (!record(day) || !keys(day, ["date", "timezone", "start", "end"]) || day.date !== result.birth.date || day.timezone !== result.birth.timezone
    || !instant(day.start, "UT1", result.time.jdUT1) || !instant(day.end, "UT1", result.time.jdUT1)) return false;
  const start = (day.start as { jd: number }).jd, end = (day.end as { jd: number }).jd;
  if (start > result.time.jdUT1 || end <= result.time.jdUT1 || end - start < 0.5 || end - start > 1.5) return false;
  if (!Array.isArray(raw.solarEvents) || raw.solarEvents.length > 14) return false;
  let previousJd = -Infinity;
  const counts = { sunrise: 0, sunset: 0 };
  for (const e of raw.solarEvents) {
    if (!record(e) || !keys(e, ["ref", "kind", "at"]) || (e.kind !== "sunrise" && e.kind !== "sunset") || !instant(e.at, "UT1", result.time.jdUT1)) return false;
    const jd = (e.at as { jd: number }).jd;
    if (e.ref !== `panchanga/${e.kind}/${counts[e.kind]++}` || jd < start - 2 || jd >= end + 2 || jd <= previousJd) return false;
    previousJd = jd;
  }
  const events = raw.solarEvents as CurrentAstrologyCalculation["panchangaDetails"]["solarEvents"];
  const rises = events.filter(e => e.kind === "sunrise"), previous = rises.filter(e => e.at.jd <= result.time.jdUT1).at(-1), next = rises.find(e => e.at.jd > result.time.jdUT1);
  const vara = raw.vara;
  if (!record(vara)) return false;
  if (!previous || !next || next.at.jd - previous.at.jd > 1.5) return equal(vara, { status: "unavailable", ref: "panchanga/vara", reason: "no-daily-sunrise-pair" });
  if (!keys(vara, ["status", "ref", "weekday", "lord", "localDate", "utcOffsetMinutes", "start", "end", "sunriseRefs"])
    || vara.status !== "available" || vara.ref !== "panchanga/vara" || !finite(vara.utcOffsetMinutes) || Math.abs(vara.utcOffsetMinutes) > 840
    || !equal(vara.start, previous.at) || !equal(vara.end, next.at) || !equal(vara.sunriseRefs, [previous.ref, next.ref])) return false;
  const local = DateTime.fromMillis(calendarMillis(previous.at.utc), { zone: "UTC" }).plus({ minutes: vara.utcOffsetMinutes });
  return local.toISODate() === vara.localDate && local.weekday === vara.weekday && vara.lord === VARA_LORDS[local.weekday - 1];
}
