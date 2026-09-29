import { DateTime } from "luxon";
import { normalizeBirthInput } from "./contracts";
import { transitInput, transitOutdated, type TransitWorkspace } from "./transit-contract";
import { yearTransitOutdated, type YearTransitWorkspace } from "./year-transit-contract";

export function yearMomentInput(year: YearTransitWorkspace, moment: TransitWorkspace) {
  const input = transitInput(moment.draft);
  if (!year.result || yearTransitOutdated(year) || input.timezone !== year.result.input.timezone || input.nodes !== year.result.input.nodes
    || Number(input.date.slice(0, 4)) !== year.result.input.year) throw new Error("year_moment_mismatch");
  return input;
}
export function yearMomentReady(year: YearTransitWorkspace, moment: TransitWorkspace) {
  if (!moment.result || transitOutdated(moment)) return false;
  try { yearMomentInput(year, moment); return true; } catch { return false; }
}
export function yearMomentUtc(year: YearTransitWorkspace, moment: TransitWorkspace) {
  if (!year.result || yearTransitOutdated(year) || Number(moment.draft.date.slice(0, 4)) !== year.result.input.year) return null;
  // Only resolve the civil clock here; geographic coordinates do not enter this axis.
  try { return normalizeBirthInput({ date: moment.draft.date, time: moment.draft.time, timezone: year.result.input.timezone,
    place: "Calendar axis", latitude: 0, longitude: 0, nodes: year.result.input.nodes, accuracy: "exact",
    ...(moment.draft.utcOffsetMinutes.trim() ? { utcOffsetMinutes: Number(moment.draft.utcOffsetMinutes) } : {}) }).utc; } catch { return null; }
}
export function initialYearMomentDate(year: number, preferred: string, now: Date, timezone: string) {
  const date = DateTime.fromISO(preferred, { zone: "UTC" });
  if (date.isValid && date.toISODate() === preferred && date.year === year) return preferred;
  const current = DateTime.fromJSDate(now, { zone: timezone });
  return current.isValid && current.year === year ? current.toISODate()! : `${year}-01-01`;
}
