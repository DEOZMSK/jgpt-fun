import { emptyDayWorkspace, type DayWorkspace } from "../astrology/day-panchanga-contract";
import { validDayPanchanga } from "../astrology/validate-day-panchanga";
import { DateTime, IANAZone } from "luxon";
import { ASTROLOGY_VERSION, PANCHANGA_ASTROLOGY_VERSION, VARGA_ASTROLOGY_VERSION, SPLIT_ASTROLOGY_VERSION, VARGAS, BASE_VARGAS, PREVIOUS_ASTROLOGY_VERSION, LEGACY_ASTROLOGY_VERSION, normalizeBirthInput, type AstrologyCalculation, type NormalizedBirth, type DashaSystem, type Varga } from "../astrology/contracts";
import { LEGACY_CALCULATION_VERSION as CALCULATION_ALGORITHM_VERSION, isLegacyNumerologyResult, type LegacyNumerologyResult, type PeriodMode } from "./legacy-record";
import { isChartOverlayMode, type ChartOverlayMode } from "../astrology/chart-overlay";

import { validVersionedResult } from "../astrology/validate-result";
import { CHART_PANELS, type ChartPanel } from "./tool-catalog";
import { emptyMonthWorkspace, isMonthDraft, type MonthWorkspace } from "../astrology/month-panchanga-contract";
import { validMonthPanchanga } from "../astrology/validate-month-panchanga";
import { emptyTransitWorkspace, isTransitDraft, isTransitReference, type TransitWorkspace } from "../astrology/transit-contract";
import { validTransitResult } from "../astrology/validate-transit";
import { EVENT_PLANETS, emptyYearTransitWorkspace, isYearTransitDraft, type YearTransitWorkspace } from "../astrology/year-transit-contract";
import { validYearTransits } from "../astrology/validate-year-transits";
import { emptySadeSatiWorkspace, isSaturnDraft, type SadeSatiWorkspace } from "../astrology/saturn-transit-contract";
import { validSaturnTransits } from "../astrology/validate-saturn-transits";
import { emptyAspectSelection, isAspectSelection, type AspectSelection } from "../astrology/aspects";
import { emptyArudhaSelection, isArudhaSelection, type ArudhaSelection } from "../astrology/karakas-arudhas";
import { emptyAvSelection, isAvSelection, type AvSelection } from "../astrology/ashtakavarga";

export function isCalendarDate(v: unknown): v is string { return typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v) && v >= "1900-01-01" && v <= "2100-12-31" && DateTime.fromISO(v, {zone:"UTC"}).isValid; }
export const WORKSPACE_VERSION = 2;
export type BirthDraft = {
  name: string; date: string; time: string; place: string; latitude: string; longitude: string;
  timezone: string; utcOffsetMinutes: string; accuracy: "exact" | "approximate" | "unknown";
  nodes: "mean" | "true"; folderId: string | null;
};
export const NOTE_LIMIT = 8000;
export type ProfileNote = { id: string; text: string; revision: number; createdAt: string; updatedAt: string };
export type NoteDraft = { profileId: string | null; noteId: string | null; text: string; baseRevision: number | null };
export const emptyNoteDraft = (): NoteDraft => ({ profileId: null, noteId: null, text: "", baseRevision: null });
export const isNoteText = (value: unknown): value is string => typeof value === "string" && value.length <= NOTE_LIMIT && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export type LocalProfile = { id: string; data: BirthDraft; createdAt: string; updatedAt: string; notes?: ProfileNote[]; birthdayReminder?: boolean };
export type LocalFolder = { id: string; name: string; birthdayReminder?: boolean };
export type NumerologyResult = LegacyNumerologyResult;
type CalculationBase = { id: string; profileId: string; input: BirthDraft; fingerprint: string; createdAt: string; imported: boolean };
export type LocalCalculation = CalculationBase & (
  { kind: "astrology"; methodVersion: AstrologyCalculation["version"]; result: AstrologyCalculation }
  | { kind: "numerology"; methodVersion: typeof CALCULATION_ALGORITHM_VERSION; periodMode: PeriodMode; referenceYear: number; result: NumerologyResult }
);
export type WorkspaceData = {
  schemaVersion: 2; profiles: LocalProfile[]; folders: LocalFolder[]; calculations: LocalCalculation[];
  ui: { selectedProfileId: string | null; draft: BirthDraft; selectedCalculationId: string | null;
    varga: Varga; dashaSystem: DashaSystem; southern: boolean; expandedPeriods: string[]; periodMode: PeriodMode; search: string; folderFilter: string | null;
    workbench: WorkbenchState; calendarDate: string; chartOverlay: ChartOverlayMode; noteDraft: NoteDraft; monthPanchanga: MonthWorkspace; dayPanchanga: DayWorkspace; transit: TransitWorkspace; yearTransitMoment: TransitWorkspace; yearTransits: YearTransitWorkspace; sadeSati: SadeSatiWorkspace; aspects: AspectSelection; arudhas: ArudhaSelection; ashtakavarga: AvSelection };
};
export type WorkbenchState = {
  tool: LocalCalculation["kind"];
  panel: ChartPanel;
  selected: Record<LocalCalculation["kind"], string | null>;
  maha: Record<DashaSystem, string | null>;
};
export const emptyWorkbench = (): WorkbenchState => ({ tool: "astrology", panel: "panchanga", selected: { astrology: null, numerology: null }, maha: { vimshottari: null, yogini: null } });
export class WorkspaceError extends Error {
  constructor(public readonly code: string) { super(code); }
}
export const fail = (code: string): never => { throw new WorkspaceError(code); };
export const emptyDraft = (): BirthDraft => ({ name: "", date: "", time: "", place: "", latitude: "", longitude: "", timezone: "", utcOffsetMinutes: "", accuracy: "unknown", nodes: "true", folderId: null });
export const sampleDraft = (): BirthDraft => ({ ...emptyDraft(), name: "Sample person", date: "2000-01-01", time: "12:00", place: "Bishkek", latitude: "42.8746", longitude: "74.5698", timezone: "Asia/Bishkek", accuracy: "exact" });
export const emptyWorkspace = (): WorkspaceData => ({ schemaVersion: 2, profiles: [], folders: [], calculations: [], ui: {
  selectedProfileId: null, draft: emptyDraft(), selectedCalculationId: null, varga: "D1", dashaSystem: "vimshottari", southern: false, sadeSati: emptySadeSatiWorkspace(), aspects: emptyAspectSelection(), arudhas: emptyArudhaSelection(), ashtakavarga: emptyAvSelection(),
  expandedPeriods: [], periodMode: "±5", search: "", folderFilter: null, workbench: emptyWorkbench(), calendarDate: "", chartOverlay: "none", noteDraft: emptyNoteDraft(), monthPanchanga: emptyMonthWorkspace(), dayPanchanga: emptyDayWorkspace(), transit: emptyTransitWorkspace(), yearTransitMoment: emptyTransitWorkspace(), yearTransits: emptyYearTransitWorkspace()
} });
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const string = (v: unknown, max = 160): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const mode = (v: unknown): v is PeriodMode => v === "±5" || v === "+10" || v === "-10";
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
export function isDraft(v: unknown): v is BirthDraft {
  if (!record(v) || !exactKeys(v, Object.keys(emptyDraft()))) return false;
  return ["name", "date", "time", "place", "latitude", "longitude", "timezone", "utcOffsetMinutes"].every(k => string(v[k], k === "name" || k === "place" ? 120 : 80))
    && ["exact", "approximate", "unknown"].includes(v.accuracy as string) && ["mean", "true"].includes(v.nodes as string)
    && (v.folderId === null || uuid(v.folderId));
}
export function validateProfile(draft: BirthDraft, checkCurrentZone = true): BirthDraft {
  if (!isDraft(draft) || !draft.name.trim()) return fail("invalid_profile");
  // Historical records can be archived independently of the engine's supported years.
  if (!/^\d{4}-\d\d-\d\d$/.test(draft.date) || draft.date < "0001-01-01" || draft.date > "2100-12-31" || !DateTime.fromISO(draft.date, { zone: "UTC" }).isValid) return fail("invalid_date");
  if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(draft.time)) return fail("invalid_time");
  if (checkCurrentZone && draft.timezone && !IANAZone.isValidZone(draft.timezone)) return fail("invalid_timezone");
  for (const [field, bound] of [["latitude", 89], ["longitude", 180], ["utcOffsetMinutes", 840]] as const) {
    if (draft[field] && (!draft[field].trim() || !Number.isFinite(Number(draft[field])) || Math.abs(Number(draft[field])) > bound)) return fail(`invalid_${field}`);
  }
  return { ...draft, name: draft.name.trim(), place: draft.place.trim() };
}
export function astrologyInput(draft: BirthDraft) {
  if (!draft.latitude.trim() || !draft.longitude.trim() || !draft.time || !draft.timezone || !draft.place) return fail("missing_birth_details");
  const value = { date: draft.date, time: draft.time, place: draft.place, latitude: Number(draft.latitude), longitude: Number(draft.longitude),
    timezone: draft.timezone, accuracy: draft.accuracy, nodes: draft.nodes, ...(draft.utcOffsetMinutes.trim() ? { utcOffsetMinutes: Number(draft.utcOffsetMinutes) } : {}) };
  normalizeBirthInput(value);
  return value;
}
export function fingerprint(draft: BirthDraft, kind: LocalCalculation["kind"], periodMode: PeriodMode = "±5", year = new Date().getUTCFullYear()): string {
  if (kind === "numerology") return JSON.stringify([kind, CALCULATION_ALGORITHM_VERSION, draft.date, periodMode, year]);
  const b = normalizeBirthInput(astrologyInput(draft));
  return astrologyFingerprint(b, ASTROLOGY_VERSION);
}
export function astrologyFingerprint(b: NormalizedBirth, version: AstrologyCalculation["version"]) {
  const time = version === LEGACY_ASTROLOGY_VERSION ? b.time : b.time.padEnd(8, ":00");
  if (version === ASTROLOGY_VERSION || version === PANCHANGA_ASTROLOGY_VERSION || version === VARGA_ASTROLOGY_VERSION || version === SPLIT_ASTROLOGY_VERSION) return JSON.stringify(["astrology", version, "Lahiri", "whole-sign", "Swiss True Pushya", 365.24219, 365.25, b.date, time, b.timezone, b.latitude, b.longitude, b.utcOffsetMinutes, b.accuracy, b.nodes]);
  return JSON.stringify(["astrology", version, "Lahiri", "whole-sign", 365.25, b.date, time, b.timezone, b.latitude, b.longitude, b.utcOffsetMinutes, b.accuracy, b.nodes]);
}
export function isOutdated(calculation: LocalCalculation, data: WorkspaceData, year = new Date().getUTCFullYear()) {
  const profile = data.profiles.find(p => p.id === calculation.profileId);
  if (!profile) return true;
  try { return calculation.fingerprint !== fingerprint(profile.data, calculation.kind, data.ui.periodMode, year); } catch { return true; }
}
export function hasUnsavedProfile(data: WorkspaceData) {
  const profile = data.profiles.find(p => p.id === data.ui.selectedProfileId);
  return !profile || JSON.stringify(profile.data) !== JSON.stringify(data.ui.draft);
}
export function hasUnsavedNote(data: WorkspaceData) {
  const draft = data.ui.noteDraft;
  if (!draft?.profileId) return false;
  const note = data.profiles.find(p => p.id === draft.profileId)?.notes?.find(n => n.id === draft.noteId);
  return draft.text !== (note?.text ?? "");
}
export function periodKey(period: { lord: string; start: string; level: number; system?: DashaSystem }) { return `${period.system ?? "vimshottari"}:${period.level}:${period.lord}:${period.start}`; }
export const PERIOD_KEY_PATTERN = /^(vimshottari|yogini):[0-3]:(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu):\d{4}-\d\d-\d\dT[\d:.]+Z$/;

/** Validate the import shape, not the scientific truth of its assertions. */
export function assertAstrologyResult(value: unknown, input: BirthDraft): asserts value is AstrologyCalculation {
  const degree = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 360;
  const integer = (n: unknown, max: number, min = 0) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  const names = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  if (!record(value) || ![ASTROLOGY_VERSION, PANCHANGA_ASTROLOGY_VERSION, VARGA_ASTROLOGY_VERSION, SPLIT_ASTROLOGY_VERSION, PREVIOUS_ASTROLOGY_VERSION, LEGACY_ASTROLOGY_VERSION].includes(value.version as typeof ASTROLOGY_VERSION) || !string(value.engineVersion, 40) || !degree(value.ascendant)
    || typeof value.julianDay !== "number" || !Number.isFinite(value.julianDay) || !record(value.settings) || !record(value.birth)
    || !record(value.charts) || !record(value.panchanga)) return fail("invalid_calculation");
  const resultKeys = ["version", "engineVersion", "birth", "settings", "julianDay", "ascendant", "planets", "charts", "panchanga", "periods", "warnings"];
  const panchanga = value.version === ASTROLOGY_VERSION || value.version === PANCHANGA_ASTROLOGY_VERSION;
  const expanded = panchanga || value.version === VARGA_ASTROLOGY_VERSION;
  const split = expanded || value.version === SPLIT_ASTROLOGY_VERSION;
  if (!exactKeys(value, value.version === LEGACY_ASTROLOGY_VERSION ? resultKeys : [...resultKeys, "formatVersion", "profile", "time", "facts", "dashas", ...(split ? ["dashaBasis"] : []), ...(panchanga ? ["panchangaDetails"] : [])])) return fail("invalid_calculation");
  // Use the recorded offset, never today's IANA rules, to validate the saved instant.
  const b = value.birth;
  if (!input.latitude.trim() || !input.longitude.trim() || !input.time || !input.timezone || !input.place.trim()
    || !exactKeys(b, ["date", "time", "place", "timezone", "latitude", "longitude", "accuracy", "nodes", "utc", "utcOffsetMinutes"])
    || b.date !== input.date || b.time !== input.time || b.place !== input.place.trim() || b.timezone !== input.timezone
    || b.latitude !== Number(input.latitude) || b.longitude !== Number(input.longitude) || b.accuracy !== "exact" || input.accuracy !== "exact" || b.nodes !== input.nodes
    || typeof b.utcOffsetMinutes !== "number" || !Number.isFinite(b.utcOffsetMinutes) || Math.abs(b.utcOffsetMinutes) > 840 || !timestamp(b.utc)
    || (input.utcOffsetMinutes.trim() && b.utcOffsetMinutes !== Number(input.utcOffsetMinutes))
    || DateTime.fromISO(`${input.date}T${input.time}`, { zone: "UTC" }).minus({ minutes: b.utcOffsetMinutes }).toISO() !== b.utc) return fail("invalid_calculation");
  if (value.settings.ayanamsha !== "Lahiri" || value.settings.zodiac !== "sidereal" || value.settings.houseSystem !== "whole-sign" || value.settings.yearDays !== (split ? 365.24219 : 365.25) || !degree(value.settings.ayanamshaDegrees)) return fail("invalid_calculation");
  function planets(raw: unknown, full: boolean) {
    if (!Array.isArray(raw) || raw.length !== 9 || new Set(raw.map(p => record(p) ? p.name : null)).size !== 9) return false;
    return raw.every(p => record(p) && names.includes(p.name as string) && degree(p.longitude) && integer(p.sign, 11) && p.sign === Math.floor(Number(p.longitude) / 30)
      && (!full || (typeof p.speed === "number" && Number.isFinite(p.speed) && typeof p.degree === "number" && p.degree >= 0 && p.degree < 30 && string(p.nakshatra, 40) && integer(p.pada, 4, 1))));
  }
  if (!planets(value.planets, true)) return fail("invalid_calculation");
  const expectedVargas = expanded ? VARGAS : BASE_VARGAS;
  if (!exactKeys(value.charts, [...expectedVargas])) return fail("invalid_calculation");
  for (const key of expectedVargas) {
    const chart = value.charts[key];
    if (!record(chart) || !degree(chart.ascendant) || !string(chart.method, 80) || !planets(chart.planets, false)) return fail("invalid_calculation");
  }
  const p = value.panchanga;
  if (!integer(p.tithi, 30, 1) || !integer(p.pada, 4, 1) || !["paksha", "nakshatra", "yoga", "karana", "civilWeekday"].every(k => string(p[k], 50))) return fail("invalid_calculation");
  if (!Array.isArray(value.periods) || value.periods.length !== 9 || !value.periods.every(p => record(p) && names.includes(p.lord as string) && timestamp(p.start) && timestamp(p.end) && p.start < p.end && p.level === 0)) return fail("invalid_calculation");
  if (value.version === LEGACY_ASTROLOGY_VERSION && !value.periods.every(p => exactKeys(p, ["lord", "start", "end", "level"]))) return fail("invalid_calculation");
  if (value.version !== LEGACY_ASTROLOGY_VERSION && !validVersionedResult(value, value.birth as NormalizedBirth)) return fail("invalid_calculation");
  if (!Array.isArray(value.warnings) || value.warnings.length > 20 || !value.warnings.every(w => string(w, 500))) return fail("invalid_calculation");
}
export function validateWorkspace(value: unknown): WorkspaceData {
  if (!record(value) || value.schemaVersion !== WORKSPACE_VERSION || !exactKeys(value, ["schemaVersion", "profiles", "folders", "calculations", "ui"])) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "noteDraft")) value = { ...value, ui: { ...value.ui, noteDraft: emptyNoteDraft() } };
  if (record(value) && record(value.ui) && !Object.hasOwn(value.ui, "calendarDate")) value = { ...value, ui: { ...value.ui, calendarDate: "" } };
  if (record(value) && record(value.ui) && !Object.hasOwn(value.ui, "chartOverlay")) value = { ...value, ui: { ...value.ui, chartOverlay: "none" } };
  if (!record(value)) return fail("invalid_backup");
  // Older v2 exports have no workbench metadata. Normalize a copy, never a snapshot.
  if (record(value.ui) && !Object.hasOwn(value.ui, "workbench") && Array.isArray(value.calculations)) {
    const selectedId = value.ui.selectedCalculationId;
    const selected = value.calculations.find(c => record(c) && c.id === selectedId);
    const workbench = emptyWorkbench();
    if (record(selected) && (selected.kind === "astrology" || selected.kind === "numerology")) {
      workbench.tool = selected.kind; workbench.selected[selected.kind] = selected.id as string;
    }
    value = { ...value, ui: { ...value.ui, workbench } };
  }
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "monthPanchanga")) value = { ...value, ui: { ...value.ui, monthPanchanga: emptyMonthWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "dayPanchanga")) value = { ...value, ui: { ...value.ui, dayPanchanga: emptyDayWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "transit")) value = { ...value, ui: { ...value.ui, transit: emptyTransitWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "yearTransits")) value = { ...value, ui: { ...value.ui, yearTransits: emptyYearTransitWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "yearTransitMoment")) value = { ...value, ui: { ...value.ui, yearTransitMoment: emptyTransitWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "sadeSati")) value = { ...value, ui: { ...value.ui, sadeSati: emptySadeSatiWorkspace() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "aspects")) value = { ...value, ui: { ...value.ui, aspects: emptyAspectSelection() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "arudhas")) value = { ...value, ui: { ...value.ui, arudhas: emptyArudhaSelection() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && !Object.hasOwn(value.ui, "ashtakavarga")) value = { ...value, ui: { ...value.ui, ashtakavarga: emptyAvSelection() } };
  if (!record(value)) return fail("invalid_backup");
  if (record(value.ui) && record(value.ui.ashtakavarga) && !Object.hasOwn(value.ui.ashtakavarga, "stage")) value = { ...value, ui: { ...value.ui, ashtakavarga: { ...value.ui.ashtakavarga, stage: "original" } } };
  if (!record(value)) return fail("invalid_backup");
  for (const key of ["profiles", "folders", "calculations"] as const) if (!Array.isArray(value[key]) || value[key].length > 2000) return fail("invalid_backup");
  const { profiles, folders, calculations } = value as unknown as WorkspaceData;
  const unique = (items: { id: string }[]) => items.every(v => record(v) && uuid(v.id)) && new Set(items.map(v => v.id)).size === items.length;
  if (!unique(profiles) || !unique(folders) || !unique(calculations)) return fail("invalid_backup");
  const folderIds = new Set(folders.map(f => f.id));
  const profileIds = new Set(profiles.map(p => p.id));
  const validReminder = (item: Record<string, unknown>) => !Object.hasOwn(item, "birthdayReminder") || typeof item.birthdayReminder === "boolean";
  if (!folders.every(f => exactKeys(f, ["id", "name", ...(Object.hasOwn(f, "birthdayReminder") ? ["birthdayReminder"] : [])]) && validReminder(f) && string(f.name, 120) && f.name.trim())) return fail("invalid_backup");
  for (const p of profiles) {
    if (!exactKeys(p, ["id", "data", "createdAt", "updatedAt", ...(Object.hasOwn(p, "notes") ? ["notes"] : []), ...(Object.hasOwn(p, "birthdayReminder") ? ["birthdayReminder"] : [])]) || !validReminder(p) || !isDraft(p.data) || !timestamp(p.createdAt) || !timestamp(p.updatedAt)) return fail("invalid_backup");
    if (Object.hasOwn(p, "notes") && (!Array.isArray(p.notes) || p.notes.length > 100 || !unique(p.notes)
      || !p.notes.every(note => exactKeys(note, ["id", "text", "revision", "createdAt", "updatedAt"]) && isNoteText(note.text) && note.text.trim()
        && Number.isSafeInteger(note.revision) && note.revision > 0 && timestamp(note.createdAt) && timestamp(note.updatedAt)))) return fail("invalid_backup");
    validateProfile(p.data, false);
    if (p.data.folderId !== null && !folderIds.has(p.data.folderId)) return fail("invalid_backup");
  }
  for (const c of calculations) {
    if (!profileIds.has(c.profileId) || !isDraft(c.input) || !timestamp(c.createdAt) || typeof c.imported !== "boolean") return fail("invalid_backup");
    validateProfile(c.input, false);
    const base = ["id", "profileId", "input", "fingerprint", "createdAt", "imported", "kind", "methodVersion", "result"];
    if (c.kind === "astrology") {
      if (!exactKeys(c, base) || c.methodVersion !== c.result?.version) return fail("invalid_backup");
      assertAstrologyResult(c.result, c.input);
      if (c.fingerprint !== astrologyFingerprint(c.result.birth, c.result.version)) return fail("invalid_backup");
    } else if (c.kind === "numerology") {
      if (!exactKeys(c, [...base, "periodMode", "referenceYear"]) || c.methodVersion !== CALCULATION_ALGORITHM_VERSION || !mode(c.periodMode)
        || !Number.isInteger(c.referenceYear) || c.referenceYear < 1900 || c.referenceYear > 2200 || c.fingerprint !== fingerprint(c.input, c.kind, c.periodMode, c.referenceYear)
        || !isLegacyNumerologyResult(c.result, c.input.date, c.referenceYear)) return fail("invalid_backup");
    } else return fail("invalid_backup");
  }
  const ui = value.ui;
  if (profiles.reduce((sum, profile) => sum + (profile.notes?.length ?? 0), 0) > 2000) return fail("invalid_backup");
  if (!record(ui) || !record(ui.noteDraft) || !exactKeys(ui.noteDraft, ["profileId", "noteId", "text", "baseRevision"]) || !isNoteText(ui.noteDraft.text)) return fail("invalid_backup");
  const draft = ui.noteDraft;
  if (draft.profileId === null) {
    if (draft.noteId !== null || draft.baseRevision !== null || draft.text !== "") return fail("invalid_backup");
  } else {
    const profile = profiles.find(p => p.id === draft.profileId);
    if (!profile || draft.profileId !== ui.selectedProfileId) return fail("invalid_backup");
    if (draft.noteId === null) { if (draft.baseRevision !== null) return fail("invalid_backup"); }
    else if (!profile.notes?.some(note => note.id === draft.noteId) || !Number.isSafeInteger(draft.baseRevision) || Number(draft.baseRevision) < 1) return fail("invalid_backup");
  }
  if (!record(ui) || !(ui.calendarDate === "" || isCalendarDate(ui.calendarDate)) || !isChartOverlayMode(ui.chartOverlay) || !isAspectSelection(ui.aspects) || !isArudhaSelection(ui.arudhas) || !isAvSelection(ui.ashtakavarga)) return fail("invalid_backup");
  if (!record(ui) || !exactKeys(ui, Object.keys(emptyWorkspace().ui)) || !isDraft(ui.draft) || !mode(ui.periodMode) || !(VARGAS as readonly string[]).includes(ui.varga as string)
    || !["vimshottari", "yogini"].includes(ui.dashaSystem as string) || typeof ui.southern !== "boolean" || !string(ui.search, 120) || !Array.isArray(ui.expandedPeriods) || ui.expandedPeriods.length > 1000
    || !ui.expandedPeriods.every(k => typeof k === "string" && PERIOD_KEY_PATTERN.test(k))) return fail("invalid_backup");
  if (!record(ui.monthPanchanga) || !exactKeys(ui.monthPanchanga, ["draft", "result"]) || !isMonthDraft(ui.monthPanchanga.draft)
    || (ui.monthPanchanga.result !== null && !validMonthPanchanga(ui.monthPanchanga.result))) return fail("invalid_backup");
  if (!record(ui.transit) || !exactKeys(ui.transit, ["draft", "result", "reference"]) || !isTransitDraft(ui.transit.draft) || !isTransitReference(ui.transit.reference)
    || (ui.transit.result !== null && !validTransitResult(ui.transit.result))) return fail("invalid_backup");
  if (!record(ui.dayPanchanga) || !exactKeys(ui.dayPanchanga, ["draft", "result"]) || !isTransitDraft(ui.dayPanchanga.draft)
    || (ui.dayPanchanga.result !== null && !validDayPanchanga(ui.dayPanchanga.result))) return fail("invalid_backup");
  if (!record(ui.yearTransitMoment) || !exactKeys(ui.yearTransitMoment, ["draft", "result", "reference"]) || !isTransitDraft(ui.yearTransitMoment.draft) || ui.yearTransitMoment.reference !== "transit"
    || (ui.yearTransitMoment.result !== null && !validTransitResult(ui.yearTransitMoment.result))) return fail("invalid_backup");
  if (!record(ui.yearTransits) || !exactKeys(ui.yearTransits, ["draft", "result", "planet", "kind"]) || !isYearTransitDraft(ui.yearTransits.draft)
    || !["all", ...EVENT_PLANETS].includes(ui.yearTransits.planet as never) || !["all", "ingress", "station"].includes(ui.yearTransits.kind as string)
    || (ui.yearTransits.result !== null && !validYearTransits(ui.yearTransits.result))) return fail("invalid_backup");
  if (!record(ui.sadeSati) || !exactKeys(ui.sadeSati, ["draft", "result"]) || !isSaturnDraft(ui.sadeSati.draft)
    || (ui.sadeSati.result !== null && !validSaturnTransits(ui.sadeSati.result))) return fail("invalid_backup");
  if (ui.selectedProfileId !== null && !profileIds.has(ui.selectedProfileId as string)) return fail("invalid_backup");
  if (ui.folderFilter !== null && ui.folderFilter !== "unfiled" && !folderIds.has(ui.folderFilter as string)) return fail("invalid_backup");
  if (ui.draft.folderId !== null && !folderIds.has(ui.draft.folderId)) return fail("invalid_backup");
  if (ui.selectedCalculationId !== null && !calculations.some(c => c.id === ui.selectedCalculationId && c.profileId === ui.selectedProfileId)) return fail("invalid_backup");
  const bench = ui.workbench;
  if (!record(bench) || !exactKeys(bench, ["tool", "panel", "selected", "maha"]) || !["astrology", "numerology"].includes(bench.tool as string)
    || !(CHART_PANELS as readonly string[]).includes(bench.panel as string) || !record(bench.selected) || !exactKeys(bench.selected, ["astrology", "numerology"])
    || !record(bench.maha) || !exactKeys(bench.maha, ["vimshottari", "yogini"])) return fail("invalid_backup");
  for (const kind of ["astrology", "numerology"] as const) {
    const id = bench.selected[kind];
    if (id !== null && !calculations.some(c => c.id === id && c.kind === kind && c.profileId === ui.selectedProfileId)) return fail("invalid_backup");
  }
  if (ui.selectedCalculationId !== bench.selected[bench.tool as "astrology" | "numerology"]) return fail("invalid_backup");
  for (const system of ["vimshottari", "yogini"] as const) {
    const key = bench.maha[system];
    if (key !== null && (typeof key !== "string" || !PERIOD_KEY_PATTERN.test(key) || !key.startsWith(`${system}:0:`))) return fail("invalid_backup");
  }
  return structuredClone(value) as WorkspaceData;
}
/** Migrate metadata only. Old snapshots, offsets, mean nodes and drafts stay byte-for-byte equivalent. */
export function decodeWorkspace(value: unknown): WorkspaceData {
  if (!record(value) || value.schemaVersion !== 1) return validateWorkspace(value);
  if (!record(value.ui) || Object.hasOwn(value.ui, "dashaSystem") || !Array.isArray(value.ui.expandedPeriods)
    || !value.ui.expandedPeriods.every(k => typeof k === "string" && /^[0-2]:(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu):\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(k))
    || !Array.isArray(value.calculations) || value.calculations.some(c => record(c) && c.kind === "astrology" && c.methodVersion !== LEGACY_ASTROLOGY_VERSION)) return fail("invalid_backup");
  return validateWorkspace({ ...value, schemaVersion: 2, ui: { ...value.ui, dashaSystem: "vimshottari", expandedPeriods: value.ui.expandedPeriods.map(k => `vimshottari:${k}`) } });
}
