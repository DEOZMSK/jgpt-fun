import { DateTime } from "luxon";
import { AstrologyInputError, normalizeBirthInput, type CalculationTime, type NormalizedBirth, type PlanetPosition, type VargaChart } from "./contracts";

export const TRANSIT_VERSION = "global-lahiri-transit-v1";
export type TransitDraft = { date: string; time: string; place: string; timezone: string; latitude: string; longitude: string; utcOffsetMinutes: string; nodes: "mean" | "true" };
export type TransitInput = { date: string; time: string; place: string; timezone: string; latitude: number; longitude: number; nodes: "mean" | "true"; utcOffsetMinutes?: number };
export type TransitReference = "transit" | "natal-lagna" | "natal-moon";
export type TransitResult = { version: typeof TRANSIT_VERSION; input: TransitInput; instant: NormalizedBirth; time: CalculationTime;
  engineVersion: string; settings: { ayanamsha: "Lahiri"; swissMode: 1; ayanamshaDegrees: number; zodiac: "sidereal"; houseSystem: "whole-sign"; coordinates: "geocentric" };
  ascendant: number; planets: readonly PlanetPosition[]; chart: VargaChart };
export type TransitWorkspace = { draft: TransitDraft; result: TransitResult | null; reference: TransitReference };
export const emptyTransitDraft = (): TransitDraft => ({ date: "", time: "", place: "", timezone: "", latitude: "", longitude: "", utcOffsetMinutes: "", nodes: "true" });
export const emptyTransitWorkspace = (): TransitWorkspace => ({ draft: emptyTransitDraft(), result: null, reference: "transit" });
export const isTransitReference = (v: unknown): v is TransitReference => ["transit", "natal-lagna", "natal-moon"].includes(v as string);
export function isTransitDraft(v: unknown): v is TransitDraft {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return Object.keys(r).length === 8 && ["mean", "true"].includes(r.nodes as string) && Object.keys(emptyTransitDraft()).filter(k => k !== "nodes").every(k => typeof r[k] === "string" && r[k].length <= (k === "place" ? 120 : 80) && !/[\u0000-\u001f\u007f]/.test(r[k]));
}
export function normalizeTransitInput(v: unknown): TransitInput {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !Object.keys(emptyTransitDraft()).includes(k))) throw new AstrologyInputError("invalid_transit", "Check the transit moment and location.");
  const raw = v as TransitInput;
  const b = normalizeBirthInput({ ...raw, accuracy: "exact" });
  return { date: b.date, time: b.time, place: b.place, timezone: b.timezone, latitude: b.latitude, longitude: b.longitude, nodes: b.nodes,
    ...(raw.utcOffsetMinutes !== undefined && raw.utcOffsetMinutes !== null ? { utcOffsetMinutes: b.utcOffsetMinutes } : {}) };
}
export function transitInput(d: TransitDraft): TransitInput {
  if (!isTransitDraft(d) || !d.latitude.trim() || !d.longitude.trim()) throw new AstrologyInputError("invalid_transit", "Enter the transit location.");
  return normalizeTransitInput({ date: d.date, time: d.time, place: d.place, timezone: d.timezone, latitude: Number(d.latitude), longitude: Number(d.longitude), nodes: d.nodes,
    ...(d.utcOffsetMinutes.trim() ? { utcOffsetMinutes: Number(d.utcOffsetMinutes) } : {}) });
}
export function transitOutdated(s: TransitWorkspace) {
  if (!s.result) return false;
  try { return JSON.stringify(transitInput(s.draft)) !== JSON.stringify(s.result.input); } catch { return true; }
}
/** A civil-date step retains the typed clock but requires resolving its new offset afresh. */
export function stepTransitDraft(d: TransitDraft, days: -1 | 1): TransitDraft {
  const date = DateTime.fromISO(d.date, { zone: "UTC" });
  if (!date.isValid || date.toISODate() !== d.date) throw new AstrologyInputError("invalid_date", "Choose a transit date.");
  const next = date.plus({ days }).toISODate()!;
  if (next < "1900-01-01" || next > "2100-12-31") throw new AstrologyInputError("invalid_date", "Transit date is outside the supported range.");
  return { ...d, date: next, utcOffsetMinutes: "" };
}
export function transitHouse(sign: number, referenceSign: number) { return (sign - referenceSign + 12) % 12 + 1; }
