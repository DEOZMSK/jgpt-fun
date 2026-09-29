import { DateTime, IANAZone } from "luxon";
import { AstrologyInputError } from "./contracts";
import { PANCHANGA_METHOD, type PanchangaInstant, type PanchangaPart } from "./panchanga-contract";
import type { lunarPanchanga } from "./jyotish";

export const MONTH_PANCHANGA_VERSION = "global-month-panchanga-v1";
export type MonthInput = { month: string; place: string; timezone: string; latitude: number; longitude: number };
export type MonthDraft = { month: string; place: string; timezone: string; latitude: string; longitude: string };
export const emptyMonthDraft = (): MonthDraft => ({ month: "", place: "", timezone: "", latitude: "", longitude: "" });
export type MonthInterval = { ref: string; index: number; start: PanchangaInstant; end: PanchangaInstant };
export type SunrisePanchanga = { at: PanchangaInstant; sun: number; moon: number; elements: ReturnType<typeof lunarPanchanga> };
export type MonthDay = { date: string; start: PanchangaInstant | null; end: PanchangaInstant | null;
  sunrises: PanchangaInstant[]; sunsets: PanchangaInstant[]; anchors: SunrisePanchanga[] };
export type MonthPanchanga = {
  version: typeof MONTH_PANCHANGA_VERSION; method: typeof PANCHANGA_METHOD; input: MonthInput;
  engineVersion: string; timeData: { node: string; icu: string | null; tz: string | null; luxon: string };
  timePolicy: "Swiss UTC or documented UT1 fallback";
  sunriseConvention: "swiss-hindu-center-no-refraction"; solverSeconds: 0.05;
  start: PanchangaInstant; end: PanchangaInstant;
  intervals: Record<PanchangaPart, MonthInterval[]>; days: MonthDay[];
};
export type MonthWorkspace = { draft: MonthDraft; result: MonthPanchanga | null };
export const emptyMonthWorkspace = (): MonthWorkspace => ({ draft: emptyMonthDraft(), result: null });
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
export function isMonthDraft(v: unknown): v is MonthDraft {
  return rec(v) && Object.keys(v).length === 5 && Object.keys(emptyMonthDraft()).every(k => text(v[k], k === "place" ? 120 : 80));
}
export function normalizeMonthInput(v: unknown, currentTimezone = true): MonthInput {
  const fail = (code: string): never => { throw new AstrologyInputError(code, "Check the calendar month and location."); };
  if (!rec(v) || Object.keys(v).length !== 5 || !Object.keys(emptyMonthDraft()).every(k => Object.hasOwn(v, k))) return fail("invalid_month_calendar");
  if (!text(v.month, 7) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month) || v.month < "1900-01" || v.month > "2100-12") return fail("invalid_month");
  if (!text(v.timezone, 80) || !v.timezone || (currentTimezone && !IANAZone.isValidZone(v.timezone))) return fail("invalid_timezone");
  if (!text(v.place, 120) || !v.place.trim()) return fail("invalid_place");
  if (typeof v.latitude !== "number" || !Number.isFinite(v.latitude) || Math.abs(v.latitude) > 89) return fail("invalid_latitude");
  if (typeof v.longitude !== "number" || !Number.isFinite(v.longitude) || Math.abs(v.longitude) > 180) return fail("invalid_longitude");
  return { month: v.month, place: v.place.trim(), timezone: v.timezone, latitude: v.latitude, longitude: v.longitude };
}
export function monthInput(draft: MonthDraft): MonthInput {
  if (!isMonthDraft(draft) || !draft.latitude.trim() || !draft.longitude.trim()) throw new AstrologyInputError("invalid_month_calendar", "Enter the calendar location.");
  return normalizeMonthInput({ ...draft, latitude: Number(draft.latitude), longitude: Number(draft.longitude) });
}
export function calendarDates(month: string): string[] {
  const first = DateTime.fromISO(month + "-01", { zone: "UTC" });
  return Array.from({ length: first.daysInMonth ?? 0 }, (_, i) => first.plus({ days: i }).toISODate()!);
}
export function isMonthOutdated(state: MonthWorkspace): boolean {
  if (!state.result) return false;
  try { return JSON.stringify(monthInput(state.draft)) !== JSON.stringify(state.result.input); } catch { return true; }
}
