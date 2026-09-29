import { calendarDates, MONTH_PANCHANGA_VERSION, normalizeMonthInput, type MonthPanchanga } from "./month-panchanga-contract";
import { PANCHANGA_METHOD, PANCHANGA_PARTS, PANCHANGA_SOLVER_SECONDS, type PanchangaInstant } from "./panchanga-contract";
import { validCalendarInstant } from "./validate-panchanga";
import { lunarPanchanga } from "./jyotish";

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const label = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v);
const degree = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 360;

/** Validate persisted structure and internal relations; never recompute saved events with newer IANA data. */
export function validMonthPanchanga(raw: unknown): raw is MonthPanchanga {
  if (!rec(raw) || !keys(raw, ["version", "method", "input", "engineVersion", "timeData", "timePolicy", "sunriseConvention", "solverSeconds", "start", "end", "intervals", "days"])
    || raw.version !== MONTH_PANCHANGA_VERSION || raw.method !== PANCHANGA_METHOD || !label(raw.engineVersion)
    || !rec(raw.timeData) || !keys(raw.timeData, ["node", "icu", "tz", "luxon"]) || !label(raw.timeData.node) || !label(raw.timeData.luxon)
    || ![raw.timeData.icu, raw.timeData.tz].every(v => v === null || label(v)) || raw.timePolicy !== "Swiss UTC or documented UT1 fallback"
    || raw.sunriseConvention !== "swiss-hindu-center-no-refraction" || raw.solverSeconds !== PANCHANGA_SOLVER_SECONDS) return false;
  let input;
  try { input = normalizeMonthInput(raw.input, false); if (!equal(input, raw.input)) return false; } catch { return false; }
  const dates = calendarDates(input.month);
  const referenceJd = Date.parse(dates[0] + "T00:00:00.000Z") / 86400000 + 2440587.5;
  const instant = (v: unknown, scale: "TT" | "UT1"): v is PanchangaInstant => validCalendarInstant(v, scale, referenceJd, 36);
  if (!instant(raw.start, "TT") || !instant(raw.end, "TT") || raw.end.jd - raw.start.jd < dates.length - 2 || raw.end.jd - raw.start.jd > dates.length + 2
    || !rec(raw.intervals) || !keys(raw.intervals, [...PANCHANGA_PARTS])) return false;
  for (const part of PANCHANGA_PARTS) {
    const intervals = raw.intervals[part], divisions = part === "karana" ? 60 : part === "tithi" ? 30 : 27;
    if (!Array.isArray(intervals) || intervals.length < 8 || intervals.length > 80) return false;
    for (let n = 0; n < intervals.length; n++) {
      const i = intervals[n], previous = intervals[n - 1];
      if (!rec(i) || !keys(i, ["ref", "index", "start", "end"]) || i.ref !== `month/${input.month}/${part}/${n}`
        || !Number.isInteger(i.index) || Number(i.index) < 0 || Number(i.index) >= divisions || !instant(i.start, "TT") || !instant(i.end, "TT")
        || i.end.jd - i.start.jd <= 0 || i.end.jd - i.start.jd > 3 || i.start.jd >= raw.end.jd || i.end.jd <= raw.start.jd) return false;
      if (previous && (!equal(previous.end, i.start) || i.index !== (previous.index + 1) % divisions)) return false;
    }
    if (intervals[0].start.jd > raw.start.jd || intervals.at(-1).end.jd < raw.end.jd) return false;
  }
  if (!Array.isArray(raw.days) || raw.days.length !== dates.length) return false;
  let lastEnd: PanchangaInstant | undefined;
  for (let n = 0; n < dates.length; n++) {
    const d = raw.days[n];
    if (!rec(d) || !keys(d, ["date", "start", "end", "sunrises", "sunsets", "anchors"]) || d.date !== dates[n]
      || !Array.isArray(d.sunrises) || !Array.isArray(d.sunsets) || !Array.isArray(d.anchors)) return false;
    if (d.start === null || d.end === null) {
      if (d.start !== null || d.end !== null || d.sunrises.length || d.sunsets.length || d.anchors.length) return false;
      continue;
    }
    if (!instant(d.start, "UT1") || !instant(d.end, "UT1") || d.end.jd <= d.start.jd || d.end.jd - d.start.jd > 2
      || !d.start.local?.dateTime.startsWith(d.date + "T") || (lastEnd && !equal(lastEnd, d.start))) return false;
    if (!lastEnd && Math.abs(d.start.jd - raw.start.jd) > 0.02) return false;
    lastEnd = d.end;
    for (const list of [d.sunrises, d.sunsets]) {
      if (list.length > 2) return false;
      for (let e = 0; e < list.length; e++) if (!instant(list[e], "UT1") || list[e].jd < d.start.jd || list[e].jd >= d.end.jd || (e && list[e].jd - list[e - 1].jd < 1 / 1440)) return false;
    }
    if (d.anchors.length !== d.sunrises.length) return false;
    for (let a = 0; a < d.anchors.length; a++) {
      const anchor = d.anchors[a];
      if (!rec(anchor) || !keys(anchor, ["at", "sun", "moon", "elements"]) || !instant(anchor.at, "TT") || !degree(anchor.sun) || !degree(anchor.moon)
        || Math.abs(Date.parse(anchor.at.utc) - Date.parse(d.sunrises[a].utc)) > 100 || !equal(anchor.elements, lunarPanchanga(anchor.sun, anchor.moon))) return false;
    }
  }
  return !!lastEnd && Math.abs(lastEnd.jd - raw.end.jd) < 0.02;
}
