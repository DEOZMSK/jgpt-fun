import type { YearTransitResult } from "./year-transit-contract";
import type { PlanetName } from "./contracts";
import { DateTime } from "luxon";

/** Clip display geometry only. Stored astronomical intervals remain untouched. */
export function intervalGeometry(start: number, end: number, windowStart: number, windowEnd: number) {
  if (![start, end, windowStart, windowEnd].every(Number.isFinite) || end <= start || windowEnd <= windowStart) return null;
  const a = Math.max(start, windowStart), b = Math.min(end, windowEnd);
  return b > a ? { left: 100 * (a - windowStart) / (windowEnd - windowStart), width: 100 * (b - a) / (windowEnd - windowStart) } : null;
}
export function yearSignIntervals(result: YearTransitResult, planet: PlanetName) {
  const initial = result.initial.find(p => p.planet === planet);
  if (!initial) return [];
  let start = result.start, sign = initial.sign;
  const rows = [];
  for (const event of result.events.filter(e => e.planet === planet && e.kind === "ingress")) {
    rows.push({ start, end: event.at, sign, ref: event.ref }); start = event.at; sign = event.toSign;
  }
  rows.push({ start, end: result.end, sign, ref: `${planet}/year-end` });
  return rows;
}

export function yearDirectionIntervals(result: YearTransitResult, planet: PlanetName) {
  const initial = result.initial.find(p => p.planet === planet);
  if (!initial) return [];
  let start = result.start, direction: "direct" | "retrograde" = initial.speed < 0 ? "retrograde" : "direct";
  const rows = [];
  for (const event of result.events.filter(e => e.planet === planet && e.kind === "station")) {
    if (event.at.jd > start.jd) rows.push({ start, end: event.at, direction, ref: `${event.ref}/before` });
    start = event.at; direction = event.direction;
  }
  if (result.end.jd > start.jd) rows.push({ start, end: result.end, direction, ref: `${planet}/direction/year-end` });
  return rows;
}

/** The axis uses actual UTC elapsed time, including unequal months and DST. */
export function yearMonthGeometry(result: YearTransitResult) {
  return Array.from({ length: 12 }, (_, month) => {
    const start = DateTime.fromObject({ year: result.input.year, month: month + 1, day: 1 }, { zone: result.input.timezone }).startOf("day");
    const end = start.plus({ months: 1 }).startOf("day");
    return { month: month + 1, ...intervalGeometry(start.toMillis(), end.toMillis(), Date.parse(result.start.utc), Date.parse(result.end.utc))! };
  });
}

export function yearDateAtFraction(result: YearTransitResult, fraction: number) {
  if (!Number.isFinite(fraction)) return null;
  const start = Date.parse(result.start.utc), end = Date.parse(result.end.utc);
  return DateTime.fromMillis(start + Math.min(end - start - 1, Math.max(0, fraction) * (end - start)), { zone: result.input.timezone }).toISODate();
}
