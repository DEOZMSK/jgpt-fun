import { IANAZone } from "luxon";
import { AstrologyInputError, type PlanetName } from "./contracts";
import type { PanchangaInstant } from "./panchanga-contract";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD, type LocatedEvent } from "./transit-events";

export const YEAR_TRANSIT_VERSION = "global-year-transits-v1";
export const EVENT_PLANETS: readonly PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
export type YearTransitInput = { year: number; timezone: string; nodes: "mean" | "true" };
export type YearTransitDraft = { year: string; timezone: string; nodes: "mean" | "true" };
export type YearTransitEvent = Omit<LocatedEvent, "jd"> & { ref: string; planet: PlanetName; at: PanchangaInstant };
export type YearTransitResult = { version: typeof YEAR_TRANSIT_VERSION; method: typeof TRANSIT_EVENT_METHOD; input: YearTransitInput;
  engineVersion: string; dataVersions: { node: string; icu: string | null; tz: string | null; luxon: string };
  settings: { ayanamsha: "Lahiri"; swissMode: 1; coordinates: "geocentric"; timeScale: "TT"; scanDays: typeof EVENT_SCAN_DAYS; toleranceSeconds: typeof EVENT_TOLERANCE_SECONDS };
  start: PanchangaInstant; end: PanchangaInstant;
  initial: { planet: PlanetName; longitude: number; speed: number; sign: number }[]; events: YearTransitEvent[] };
export type YearTransitWorkspace = { draft: YearTransitDraft; result: YearTransitResult | null; planet: PlanetName | "all"; kind: "all" | "ingress" | "station" };
export const emptyYearTransitWorkspace = (): YearTransitWorkspace => ({ draft: { year: "", timezone: "", nodes: "true" }, result: null, planet: "all", kind: "all" });
export function isYearTransitDraft(v: unknown): v is YearTransitDraft {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const d = v as Record<string, unknown>;
  return Object.keys(d).length === 3 && typeof d.year === "string" && d.year.length <= 4 && /^\d*$/.test(d.year)
    && typeof d.timezone === "string" && d.timezone.length <= 80 && !/[\u0000-\u001f\u007f]/.test(d.timezone) && ["mean", "true"].includes(d.nodes as string);
}
export function normalizeYearTransitInput(raw: unknown, currentZone = true): YearTransitInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AstrologyInputError("invalid_transit_year", "Choose a year and time zone.");
  const i = raw as Record<string, unknown>;
  if (Object.keys(i).length !== 3 || !Number.isInteger(i.year) || Number(i.year) < 1900 || Number(i.year) > 2100 || !["mean", "true"].includes(i.nodes as string)
    || typeof i.timezone !== "string" || !i.timezone || i.timezone.length > 80 || /[\u0000-\u001f\u007f]/.test(i.timezone) || (currentZone && !IANAZone.isValidZone(i.timezone))) throw new AstrologyInputError("invalid_transit_year", "Choose a year and time zone.");
  return { year: Number(i.year), timezone: i.timezone, nodes: i.nodes as "mean" | "true" };
}
export function yearTransitInput(d: YearTransitDraft) {
  if (!isYearTransitDraft(d)) throw new AstrologyInputError("invalid_transit_year", "Choose a year and time zone.");
  return normalizeYearTransitInput({ ...d, year: Number(d.year) });
}
export function yearTransitOutdated(s: YearTransitWorkspace) {
  if (!s.result) return false;
  try { return JSON.stringify(yearTransitInput(s.draft)) !== JSON.stringify(s.result.input); } catch { return true; }
}
