import type { SolarEvent } from "./panchanga-contract";
import { DateTime } from "luxon";

export const SOLAR_DIVISIONS_METHOD = "sunrise-sunset-half-divisions-v2";
export type SolarHalf = "day" | "night";
export type DaySolarPeriod = { kind: "vara" | "day" | "night" | "rahu" | "abhijit" | "muhurta" | "yamardha"; start: number; end: number; index: number; weekday: number; half: SolarHalf | null; solarDate: string };
/** Separate daylight/night fractions. No fixed 90/48-minute lengths or inferred polar sunrise. */
export function daySolarPeriods(events: readonly SolarEvent[]): DaySolarPeriod[] {
  const rows: DaySolarPeriod[] = [], rises = events.filter(e => e.kind === "sunrise");
  for (let i = 0; i + 1 < rises.length; i++) {
    const first = rises[i], next = rises[i + 1], start = Date.parse(first.at.utc), end = Date.parse(next.at.utc);
    const sets = events.filter(e => e.kind === "sunset" && e.at.jd > first.at.jd && e.at.jd < next.at.jd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 36 * 3600000 || sets.length !== 1 || !first.at.local) continue;
    const sunset = Date.parse(sets[0].at.utc); if (!(sunset > start && sunset < end)) continue;
    const weekday = DateTime.fromISO(first.at.local.dateTime, { zone: "UTC" }).weekday;
    const add = (kind: DaySolarPeriod["kind"], a: number, b: number, index = 0, half: SolarHalf | null = null) => rows.push({ kind, start: a, end: b, index, weekday, half, solarDate: first.at.local!.dateTime.slice(0, 10) });
    add("vara", start, end, weekday - 1); add("day", start, sunset); add("night", sunset, end);
    const eighth = (sunset - start) / 8, fifteenth = (sunset - start) / 15;
    const rahu = [2, 7, 5, 6, 4, 3, 8][weekday - 1] - 1;
    add("rahu", start + rahu * eighth, start + (rahu + 1) * eighth, rahu);
    if (weekday !== 3) add("abhijit", start + 7 * fifteenth, start + 8 * fifteenth, 7);
    for (const [half, a, b] of [["day", start, sunset], ["night", sunset, end]] as const) {
      for (const [kind, count] of [["muhurta", 15], ["yamardha", 8]] as const) {
        // Share exact endpoints so a boundary belongs only to the following interval.
        const boundary = (j: number) => j === count ? b : a + (b - a) * j / count;
        for (let j = 0; j < count; j++) add(kind, boundary(j), boundary(j + 1), j, half);
      }
    }
  }
  return rows;
}

export function solarPeriodAt(periods: readonly DaySolarPeriod[], kind: DaySolarPeriod["kind"], instant: number) {
  return Number.isFinite(instant) ? periods.find(p => p.kind === kind && p.start <= instant && instant < p.end) ?? null : null;
}

/** Select a representable second inside the visible part of a half-open interval. */
export function solarPeriodSelection(period: DaySolarPeriod, start: number, end: number): number | null {
  const at = Math.ceil(Math.max(start, period.start) / 1000) * 1000;
  return Number.isFinite(at) && at < Math.min(end, period.end) ? at : null;
}
