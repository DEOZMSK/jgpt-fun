import type { DayPanchangaResult } from "../astrology/day-panchanga-contract";
import { validDayPanchanga } from "../astrology/validate-day-panchanga";
import { ASTROLOGY_VERSION, VARGAS, type AstrologyCalculation, type Varga, type DashaSystem } from "../astrology/contracts";
import { calculationPeriods, findCalculationPeriod } from "../astrology/dasha";
import type { PeriodMode } from "./legacy-record";
import { PERIOD_KEY_PATTERN, isCalendarDate, astrologyFingerprint, assertAstrologyResult, astrologyInput, emptyDraft, emptyWorkbench, emptyWorkspace, fail, fingerprint, hasUnsavedProfile, isDraft, sampleDraft, validateProfile, WorkspaceError, type BirthDraft, type LocalCalculation, type WorkspaceData, type WorkbenchState } from "./model";
import type { WorkspaceStorage } from "./storage";
import type { RecoveryStorageMethods } from "./shared-storage";
import { archiveSignature } from "./shared-archive";
import { CHART_PANELS, RETIRED_CHART_PANELS } from "./tool-catalog";
import { DateTime } from "luxon";
import { isMonthDraft, monthInput, type MonthDraft, type MonthInput, type MonthPanchanga } from "../astrology/month-panchanga-contract";
import { validMonthPanchanga } from "../astrology/validate-month-panchanga";
import { isTransitDraft, isTransitReference, stepTransitDraft, transitInput, type TransitDraft, type TransitInput, type TransitReference, type TransitResult } from "../astrology/transit-contract";
import { validTransitResult } from "../astrology/validate-transit";
import { EVENT_PLANETS, isYearTransitDraft, yearTransitInput, type YearTransitDraft, type YearTransitInput, type YearTransitResult, type YearTransitWorkspace } from "../astrology/year-transit-contract";
import { validYearTransits } from "../astrology/validate-year-transits";
import { isSaturnDraft, saturnInput, type SaturnTransitDraft, type SaturnTransitInput, type SaturnTransitResult } from "../astrology/saturn-transit-contract";
import { validSaturnTransits } from "../astrology/validate-saturn-transits";
import { isAspectSelection, type AspectSelection } from "../astrology/aspects";
import { isArudhaSelection, type ArudhaSelection } from "../astrology/karakas-arudhas";
import { isAvSelection, type AvSelection } from "../astrology/ashtakavarga";
import { emptyNoteDraft, hasUnsavedNote, isNoteText } from "./model";
import { isChartOverlayMode, overlayTransitDraft, overlayTransitReady, type ChartOverlayMode } from "../astrology/chart-overlay";
import { initialYearMomentDate, yearMomentInput } from "../astrology/year-transit-moment";

export type WorkspaceAction =
  | { type: "day-edit"; patch: Partial<TransitDraft> } | { type: "day-date"; date: string }
  | { type: "day-instant"; utc: string } | { type: "day-use-profile" } | { type: "day-use-month" } | { type: "day-now" } | { type: "day-calculate" }
  | { type: "year-moment-edit"; patch: Partial<Omit<TransitDraft, "timezone" | "nodes">> }
  | { type: "year-moment-select"; date: string } | { type: "year-moment-event"; ref: string }
  | { type: "year-moment-use-profile" } | { type: "year-moment-now" } | { type: "year-moment-calculate" }
  | { type: "set-chart-overlay"; mode: ChartOverlayMode }
  | { type: "overlay-transit-at"; utc: string | "now" }
  | { type: "begin-note"; id?: string } | { type: "edit-note-draft"; text: string } | { type: "discard-note-draft" } | { type: "save-note" }
  | { type: "delete-note"; id: string; revision: number }
  | { type: "request-profile-deletion" } | { type: "cancel-profile-deletion" } | { type: "delete-profile"; token: string }
  | { type: "select-ashtakavarga"; selection: AvSelection }
  | { type: "select-arudhas"; selection: ArudhaSelection }
  | { type: "select-aspects"; selection: AspectSelection }
  | { type: "sade-sati-edit"; patch: Partial<SaturnTransitDraft> } | { type: "sade-sati-use-chart" } | { type: "sade-sati-calculate" }
  | { type: "year-transits-edit"; patch: Partial<YearTransitDraft> } | { type: "year-transits-use-profile" } | { type: "year-transits-calculate" }
  | { type: "year-transits-filter"; planet: YearTransitWorkspace["planet"]; kind: YearTransitWorkspace["kind"] } | { type: "year-transits-open"; ref: string }
  | { type: "transit-edit"; patch: Partial<TransitDraft> } | { type: "transit-use-profile" } | { type: "transit-now" }
  | { type: "transit-step"; days: -1 | 1 } | { type: "transit-reference"; reference: TransitReference } | { type: "transit-calculate" }
  | { type: "month-edit"; patch: Partial<MonthDraft> } | { type: "month-use-profile" } | { type: "month-calculate" }
  | { type: "new-profile" } | { type: "sample-profile" } | { type: "reset-draft" }
  | { type: "edit-draft"; patch: Partial<BirthDraft> } | { type: "save-profile" }
  | { type: "select-profile"; id: string } | { type: "open-profile"; id: string }
  | { type: "create-profile"; draft: BirthDraft }
  | { type: "create-folder"; name: string } | { type: "rename-folder"; id: string; name: string }
  | { type: "profile-birthday-reminder"; id: string; enabled: boolean | null }
  | { type: "folder-birthday-reminder"; id: string; enabled: boolean }
  | { type: "enable-birthday-reminders" }
  | { type: "move-profile"; id: string; folderId: string | null }
  | { type: "move-profiles"; ids: string[]; folderId: string | null }
  | { type: "search"; text: string } | { type: "filter-folder"; id: string | null }
  | { type: "calculate"; kind: LocalCalculation["kind"] } | { type: "save-calculation" }
  | { type: "open-calculation"; id: string } | { type: "select-varga"; varga: Varga }
  | { type: "select-dasha-system"; system: DashaSystem }
  | { type: "select-tool"; tool: LocalCalculation["kind"] }
  | { type: "select-panel"; panel: WorkbenchState["panel"] }
  | { type: "select-maha"; key: string }
  | { type: "select-calendar-date"; date: string }
  | { type: "chart-style"; southern: boolean } | { type: "toggle-period"; key: string }
  | { type: "period-mode"; mode: PeriodMode }
  | { type: "retry-storage" } | { type: "recover-storage" }
  | { type: "restore-recovered-calculation"; recoveryId: string; calculationId: string; profileId: string };
export type ProfileDeletion = { token: string; profileId: string; name: string; date: string; calculations: number; notes: number };
export type WorkspaceView = { data: WorkspaceData; loaded: boolean; busy: boolean; saving: boolean; error: string | null; storageError: string | null; result: LocalCalculation | null; results: Record<LocalCalculation["kind"], LocalCalculation | null>; deletion: ProfileDeletion | null };
export type AstrologyTransport = (input: ReturnType<typeof astrologyInput>, signal: AbortSignal) => Promise<AstrologyCalculation>;
export const localAstrologyTransport: AstrologyTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.calculation;
};
const errorCode = (e: unknown) => e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "operation_failed";
export type MonthTransport = (input: MonthInput, signal: AbortSignal) => Promise<MonthPanchanga>;
export const localMonthTransport: MonthTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "month-panchanga", ...input }), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.calendar;
};
export type TransitTransport = (input: TransitInput, signal: AbortSignal) => Promise<TransitResult>;
export const localTransitTransport: TransitTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "transit", ...input }), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.transit;
};
export type YearTransitTransport = (input: YearTransitInput, signal: AbortSignal) => Promise<YearTransitResult>;
export const localYearTransitTransport: YearTransitTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "year-transits", ...input }), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.timeline;
};
export type DayPanchangaTransport = (input: TransitInput, signal: AbortSignal) => Promise<DayPanchangaResult>;
export const localDayPanchangaTransport: DayPanchangaTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "day-panchanga", ...input }), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.day;
};
export type SaturnTransitTransport = (input: SaturnTransitInput, signal: AbortSignal) => Promise<SaturnTransitResult>;
export const localSaturnTransitTransport: SaturnTransitTransport = async (input, signal) => {
  const response = await fetch("/api/astrology/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "saturn-transits", ...input }), credentials: "omit", redirect: "error", cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new WorkspaceError(typeof body.code === "string" && /^[a-z_]{1,50}$/.test(body.code) ? body.code : "engine_unavailable");
  return body.timeline;
};
const UI_ONLY_ACTIONS = new Set<string>([
  "begin-note", "edit-note-draft", "discard-note-draft",
  "sade-sati-edit", "sade-sati-use-chart",
  "select-tool", "select-panel", "select-maha", "reset-draft", "new-profile", "sample-profile",
  "edit-draft", "select-profile", "open-profile", "search", "filter-folder", "open-calculation", "select-varga",
  "select-dasha-system", "chart-style", "toggle-period", "period-mode", "month-edit", "month-use-profile",
  "transit-edit", "transit-use-profile", "transit-now", "transit-step", "transit-reference",
  "year-transits-edit", "year-transits-use-profile", "year-transits-filter", "year-transits-open"
]);

/** Validated action boundary for workspace controls. */
export class WorkspaceController {
  private view: WorkspaceView = { data: emptyWorkspace(), loaded: false, busy: false, saving: false, error: null, storageError: null, result: null, results: { astrology: null, numerology: null }, deletion: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private savedData: WorkspaceData | null = null;
  private initializing: Promise<void> | null = null;
  private flushing: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private atomicWrite = false;
  private recordDone: Promise<void> | null = null;
  private pendingDeletion: { preview: ProfileDeletion; signature: string } | null = null;
  private yearMomentTask: Promise<void> | null = null;
  private yearMomentRequest = 0;
  private dayTask: Promise<void> | null = null;
  private dayRequest = 0;
  constructor(private storage: WorkspaceStorage, private transport: AstrologyTransport = localAstrologyTransport, private now = () => new Date(), private id = () => crypto.randomUUID(), private monthTransport: MonthTransport = localMonthTransport, private transitTransport: TransitTransport = localTransitTransport, private yearTransitTransport: YearTransitTransport = localYearTransitTransport, private saturnTransitTransport: SaturnTransitTransport = localSaturnTransitTransport, private dayTransport: DayPanchangaTransport = localDayPanchangaTransport) {}
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<WorkspaceView>) {
    let results = patch.results ?? this.view.results;
    if (patch.data && patch.data.ui.selectedProfileId !== this.view.data.ui.selectedProfileId) results = { astrology: null, numerology: null };
    if (patch.result) results = { ...results, [patch.result.kind]: patch.result };
    const data = patch.data ?? this.view.data;
    const astro = results.astrology;
    if (astro?.kind === "astrology" && !astro.result.charts[data.ui.varga]) patch.data = { ...data, ui: { ...data.ui, varga: "D1" } };
    this.view = { ...this.view, ...patch, results }; this.listeners.forEach(l => l());
  }
  initialize(): Promise<void> {
    if (this.initializing) return this.initializing;
    this.update({ busy: true, error: null });
    this.initializing = this.loadWorkspace().finally(() => {
      this.initializing = null;
      this.update({ busy: false });
    });
    return this.initializing;
  }
  private async loadWorkspace() {
    try {
      const { data: stored, revision } = await this.storage.load();
      const data: WorkspaceData = { ...stored, ui: { ...stored.ui, selectedCalculationId: stored.ui.workbench.selected.astrology,
        workbench: { ...stored.ui.workbench, tool: "astrology", panel: RETIRED_CHART_PANELS.includes(stored.ui.workbench.panel) ? "panchanga" : stored.ui.workbench.panel } } };
      if (data.ui.yearTransits.result && !data.ui.yearTransitMoment.draft.date) {
        const { input } = data.ui.yearTransits.result;
        data.ui.yearTransitMoment = { ...data.ui.yearTransitMoment, draft: { ...data.ui.yearTransitMoment.draft,
          date: initialYearMomentDate(input.year, data.ui.calendarDate, this.now(), input.timezone), time: "12:00:00", timezone: input.timezone, nodes: input.nodes } };
      }
      this.revision = revision; this.savedData = data;
      this.update({ data, loaded: true, storageError: null, result: data.calculations.find(c => c.id === data.ui.selectedCalculationId) ?? null });
      this.update({ results: { astrology: data.calculations.find(c => c.id === data.ui.workbench.selected.astrology) ?? null, numerology: data.calculations.find(c => c.id === data.ui.workbench.selected.numerology) ?? null } });
    } catch (e) { this.update({ storageError: errorCode(e) }); }
  }
  private persist(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.view.storageError) return Promise.resolve();
    this.update({ saving: true });
    this.flushing = (async () => {
      try {
        while (this.savedData !== this.view.data) {
          const snapshot = this.view.data;
          this.revision = await this.storage.save(snapshot, this.revision);
          this.savedData = snapshot;
        }
      } catch (e) { this.update({ storageError: errorCode(e) }); }
    })().finally(() => { this.flushing = null; this.update({ saving: false }); });
    return this.flushing;
  }
  async dispatch(action: WorkspaceAction): Promise<string | void> {
    try {
      if (!action || typeof action !== "object" || typeof action.type !== "string") return fail("invalid_action");
      if (this.atomicWrite) return fail("operation_busy");
      const recordActionKeys: Record<string, string[]> = { "begin-note": ["type", ...(Object.hasOwn(action, "id") ? ["id"] : [])], "edit-note-draft": ["type", "text"],
        "discard-note-draft": ["type"], "save-note": ["type"], "delete-note": ["type", "id", "revision"],
        "request-profile-deletion": ["type"], "cancel-profile-deletion": ["type"], "delete-profile": ["type", "token"],
        "profile-birthday-reminder": ["type", "id", "enabled"], "folder-birthday-reminder": ["type", "id", "enabled"], "enable-birthday-reminders": ["type"] };
      const keys = Object.hasOwn(recordActionKeys, action.type) ? recordActionKeys[action.type] : null;
      if (keys && (Object.keys(action).length !== keys.length || !keys.every(key => Object.hasOwn(action, key)))) fail("invalid_action");
      if (action.type === "recover-storage") {
        if (Object.keys(action).length !== 1) fail("invalid_action");
        if (this.view.busy || this.view.saving || !this.view.loaded) fail("operation_busy");
        const storage = this.storage as WorkspaceStorage & Partial<RecoveryStorageMethods>;
        const recover = storage.recover?.bind(storage) ?? fail("storage_recovery_unavailable");
        this.update({busy:true,error:null});
        try {
          await recover({data:this.view.data,results:Object.values(this.view.results).filter((item): item is LocalCalculation=>item !== null)});
          this.pendingDeletion = null; this.update({deletion:null,results:{astrology:null,numerology:null},result:null});
          await this.initialize();
        } catch (error) { this.update({storageError:errorCode(error)}); }
        finally { this.update({busy:false}); }
        return;
      }
      if (action.type === "restore-recovered-calculation") return await this.restoreRecoveredCalculation(action);
      if (action.type === "retry-storage") {
        if (!this.view.loaded) return this.initialize();
        this.update({ storageError: null, error: null }); return this.persist();
      }
      if (!this.view.loaded) return fail("storage_unavailable");
      if (action.type.startsWith("day-")) return await this.dayAction(action as Extract<WorkspaceAction, { type: `day-${string}` }>);
      if (action.type.startsWith("year-moment-")) return await this.yearMomentAction(action as Extract<WorkspaceAction, { type: `year-moment-${string}` }>);
      if (action.type === "set-chart-overlay" || action.type === "overlay-transit-at") {
        if (Object.keys(action).length !== 2 || !Object.hasOwn(action, "type") || !Object.hasOwn(action, action.type === "set-chart-overlay" ? "mode" : "utc")) fail("invalid_action");
        return await this.setChartOverlay(action);
      }
      if (action.type === "cancel-profile-deletion") { this.pendingDeletion = null; this.update({ deletion: null, error: null }); return; }
      if (action.type === "request-profile-deletion") {
        if (this.view.busy || this.view.saving) fail("operation_busy");
        if (this.view.storageError) fail(this.view.storageError);
        if (hasUnsavedProfile(this.view.data)) fail("save_draft_first");
        if (hasUnsavedNote(this.view.data)) fail("save_note_first");
        if (Object.values(this.view.results).some(c => c && !this.view.data.calculations.some(saved => saved.id === c.id))) fail("save_result_first");
        const profile = this.view.data.profiles.find(p => p.id === this.view.data.ui.selectedProfileId) ?? fail("profile_missing");
        const preview = { token: this.id(), profileId: profile.id, name: profile.data.name, date: profile.data.date,
          calculations: this.view.data.calculations.filter(c => c.profileId === profile.id).length, notes: profile.notes?.length ?? 0 };
        this.pendingDeletion = { preview, signature: this.deletionSignature(profile.id) }; this.update({ deletion: preview, error: null }); return preview.token;
      }
      const birthdayAction = ["profile-birthday-reminder", "folder-birthday-reminder", "enable-birthday-reminders"].includes(action.type);
      if ((["save-note", "delete-note", "delete-profile"].includes(action.type) || birthdayAction) && this.view.busy) fail("operation_busy");
      if (action.type === "sade-sati-calculate") return await this.calculateSaturnTransits();
      if (action.type === "month-calculate") return await this.calculateMonth();
      if (action.type === "transit-calculate") return await this.calculateTransit();
      if (action.type === "year-transits-calculate") return await this.calculateYearTransits();

      if (action.type === "calculate") return await this.calculate(action.kind);
      // UI edits share immutable archives; record mutations still take an isolated copy.
      const data = UI_ONLY_ACTIONS.has(action.type)
        ? { ...this.view.data, ui: structuredClone(this.view.data.ui) }
        : structuredClone(this.view.data);
      const ui = data.ui;
      const findProfile = (id: string) => data.profiles.find(p => p.id === id) ?? fail("profile_missing");
      const checkFolder = (id: string | null) => { if (id !== null && !data.folders.some(f => f.id === id)) fail("folder_missing"); };
      const folderName = (v: string) => { if (typeof v !== "string" || !v.trim() || v.length > 120 || /[\u0000-\u001f\u007f]/.test(v)) fail("invalid_folder"); return v.trim(); };
      let result = this.view.result;
      let returnedId: string | undefined;
      const switchingProfile = action.type === "new-profile" || action.type === "sample-profile" || action.type === "create-profile"
        || ((action.type === "select-profile" || action.type === "open-profile") && action.id !== ui.selectedProfileId);
      if (switchingProfile && hasUnsavedNote(data)) fail("save_note_first");
      if ((action.type === "new-profile" || action.type === "sample-profile" || action.type === "create-profile"
        || ((action.type === "select-profile" || action.type === "open-profile") && action.id !== ui.selectedProfileId))
        && Object.values(this.view.results).some(c => c && !data.calculations.some(saved => saved.id === c.id))) fail("save_result_first");
      switch (action.type) {
        case "profile-birthday-reminder": {
          if (typeof action.enabled !== "boolean" && action.enabled !== null) fail("invalid_action");
          const profile = findProfile(action.id);
          if (action.enabled === null) delete profile.birthdayReminder;
          else profile.birthdayReminder = action.enabled;
          profile.updatedAt = this.now().toISOString(); break;
        }
        case "folder-birthday-reminder": {
          if (typeof action.enabled !== "boolean") fail("invalid_action");
          const folder = data.folders.find(item => item.id === action.id) ?? fail("folder_missing");
          folder.birthdayReminder = action.enabled; break;
        }
        case "enable-birthday-reminders":
          for (const folder of data.folders) folder.birthdayReminder = true;
          for (const profile of data.profiles) {
            if (!profile.data.folderId && profile.birthdayReminder === undefined) {
              profile.birthdayReminder = true; profile.updatedAt = this.now().toISOString();
            }
          }
          break;
        case "begin-note": {
          if (hasUnsavedNote(data)) fail("save_note_first");
          const profile = findProfile(ui.selectedProfileId ?? fail("profile_missing"));
          const note = action.id === undefined ? null : profile.notes?.find(n => n.id === action.id) ?? fail("note_missing");
          ui.noteDraft = { profileId: profile.id, noteId: note?.id ?? null, text: note?.text ?? "", baseRevision: note?.revision ?? null }; break;
        }
        case "edit-note-draft":
          if (!isNoteText(action.text)) fail("invalid_note");
          if (!ui.selectedProfileId || ui.noteDraft.profileId !== ui.selectedProfileId) fail("profile_missing");
          ui.noteDraft = { ...ui.noteDraft, text: action.text }; break;
        case "discard-note-draft": ui.noteDraft = emptyNoteDraft(); break;
        case "save-note": {
          const draft = ui.noteDraft, profile = findProfile(ui.selectedProfileId ?? fail("profile_missing"));
          if (draft.profileId !== profile.id || !isNoteText(draft.text) || !draft.text.trim()) fail("invalid_note");
          const notes = profile.notes ?? [], timestamp = this.now().toISOString();
          let note = notes.find(n => n.id === draft.noteId);
          if (draft.noteId !== null) {
            const existing = note ?? fail("note_changed");
            if (existing.revision !== draft.baseRevision) fail("note_changed");
            if (existing.text !== draft.text) {
              if (existing.revision >= Number.MAX_SAFE_INTEGER) fail("workspace_limit");
              existing.text = draft.text; existing.updatedAt = timestamp; existing.revision++;
            }
          } else {
            if (notes.length >= 100 || data.profiles.reduce((sum, p) => sum + (p.notes?.length ?? 0), 0) >= 2000) fail("workspace_limit");
            note = { id: this.id(), text: draft.text, revision: 1, createdAt: timestamp, updatedAt: timestamp }; notes.push(note);
          }
          profile.notes = notes; profile.updatedAt = timestamp; returnedId = note!.id;
          ui.noteDraft = { profileId: profile.id, noteId: note!.id, text: note!.text, baseRevision: note!.revision }; break;
        }
        case "delete-note": {
          if (hasUnsavedNote(data)) fail("save_note_first");
          const profile = findProfile(ui.selectedProfileId ?? fail("profile_missing")), note = profile.notes?.find(n => n.id === action.id) ?? fail("note_missing");
          if (!Number.isSafeInteger(action.revision) || note.revision !== action.revision) fail("note_changed");
          profile.notes = profile.notes!.filter(n => n.id !== note.id); profile.updatedAt = this.now().toISOString();
          if (ui.noteDraft.noteId === note.id) ui.noteDraft = emptyNoteDraft(); returnedId = note.id; break;
        }
        case "delete-profile": {
          const pending = this.pendingDeletion ?? fail("deletion_confirmation_required");
          if (action.token !== pending.preview.token) fail("deletion_confirmation_required");
          if (ui.selectedProfileId !== pending.preview.profileId || this.deletionSignature(pending.preview.profileId) !== pending.signature
            || hasUnsavedProfile(data) || hasUnsavedNote(data) || Object.values(this.view.results).some(c => c && !data.calculations.some(saved => saved.id === c.id))) fail("deletion_changed");
          const id = pending.preview.profileId;
          data.profiles = data.profiles.filter(p => p.id !== id); data.calculations = data.calculations.filter(c => c.profileId !== id);
          Object.assign(ui, { ...emptyWorkspace().ui, southern: ui.southern, periodMode: ui.periodMode }); result = null; returnedId = id; break;
        }
        case "open-profile": {
          const p = findProfile(action.id);
          if (p.id !== ui.selectedProfileId && hasUnsavedProfile(data) && (ui.draft.name || ui.draft.date)) fail("save_draft_first");
          if (p.id !== ui.selectedProfileId) {
            ui.selectedProfileId = p.id; ui.draft = { ...p.data }; ui.expandedPeriods = []; ui.workbench = emptyWorkbench();
          }
          result = this.view.results.astrology?.profileId === p.id ? this.view.results.astrology
            : [...data.calculations].reverse().find(c => c.profileId === p.id && c.kind === "astrology") ?? null;
          ui.workbench.tool = "astrology";
          ui.selectedCalculationId = result && data.calculations.some(c => c.id === result!.id) ? result.id : null;
          ui.workbench.selected.astrology = ui.selectedCalculationId;
          if (result?.kind === "astrology" && !("dashas" in result.result)) ui.dashaSystem = "vimshottari";
          break;
        }
        case "select-tool": {
          if (!["astrology", "numerology"].includes(action.tool)) fail("invalid_action");
          ui.workbench.tool = action.tool; result = this.view.results[action.tool];
          ui.selectedCalculationId = ui.workbench.selected[action.tool]; break;
        }
        case "select-panel":
          if (!(CHART_PANELS as readonly string[]).includes(action.panel) || RETIRED_CHART_PANELS.includes(action.panel)) fail("invalid_action");
          ui.workbench.panel = action.panel; break;
        case "select-maha": {
          if (result?.kind !== "astrology" || typeof action.key !== "string" || !action.key.startsWith(`${ui.dashaSystem}:0:`)
            || !findCalculationPeriod(result.result, action.key)) fail("invalid_action");
          ui.workbench.maha[ui.dashaSystem] = action.key; ui.workbench.panel = "periods"; break;
        }
        case "create-profile": {
          if (hasUnsavedProfile(data) && (ui.draft.name || ui.draft.date)) fail("save_draft_first");
          const normalized = validateProfile(action.draft); checkFolder(normalized.folderId);
          returnedId = this.id(); data.profiles.push({ id: returnedId, data: normalized, createdAt: this.now().toISOString(), updatedAt: this.now().toISOString() });
          ui.selectedProfileId = returnedId; ui.draft = normalized; ui.selectedCalculationId = null; ui.expandedPeriods = []; result = null; break;
        }
        case "reset-draft": ui.draft = ui.selectedProfileId ? { ...findProfile(ui.selectedProfileId).data } : emptyDraft(); break;
        case "new-profile": case "sample-profile":
          if (hasUnsavedProfile(data) && (ui.draft.name || ui.draft.date)) fail("save_draft_first");
          ui.selectedProfileId = null; ui.selectedCalculationId = null;
          ui.draft = action.type === "sample-profile" ? sampleDraft() : { ...emptyDraft(), folderId: data.folders.find(folder => folder.id === ui.folderFilter)?.id ?? null };
          result = null; ui.expandedPeriods = []; break;
        case "edit-draft": {
          const next = { ...ui.draft, ...action.patch };
          if (!isDraft(next)) fail("invalid_profile"); checkFolder(next.folderId); ui.draft = next; break;
        }
        case "save-profile": {
          const normalized = validateProfile(ui.draft); checkFolder(normalized.folderId);
          if (ui.selectedProfileId) { const p = findProfile(ui.selectedProfileId); p.data = normalized; p.updatedAt = this.now().toISOString(); returnedId = p.id; }
          else { returnedId = this.id(); data.profiles.push({ id: returnedId, data: normalized, createdAt: this.now().toISOString(), updatedAt: this.now().toISOString() }); ui.selectedProfileId = returnedId; }
          ui.draft = normalized; break;
        }
        case "select-profile": {
          if (action.id === ui.selectedProfileId) { this.update({ error: null }); return; }
          if (hasUnsavedProfile(data) && (ui.draft.name || ui.draft.date)) fail("save_draft_first");
          const p = findProfile(action.id); ui.selectedProfileId = p.id; ui.draft = { ...p.data }; ui.selectedCalculationId = null; result = null; ui.expandedPeriods = []; break;
        }
        case "create-folder": {
          const name = folderName(action.name);
          const existing = data.folders.find(f => f.name.toLocaleLowerCase() === name.toLocaleLowerCase());
          returnedId = existing?.id ?? this.id(); if (!existing) data.folders.push({ id: returnedId, name }); break;
        }
        case "rename-folder": { const f = data.folders.find(f => f.id === action.id) ?? fail("folder_missing"); const name = folderName(action.name);
          if (data.folders.some(other => other.id !== f.id && other.name.toLocaleLowerCase() === name.toLocaleLowerCase())) fail("folder_exists"); f.name = name; break; }
        case "move-profile": { checkFolder(action.folderId); const p = findProfile(action.id); p.data.folderId = action.folderId; p.updatedAt = this.now().toISOString(); if (ui.selectedProfileId === p.id) ui.draft.folderId = action.folderId; break; }
        case "move-profiles": {
          if (!Array.isArray(action.ids) || action.ids.length < 1 || action.ids.length > 20 || new Set(action.ids).size !== action.ids.length) fail("invalid_action");
          checkFolder(action.folderId);
          const profiles = action.ids.map(findProfile);
          for (const p of profiles) { p.data.folderId = action.folderId; p.updatedAt = this.now().toISOString(); if (ui.selectedProfileId === p.id) ui.draft.folderId = action.folderId; }
          break;
        }
        case "search": if (typeof action.text !== "string" || action.text.length > 120) fail("invalid_action"); ui.search = action.text; break;
        case "filter-folder": if (action.id !== "unfiled") checkFolder(action.id); ui.folderFilter = action.id; break;
        case "save-calculation": {
          const candidate = result ?? fail("calculation_missing");
          const existing = data.calculations.find(c => c.profileId === candidate.profileId && c.fingerprint === candidate.fingerprint && !c.imported);
          result = existing ?? candidate;
          if (!data.calculations.some(c => c.id === result!.id)) data.calculations.push(structuredClone(result));
          ui.selectedCalculationId = result.id; ui.workbench.selected[result.kind] = result.id; returnedId = result.id; break;
        }
        case "open-calculation": {
          const c = data.calculations.find(c => c.id === action.id) ?? fail("calculation_missing");
          if (c.profileId !== ui.selectedProfileId) fail("select_profile_first");
          ui.selectedCalculationId = c.id; result = c; ui.workbench.tool = c.kind; ui.workbench.selected[c.kind] = c.id;
          if (c.kind === "astrology" && this.view.results.astrology?.id !== c.id) { ui.expandedPeriods = []; ui.workbench.maha = emptyWorkbench().maha; }
          if (c.kind === "astrology" && !("dashas" in c.result)) ui.dashaSystem = "vimshottari"; break;
        }
        case "select-varga": if (!(VARGAS as readonly string[]).includes(action.varga)) fail("invalid_action"); if (result?.kind !== "astrology" || !result.result.charts[action.varga]) fail("varga_unavailable"); ui.varga = action.varga; if (ui.workbench.panel !== "readings") ui.workbench.panel = "vargas"; break;
        case "select-ashtakavarga": {
          if (!isAvSelection(action.selection)) fail("invalid_action");
          const candidate = this.view.results.astrology;
          const chart = candidate?.kind === "astrology" && candidate.profileId === ui.selectedProfileId ? candidate : fail("calculation_missing");
          if (!chart.result.charts[action.selection.varga]) fail("varga_unavailable");
          ui.ashtakavarga = { ...action.selection }; ui.workbench.panel = "ashtakavarga"; break;
        }
        case "select-aspects": {
          if (!isAspectSelection(action.selection)) fail("invalid_action");
          const candidate = this.view.results.astrology;
          const chart = candidate?.kind === "astrology" && candidate.profileId === ui.selectedProfileId ? candidate : fail("calculation_missing");
          if (!chart.result.charts[action.selection.varga]) fail("varga_unavailable");
          ui.aspects = { ...action.selection }; ui.workbench.panel = "aspects"; break;
        }
        case "select-arudhas": {
          if (!isArudhaSelection(action.selection)) fail("invalid_action");
          const candidate = this.view.results.astrology;
          const chart = candidate?.kind === "astrology" && candidate.profileId === ui.selectedProfileId ? candidate : fail("calculation_missing");
          if (!chart.result.charts[action.selection.varga]) fail("varga_unavailable");
          ui.arudhas = { ...action.selection }; ui.workbench.panel = "arudhas"; break;
        }
        case "select-dasha-system":
          if (!["vimshottari", "yogini"].includes(action.system)) fail("invalid_action");
          if (!result || result.kind !== "astrology") fail("calculation_missing");
          if (result?.kind === "astrology" && !calculationPeriods(result.result, action.system).length) fail("legacy_yogini_unavailable");
          ui.dashaSystem = action.system; ui.workbench.panel = "periods"; break;
        case "select-calendar-date": if (Object.keys(action).length !== 2 || !isCalendarDate(action.date)) fail("invalid_action"); ui.calendarDate = action.date; break;
        case "chart-style": if (typeof action.southern !== "boolean") fail("invalid_action"); ui.southern = action.southern; break;
        case "toggle-period": {
          if (!result || result.kind !== "astrology" || typeof action.key !== "string" || !PERIOD_KEY_PATTERN.test(action.key)) fail("invalid_action");
          const calculation = result?.kind === "astrology" ? result : fail("invalid_action");
          if (!action.key.startsWith(`${ui.dashaSystem}:`)) fail("invalid_action");
          const target = findCalculationPeriod(calculation.result, action.key) ?? fail("invalid_action");
          const maha = calculationPeriods(calculation.result, ui.dashaSystem).find(p => p.start <= target.start && p.end >= target.end);
          if (maha) ui.workbench.maha[ui.dashaSystem] = `${ui.dashaSystem}:0:${maha.lord}:${maha.start}`;
          ui.workbench.panel = "periods";
          ui.expandedPeriods = ui.expandedPeriods.includes(action.key) ? ui.expandedPeriods.filter(k => k !== action.key) : [...ui.expandedPeriods, action.key]; break;
        }
        case "period-mode": if (!["±5", "+10", "-10"].includes(action.mode)) fail("invalid_action"); ui.periodMode = action.mode; break;
        case "month-edit": {
          if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch)) fail("invalid_action");
          const draft = { ...ui.monthPanchanga.draft, ...action.patch };
          if (!isMonthDraft(draft)) fail("invalid_action");
          ui.monthPanchanga = { ...ui.monthPanchanga, draft }; break;
        }
        case "sade-sati-edit": {
          if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch)) fail("invalid_action");
          const draft = { ...ui.sadeSati.draft, ...action.patch };
          if (!isSaturnDraft(draft)) fail("invalid_action");
          ui.sadeSati = { ...ui.sadeSati, draft }; break;
        }
        case "sade-sati-use-chart": {
          const calculation = this.view.results.astrology;
          if (calculation?.kind !== "astrology") return fail("calculation_missing");
          const birth = calculation.result.birth, year = Number(birth.date.slice(0, 4));
          ui.sadeSati = { ...ui.sadeSati, draft: { fromYear: String(year), toYear: String(Math.min(2100, year + 120)), timezone: birth.timezone } }; break;
        }
        case "transit-edit": {
          if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch)) fail("invalid_action");
          const draft = { ...ui.transit.draft, ...action.patch };
          if (!isTransitDraft(draft)) fail("invalid_action");
          // An offset confirmation belongs to one civil date/time/zone only.
          if (["date", "time", "timezone"].some(k => k in action.patch) && !("utcOffsetMinutes" in action.patch)) draft.utcOffsetMinutes = "";
          ui.transit = { ...ui.transit, draft }; break;
        }
        case "year-transits-edit": {
          if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch)) fail("invalid_action");
          const draft = { ...ui.yearTransits.draft, ...action.patch };
          if (!isYearTransitDraft(draft)) fail("invalid_action");
          ui.yearTransits = { ...ui.yearTransits, draft };
          ui.yearTransitMoment = { ...ui.yearTransitMoment, draft: { ...ui.yearTransitMoment.draft, timezone: draft.timezone, nodes: draft.nodes, utcOffsetMinutes: "" } }; break;
        }
        case "year-transits-use-profile": {
          const p = findProfile(ui.selectedProfileId ?? fail("profile_missing")).data;
          const now = DateTime.fromJSDate(this.now(), { zone: p.timezone });
          ui.yearTransits = { ...ui.yearTransits, draft: { year: ui.yearTransits.draft.year || (now.isValid ? String(now.year) : ""), timezone: p.timezone, nodes: p.nodes } };
          ui.yearTransitMoment = { ...ui.yearTransitMoment, draft: { ...ui.yearTransitMoment.draft, timezone: p.timezone, nodes: p.nodes, utcOffsetMinutes: "" } }; break;
        }
        case "year-transits-filter": {
          if (!["all", ...EVENT_PLANETS].includes(action.planet) || !["all", "ingress", "station"].includes(action.kind)) fail("invalid_action");
          ui.yearTransits = { ...ui.yearTransits, planet: action.planet, kind: action.kind }; break;
        }
        case "year-transits-open": {
          const timeline = ui.yearTransits.result ?? fail("calculation_missing");
          const event = timeline.events.find(e => e.ref === action.ref) ?? fail("invalid_action");
          const local = event.at.local ?? fail("event_time_unavailable");
          const date = DateTime.fromISO(local.dateTime, { zone: "UTC" }).plus({ milliseconds: 500 }).startOf("second");
          if (!date.isValid || date.year < 1900 || date.year > 2100) fail("invalid_date");
          ui.transit = { ...ui.transit, draft: { ...ui.transit.draft, date: date.toISODate()!, time: date.toFormat("HH:mm:ss"), timezone: timeline.input.timezone, nodes: timeline.input.nodes, utcOffsetMinutes: String(local.utcOffsetMinutes) } };
          ui.workbench.panel = "transits"; break;
        }
        case "transit-use-profile": {
          const p = findProfile(ui.selectedProfileId ?? fail("profile_missing")).data;
          ui.transit = { ...ui.transit, draft: { ...ui.transit.draft, place: p.place, timezone: p.timezone, latitude: p.latitude, longitude: p.longitude, nodes: p.nodes, utcOffsetMinutes: "" } }; break;
        }
        case "transit-now": {
          if (!ui.transit.draft.timezone) fail("invalid_timezone");
          const date = DateTime.fromJSDate(this.now(), { zone: ui.transit.draft.timezone });
          if (!date.isValid) fail("invalid_timezone");
          ui.transit = { ...ui.transit, draft: { ...ui.transit.draft, date: date.toISODate()!, time: date.toFormat("HH:mm:ss"), utcOffsetMinutes: String(date.offset) } }; break;
        }
        case "transit-step": {
          if (action.days !== -1 && action.days !== 1) fail("invalid_action");
          ui.transit = { ...ui.transit, draft: stepTransitDraft(ui.transit.draft, action.days) }; break;
        }
        case "transit-reference": {
          if (!isTransitReference(action.reference)) fail("invalid_action");
          ui.transit = { ...ui.transit, reference: action.reference }; break;
        }
        case "month-use-profile": {
          const p = findProfile(ui.selectedProfileId ?? fail("profile_missing")).data;
          const date = DateTime.fromJSDate(this.now(), { zone: p.timezone || "UTC" });
          ui.monthPanchanga = { ...ui.monthPanchanga, draft: { month: ui.monthPanchanga.draft.month || (date.isValid ? date.toFormat("yyyy-MM") : ""),
            place: p.place, timezone: p.timezone, latitude: p.latitude, longitude: p.longitude } }; break;
        }
        default: return fail("invalid_action");
      }
      // Bound durable collections and UI values; calculation responses are validated at ingress.
      if (action.type !== "open-profile" && (ui.selectedProfileId !== this.view.data.ui.selectedProfileId || action.type === "new-profile" || action.type === "sample-profile")) ui.workbench = emptyWorkbench();
      if (ui.selectedProfileId !== this.view.data.ui.selectedProfileId) { ui.noteDraft = emptyNoteDraft(); ui.chartOverlay = "none"; }
      if (data.profiles.length > 2000 || data.folders.length > 2000 || data.calculations.length > 2000 || ui.expandedPeriods.length > 1000) fail("workspace_limit");
      if (action.type === "save-note" || action.type === "delete-note" || action.type === "delete-profile" || birthdayAction) {
        await this.commitRecordChange(data, result);
        if (action.type === "delete-profile") { this.pendingDeletion = null; this.update({ deletion: null }); }
        return returnedId;
      }
      this.update({ data, result, error: null }); await this.persist(); return returnedId;
    } catch (e) { this.update({ error: errorCode(e) }); }
  }
  private deletionSignature(profileId: string) {
    return JSON.stringify([this.view.data.profiles.find(p => p.id === profileId), this.view.data.calculations.filter(c => c.profileId === profileId).map(c => c.id).sort()]);
  }
  /** Publish record mutations only after the revision-checked atomic storage write. */
  private async commitRecordChange(data: WorkspaceData, result: LocalCalculation | null) {
    let finish!: () => void;
    this.recordDone = new Promise<void>(resolve => { finish = resolve; });
    this.atomicWrite = true; this.update({ busy: true, error: null });
    try {
      await this.flushing;
      if (this.view.storageError) fail(this.view.storageError);
      this.revision = await this.storage.save(data, this.revision); this.savedData = data;
      this.update({ data, result, error: null });
    } catch (error) {
      // The shared adapter retains a complete pending write. Block accidental
      // replacement until explicit recovery; legacy record actions keep their
      // established direct retry behavior after a transient storage failure.
      if (typeof (this.storage as WorkspaceStorage & Partial<RecoveryStorageMethods>).recover === "function") this.update({storageError:errorCode(error)});
      throw error;
    } finally { this.atomicWrite = false; this.recordDone = null; finish(); this.update({ busy: false }); }
  }
  private async restoreRecoveredCalculation(action: Extract<WorkspaceAction,{type:"restore-recovered-calculation"}>) {
    if (Object.keys(action).length !== 4 || typeof action.recoveryId !== "string" || typeof action.calculationId !== "string" || typeof action.profileId !== "string") fail("invalid_action");
    if (!this.view.loaded || this.view.busy || this.view.saving) fail("operation_busy");
    if (this.view.storageError) fail(this.view.storageError);
    if (hasUnsavedProfile(this.view.data)) fail("save_draft_first");
    if (hasUnsavedNote(this.view.data)) fail("save_note_first");
    if (Object.values(this.view.results).some(item=>item && !this.view.data.calculations.some(saved=>saved.id === item.id))) fail("save_result_first");
    const storage = this.storage as WorkspaceStorage & Partial<RecoveryStorageMethods>;
    const recovery = storage.getRecoveryEntries?.().find(item=>item.id === action.recoveryId) ?? fail("shared_recovery_missing");
    const original = [...recovery.results,...(recovery.pending?.calculations ?? []),...recovery.data.calculations].find(item=>item.id === action.calculationId) ?? fail("calculation_missing");
    const profile = this.view.data.profiles.find(item=>item.id === action.profileId) ?? fail("profile_missing");
    if (original.kind === "astrology") assertAstrologyResult(original.result,profile.data);
    else if (fingerprint(profile.data,"numerology",original.periodMode,original.referenceYear) !== original.fingerprint) fail("calculation_changed");
    const existing = this.view.data.calculations.find(item=>item.id === original.id && item.profileId === profile.id);
    if (existing) {
      if (archiveSignature(existing) !== archiveSignature({...original,profileId:profile.id})) fail("storage_conflict");
      return this.dispatch({type:"open-calculation",id:existing.id});
    }
    if (this.view.data.calculations.length >= 2000) fail("workspace_limit");
    const calculation: LocalCalculation = {...structuredClone(original),profileId:profile.id,id:this.view.data.calculations.some(item=>item.id === original.id) ? this.id() : original.id};
    const data = structuredClone(this.view.data);
    data.calculations.push(calculation);
    data.ui = {...data.ui,selectedProfileId:profile.id,draft:structuredClone(profile.data),selectedCalculationId:calculation.id,noteDraft:emptyNoteDraft(),expandedPeriods:[],
      workbench:{...emptyWorkbench(),tool:calculation.kind,selected:{astrology:null,numerology:null,[calculation.kind]:calculation.id}}};
    await this.commitRecordChange(data,calculation);
    return calculation.id;
  }
  private async calculate(kind: LocalCalculation["kind"]) {
    if (this.view.busy) return fail("operation_busy");
    if (kind !== "astrology") return fail("unsupported_command");
    const data = this.view.data;
    const profile = data.profiles.find(p => p.id === data.ui.selectedProfileId) ?? fail("profile_missing");
    if (hasUnsavedProfile(data)) return fail("save_draft_first");
    const input = structuredClone(profile.data);
    const year = this.now().getUTCFullYear();
    const key = fingerprint(input, kind, data.ui.periodMode, year);
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    try {
      const base = { id: this.id(), profileId: profile.id, input, fingerprint: key, createdAt: this.now().toISOString(), imported: false };
      let result: LocalCalculation;
      {
        const calculation = await this.transport(astrologyInput(input), abort.signal);
        assertAstrologyResult(calculation, input);
        if (calculation.version !== ASTROLOGY_VERSION) fail("invalid_calculation");
        result = { ...base, fingerprint: astrologyFingerprint(calculation.birth, calculation.version), kind, methodVersion: ASTROLOGY_VERSION, result: calculation };
      }
      if (abort.signal.aborted) return fail("calculation_timeout");
      const currentProfile = this.view.data.profiles.find(p => p.id === profile.id);
      if (this.view.data.ui.selectedProfileId !== profile.id || hasUnsavedProfile(this.view.data) || !currentProfile
        || fingerprint(currentProfile.data, kind, this.view.data.ui.periodMode, year) !== key) return fail("calculation_changed");
      const workbench = structuredClone(this.view.data.ui.workbench);
      workbench.tool = kind; workbench.selected[kind] = null;
      if (kind === "astrology") workbench.maha = emptyWorkbench().maha;
      const next = { ...this.view.data, ui: { ...this.view.data.ui, workbench, selectedCalculationId: null, expandedPeriods: kind === "astrology" ? [] : this.view.data.ui.expandedPeriods } };
      this.update({ result, data: next }); await this.persist();
    } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
  }
  private async calculateMonth() {
    if (this.view.busy) return fail("operation_busy");
    const draft = structuredClone(this.view.data.ui.monthPanchanga.draft), input = monthInput(draft);
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    try {
      const result = await this.monthTransport(input, abort.signal);
      if (abort.signal.aborted) return fail("calculation_timeout");
      if (!validMonthPanchanga(result) || JSON.stringify(result.input) !== JSON.stringify(input)) return fail("invalid_month_calendar");
      if (JSON.stringify(this.view.data.ui.monthPanchanga.draft) !== JSON.stringify(draft)) return fail("calculation_changed");
      const data = { ...this.view.data, ui: { ...this.view.data.ui, monthPanchanga: { draft, result } } };
      this.update({ data }); await this.persist();
    } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
  }
  private async setChartOverlay(action: Extract<WorkspaceAction, { type: "set-chart-overlay" | "overlay-transit-at" }>) {
    if (this.view.busy) fail("operation_busy");
    if (action.type === "overlay-transit-at" && typeof action.utc !== "string") fail("invalid_action");
    const mode = action.type === "set-chart-overlay" ? action.mode : "transits";
    if (!isChartOverlayMode(mode)) fail("invalid_action");
    const calculation = this.view.results.astrology;
    if (mode !== "none" && (calculation?.kind !== "astrology" || calculation.profileId !== this.view.data.ui.selectedProfileId)) fail("calculation_missing");
    let transit = this.view.data.ui.transit, calculate = false;
    if (mode === "transits" && calculation?.kind === "astrology") {
      calculate = action.type === "overlay-transit-at" || !overlayTransitReady(calculation.result, transit);
      if (calculate) {
        const utc = action.type === "overlay-transit-at" && action.utc !== "now" ? action.utc : this.now().toISOString();
        try { transit = { ...transit, draft: overlayTransitDraft(calculation.result, utc), reference: "natal-lagna" }; }
        catch { fail("invalid_transit"); }
      }
    }
    const data = { ...this.view.data, ui: { ...this.view.data.ui, chartOverlay: mode, transit } };
    this.update({ data, error: null }); await this.persist();
    if (this.view.storageError) fail(this.view.storageError);
    if (calculate && this.view.data.ui.chartOverlay === "transits" && this.view.data.ui.transit === transit) await this.calculateTransit();
  }
  private async calculateTransit() {
    if (this.view.busy) return fail("operation_busy");
    const draft = structuredClone(this.view.data.ui.transit.draft), input = transitInput(draft);
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    try {
      const result = await this.transitTransport(input, abort.signal);
      if (abort.signal.aborted) return fail("calculation_timeout");
      if (!validTransitResult(result) || JSON.stringify(result.input) !== JSON.stringify(input)) return fail("invalid_transit_result");
      if (JSON.stringify(this.view.data.ui.transit.draft) !== JSON.stringify(draft)) return fail("calculation_changed");
      const data = { ...this.view.data, ui: { ...this.view.data.ui, transit: { ...this.view.data.ui.transit, draft, result } } };
      this.update({ data }); await this.persist();
    } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
  }
  private async calculateYearTransits() {
    if (this.view.busy) return fail("operation_busy");
    const draft = structuredClone(this.view.data.ui.yearTransits.draft), input = yearTransitInput(draft);
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    try {
      const result = await this.yearTransitTransport(input, abort.signal);
      if (abort.signal.aborted) return fail("calculation_timeout");
      if (!validYearTransits(result) || JSON.stringify(result.input) !== JSON.stringify(input)) return fail("invalid_transit_events");
      if (JSON.stringify(this.view.data.ui.yearTransits.draft) !== JSON.stringify(draft)) return fail("calculation_changed");
      const ui = this.view.data.ui;
      const date = initialYearMomentDate(input.year, ui.yearTransitMoment.draft.date || ui.calendarDate, this.now(), input.timezone);
      const yearTransitMoment = { ...ui.yearTransitMoment, draft: { ...ui.yearTransitMoment.draft, date, time: ui.yearTransitMoment.draft.time || "12:00:00", timezone: input.timezone, nodes: input.nodes,
        utcOffsetMinutes: date === ui.yearTransitMoment.draft.date && input.timezone === ui.yearTransitMoment.draft.timezone ? ui.yearTransitMoment.draft.utcOffsetMinutes : "" } };
      const data = { ...this.view.data, ui: { ...ui, calendarDate: date, yearTransitMoment, yearTransits: { ...ui.yearTransits, draft, result } } };
      this.update({ data }); await this.persist();
    } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
  }
  private async yearMomentAction(action: Extract<WorkspaceAction, { type: `year-moment-${string}` }>) {
    const allowed: Record<string, string[]> = {
      "year-moment-edit": ["type", "patch"], "year-moment-select": ["type", "date"], "year-moment-event": ["type", "ref"],
      "year-moment-use-profile": ["type"], "year-moment-now": ["type"], "year-moment-calculate": ["type"]
    };
    const keys = Object.hasOwn(allowed, action.type) ? allowed[action.type] : null;
    if (!keys || Object.keys(action).length !== keys.length || !keys.every(k => Object.hasOwn(action, k))) fail("invalid_action");
    if (action.type === "year-moment-calculate") return this.calculateYearMoment(false);
    const ui = this.view.data.ui, year = ui.yearTransits.result;
    let draft = { ...ui.yearTransitMoment.draft };
    if (action.type === "year-moment-edit") {
      if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch)
        || Object.keys(action.patch).some(k => !["date", "time", "place", "latitude", "longitude", "utcOffsetMinutes"].includes(k))) fail("invalid_action");
      draft = { ...draft, ...action.patch };
      if (!isTransitDraft(draft)) fail("invalid_action");
      if (("date" in action.patch || "time" in action.patch) && !("utcOffsetMinutes" in action.patch)) draft.utcOffsetMinutes = "";
    } else if (action.type === "year-moment-use-profile") {
      const p = this.view.data.profiles.find(p => p.id === ui.selectedProfileId)?.data ?? fail("profile_missing");
      draft = { ...draft, place: p.place, latitude: p.latitude, longitude: p.longitude };
    } else {
      if (!year) fail("calculation_missing");
      if (action.type === "year-moment-select") {
        if (!isCalendarDate(action.date) || Number(action.date.slice(0, 4)) !== year!.input.year) fail("invalid_date");
        draft = { ...draft, date: action.date, utcOffsetMinutes: "" };
      } else {
        const event = action.type === "year-moment-event" ? year!.events.find(e => e.ref === action.ref) ?? fail("invalid_action") : null;
        const utc = event ? new Date(Math.ceil(Date.parse(event.at.utc) / 1000) * 1000) : this.now();
        const local = DateTime.fromJSDate(utc, { zone: year!.input.timezone });
        if (!local.isValid || local.year !== year!.input.year) fail("invalid_date");
        draft = { ...draft, date: local.toISODate()!, time: local.toFormat("HH:mm:ss"), utcOffsetMinutes: String(local.offset) };
      }
    }
    const yearTransitMoment = { ...ui.yearTransitMoment, draft };
    this.update({ data: { ...this.view.data, ui: { ...ui, yearTransitMoment, calendarDate: isCalendarDate(draft.date) ? draft.date : ui.calendarDate } }, error: null });
    await this.persist();
    if (this.view.storageError) fail(this.view.storageError);
    if (["year-moment-select", "year-moment-now", "year-moment-event"].includes(action.type)) await this.calculateYearMoment(true);
  }
  private async calculateYearMoment(automatic: boolean) {
    const request = ++this.yearMomentRequest;
    if (this.yearMomentTask) { this.abort?.abort(); await this.yearMomentTask.catch(() => {}); }
    if (request !== this.yearMomentRequest) return;
    const ui = this.view.data.ui, draft = structuredClone(ui.yearTransitMoment.draft), yearDraft = JSON.stringify(ui.yearTransits.draft);
    let input: TransitInput;
    try { input = yearMomentInput(ui.yearTransits, ui.yearTransitMoment); }
    catch (e) { if (automatic) return; transitInput(draft); if (e instanceof WorkspaceError) throw e; return fail("invalid_transit_year"); }
    if (this.view.busy) { if (automatic) return; return fail("operation_busy"); }
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    const task = (async () => {
      try {
        const result = await this.transitTransport(input, abort.signal);
        if (abort.signal.aborted) fail("calculation_timeout");
        if (!validTransitResult(result) || JSON.stringify(result.input) !== JSON.stringify(input)) fail("invalid_transit_result");
        const current = this.view.data.ui;
        if (JSON.stringify(current.yearTransits.draft) !== yearDraft || JSON.stringify(current.yearTransitMoment.draft) !== JSON.stringify(draft)) fail("calculation_changed");
        const data = { ...this.view.data, ui: { ...current, yearTransitMoment: { ...current.yearTransitMoment, draft, result } } };
        this.update({ data }); await this.persist();
      } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
    })();
    this.yearMomentTask = task;
    try { await task; } catch (e) { if (request === this.yearMomentRequest) throw e; }
    finally { if (this.yearMomentTask === task) this.yearMomentTask = null; }
  }
  private async dayAction(action: Extract<WorkspaceAction, { type: `day-${string}` }>) {
    const allowed: Record<string, string[]> = { "day-edit": ["type", "patch"], "day-date": ["type", "date"], "day-instant": ["type", "utc"], "day-use-profile": ["type"], "day-use-month": ["type"], "day-now": ["type"], "day-calculate": ["type"] };
    const keys = Object.hasOwn(allowed, action.type) ? allowed[action.type] : null;
    if (!keys || Object.keys(action).length !== keys.length || !keys.every(k => Object.hasOwn(action, k))) fail("invalid_action");
    const ui = this.view.data.ui; let draft = { ...ui.dayPanchanga.draft, date: ui.calendarDate || ui.dayPanchanga.draft.date || this.now().toISOString().slice(0, 10) };
    if (action.type === "day-edit") {
      if (!action.patch || typeof action.patch !== "object" || Array.isArray(action.patch) || Object.keys(action.patch).some(k => !Object.hasOwn(draft, k))) fail("invalid_action");
      draft = { ...draft, ...action.patch }; if (!isTransitDraft(draft)) fail("invalid_action");
      if (["date", "time", "timezone"].some(k => Object.hasOwn(action.patch, k)) && !Object.hasOwn(action.patch, "utcOffsetMinutes")) draft.utcOffsetMinutes = "";
    } else if (action.type === "day-date") {
      if (!isCalendarDate(action.date)) fail("invalid_date");
      draft = { ...draft, date: action.date, utcOffsetMinutes: "" };
    } else if (action.type === "day-use-profile") {
      const p = this.view.data.profiles.find(p => p.id === ui.selectedProfileId)?.data ?? fail("profile_missing");
      draft = { ...draft, place: p.place, latitude: p.latitude, longitude: p.longitude, timezone: p.timezone, nodes: p.nodes, utcOffsetMinutes: "" };
    } else if (action.type === "day-use-month") {
      const p = monthInput(ui.monthPanchanga.draft);
      draft = { ...draft, place: p.place, latitude: String(p.latitude), longitude: String(p.longitude), timezone: p.timezone, utcOffsetMinutes: "" };
    } else if (action.type === "day-now" || action.type === "day-instant") {
      const instant = action.type === "day-now" ? this.now() : new Date(action.utc);
      if (!Number.isFinite(instant.getTime()) || (action.type === "day-instant" && instant.toISOString() !== action.utc)) fail("invalid_date");
      const local = DateTime.fromJSDate(instant, { zone: draft.timezone });
      if (!local.isValid || !isCalendarDate(local.toISODate())) fail("invalid_date");
      if (action.type === "day-instant") {
        const r = ui.dayPanchanga.result;
        if (!r || instant.getTime() < Date.parse(r.start.utc) || instant.getTime() >= Date.parse(r.end.utc)) fail("invalid_action");
      }
      draft = { ...draft, date: local.toISODate()!, time: local.toFormat("HH:mm:ss"), utcOffsetMinutes: String(local.offset) };
    }
    if (!draft.date || action.type === "day-calculate") draft.date = ui.calendarDate || draft.date || this.now().toISOString().slice(0, 10);
    this.update({ data: { ...this.view.data, ui: { ...ui, dayPanchanga: { ...ui.dayPanchanga, draft }, calendarDate: isCalendarDate(draft.date) ? draft.date : ui.calendarDate } }, error: null });
    await this.persist(); if (this.view.storageError) fail(this.view.storageError);
    if (["day-calculate", "day-date", "day-now", "day-instant"].includes(action.type)) await this.calculateDay(action.type !== "day-calculate");
  }
  private async calculateDay(automatic: boolean) {
    const request = ++this.dayRequest;
    if (this.dayTask) { this.abort?.abort(); await this.dayTask.catch(() => {}); }
    if (request !== this.dayRequest) return;
    const draft = structuredClone(this.view.data.ui.dayPanchanga.draft);
    if (automatic && (!draft.place.trim() || !draft.latitude.trim() || !draft.longitude.trim() || !draft.timezone.trim())) return;
    const input = transitInput(draft);
    if (this.view.busy) { if (automatic) return; return fail("operation_busy"); }
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000); this.update({ busy: true, error: null });
    const task = (async () => {
      try {
        const result = await this.dayTransport(input, abort.signal);
        if (abort.signal.aborted) fail("calculation_timeout");
        if (!validDayPanchanga(result) || JSON.stringify(result.input) !== JSON.stringify(input)) fail("invalid_day_panchanga");
        const current = this.view.data.ui;
        if (JSON.stringify(current.dayPanchanga.draft) !== JSON.stringify(draft) || current.calendarDate !== draft.date) fail("calculation_changed");
        this.update({ data: { ...this.view.data, ui: { ...current, dayPanchanga: { draft, result } } } }); await this.persist();
      } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
    })();
    this.dayTask = task;
    try { await task; } catch (e) { if (request === this.dayRequest) throw e; }
    finally { if (this.dayTask === task) this.dayTask = null; }
  }
  private async calculateSaturnTransits() {
    if (this.view.busy) return fail("operation_busy");
    const draft = structuredClone(this.view.data.ui.sadeSati.draft), input = saturnInput(draft);
    const abort = new AbortController(); this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    this.update({ busy: true, error: null });
    try {
      const result = await this.saturnTransitTransport(input, abort.signal);
      if (abort.signal.aborted) return fail("calculation_timeout");
      if (!validSaturnTransits(result) || JSON.stringify(result.input) !== JSON.stringify(input)) return fail("invalid_saturn_timeline");
      if (JSON.stringify(this.view.data.ui.sadeSati.draft) !== JSON.stringify(draft)) return fail("calculation_changed");
      const data = { ...this.view.data, ui: { ...this.view.data.ui, sadeSati: { draft, result } } };
      this.update({ data }); await this.persist();
    } finally { clearTimeout(timeout); this.abort = null; this.update({ busy: false }); }
  }
  async settle() { await Promise.all([this.flushing, this.recordDone]); }
  dispose() { this.abort?.abort(); this.storage.close(); this.listeners.clear(); }
}
