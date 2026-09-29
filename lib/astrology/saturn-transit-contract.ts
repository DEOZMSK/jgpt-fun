import { IANAZone } from "luxon";
import { AstrologyInputError } from "./contracts";
import type { PanchangaInstant } from "./panchanga-contract";
import { EVENT_SCAN_DAYS, EVENT_TOLERANCE_SECONDS, TRANSIT_EVENT_METHOD, type LocatedEvent } from "./transit-events";

export const SATURN_TRANSIT_VERSION = "global-saturn-sign-transits-v1";
export const SADE_SATI_METHOD = "lahiri-moon-sign-12-1-2-v1";
export type SaturnTransitInput = { fromYear: number; toYear: number; timezone: string };
export type SaturnTransitDraft = { fromYear: string; toYear: string; timezone: string };
export type SaturnIngress = Omit<LocatedEvent, "jd" | "kind"> & { ref: string; kind: "ingress"; at: PanchangaInstant };
export type SaturnTransitResult = {
  version: typeof SATURN_TRANSIT_VERSION; method: typeof TRANSIT_EVENT_METHOD; input: SaturnTransitInput;
  engineVersion: string; dataVersions: { node: string; icu: string | null; tz: string | null; luxon: string };
  settings: { ayanamsha: "Lahiri"; swissMode: 1; coordinates: "geocentric"; timeScale: "TT"; scanDays: typeof EVENT_SCAN_DAYS; toleranceSeconds: typeof EVENT_TOLERANCE_SECONDS };
  start: PanchangaInstant; end: PanchangaInstant; initialLongitude: number; events: SaturnIngress[];
};
export type SadeSatiWorkspace = { draft: SaturnTransitDraft; result: SaturnTransitResult | null };
export const emptySadeSatiWorkspace = (): SadeSatiWorkspace => ({ draft: { fromYear: "", toYear: "", timezone: "" }, result: null });

export function isSaturnDraft(raw: unknown): raw is SaturnTransitDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const v = raw as Record<string, unknown>;
  return Object.keys(v).length === 3 && [v.fromYear, v.toYear].every(y => typeof y === "string" && /^\d{0,4}$/.test(y))
    && typeof v.timezone === "string" && v.timezone.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v.timezone);
}
export function normalizeSaturnInput(raw: unknown, currentZone = true): SaturnTransitInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AstrologyInputError("invalid_saturn_range", "Choose a year range and time zone.");
  const v = raw as Record<string, unknown>;
  if (Object.keys(v).length !== 3 || ![v.fromYear, v.toYear].every(y => Number.isInteger(y) && Number(y) >= 1900 && Number(y) <= 2100)
    || Number(v.toYear) < Number(v.fromYear) || typeof v.timezone !== "string" || !v.timezone || v.timezone.length > 80 || /[\u0000-\u001f\u007f]/.test(v.timezone)
    || (currentZone && !IANAZone.isValidZone(v.timezone))) throw new AstrologyInputError("invalid_saturn_range", "Choose a year range and time zone.");
  return { fromYear: Number(v.fromYear), toYear: Number(v.toYear), timezone: v.timezone };
}
export function saturnInput(draft: SaturnTransitDraft) {
  if (!isSaturnDraft(draft)) throw new AstrologyInputError("invalid_saturn_range", "Choose a year range and time zone.");
  return normalizeSaturnInput({ fromYear: Number(draft.fromYear), toYear: Number(draft.toYear), timezone: draft.timezone });
}
export function sadeSatiOutdated(state: SadeSatiWorkspace) {
  if (!state.result) return false;
  try { return JSON.stringify(saturnInput(state.draft)) !== JSON.stringify(state.result.input); } catch { return true; }
}
