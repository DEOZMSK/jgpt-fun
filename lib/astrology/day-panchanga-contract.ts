import { emptyTransitDraft, transitInput, type TransitDraft, type TransitInput, type TransitResult } from "./transit-contract";
import type { PanchangaInstant, PanchangaPart, SolarEvent } from "./panchanga-contract";
import type { MonthInterval } from "./month-panchanga-contract";

export const DAY_PANCHANGA_VERSION = "global-day-panchanga-v1";
export const DAY_PANCHANGA_METHOD = "lahiri-civil-day-hindu-rise-v1";
export type DayPanchangaResult = {
  version: typeof DAY_PANCHANGA_VERSION; method: typeof DAY_PANCHANGA_METHOD;
  input: TransitInput; moment: TransitResult;
  sunriseConvention: "swiss-hindu-center-no-refraction"; solverSeconds: 0.05;
  start: PanchangaInstant; end: PanchangaInstant; solarEvents: SolarEvent[];
  intervals: Record<PanchangaPart | "moonSign", MonthInterval[]>;
  lagna: { status: "available"; intervals: MonthInterval[] } | { status: "unavailable"; reason: "polar-circle" | "unresolved-motion" };
};
export type DayWorkspace = { draft: TransitDraft; result: DayPanchangaResult | null };
export const emptyDayWorkspace = (): DayWorkspace => ({ draft: { ...emptyTransitDraft(), time: "12:00:00" }, result: null });
export function dayReady(state: DayWorkspace, date: string) {
  if (!state.result || state.draft.date !== date) return false;
  try { return JSON.stringify(transitInput(state.draft)) === JSON.stringify(state.result.input); } catch { return false; }
}
