import type { SiteLocale } from "../site-locale";
import { calculationPeriods, dashaChildren } from "../astrology/dasha";
import { WorkspaceController, type WorkspaceAction, type WorkspaceView } from "./controller";
import { emptyDraft, fail, periodKey, validateProfile, WorkspaceError, type BirthDraft } from "./model";
import { buildWorkspaceAssistantContext } from "./assistant-context";
import { ScriptedWorkspaceAdapter, validateAssistantIntent, type AssistantIntent, type WorkspaceAssistantAdapter } from "./assistant-contract";

export type AssistantReply = { code: string; detail?: string; screen?: "chart" | "new"; focus?: "rashi" | "varga" | "periods"; choices?: { id: string; label: string }[]; confirmation?: { id: string; folder: string; people: string[] } };
type Stamp = Pick<WorkspaceView, "data" | "result">;
type ChoiceField = "profile" | "folder";
type Pending = { stamp: Stamp; locale: SiteLocale } & (
  { kind: "choice"; intent: AssistantIntent; field: ChoiceField; choices: { id: string; label: string }[] }
  | { kind: "bulk"; token: string; ids: string[]; folderId: string }
);
class AmbiguousTarget extends Error {
  constructor(readonly field: ChoiceField, readonly choices: { id: string; label: string }[]) { super("ambiguous_target"); }
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new WorkspaceError("assistant_cancelled"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
const normalizedName = (name: string) => name.trim().toLocaleLowerCase();
const samePerson = (a: BirthDraft, b: BirthDraft) => Object.keys(a).filter(k => k !== "folderId").every(k => k === "name" ? normalizedName(a.name) === normalizedName(b.name) : a[k as keyof BirthDraft] === b[k as keyof BirthDraft]);

/** Owns proposal validation and human-only confirmation. It grants no general tools. */
export class WorkspaceAssistant {
  private active: AbortController | null = null;
  private pending: Pending | null = null;
  private locale: SiteLocale = "ru";
  private receipts = new Map<string, { text: string; locale: SiteLocale; reply: AssistantReply }>();
  constructor(readonly controller: WorkspaceController, private adapter: WorkspaceAssistantAdapter = new ScriptedWorkspaceAdapter()) {}
  setLocale(locale: SiteLocale) {
    if (this.locale !== locale) { this.cancel(); this.pending = null; this.locale = locale; }
  }
  cancel() { this.active?.abort(); }
  context(locale: SiteLocale) { return buildWorkspaceAssistantContext(this.controller.getSnapshot(), locale); }
  private current(stamp: Stamp) { const view = this.controller.getSnapshot(); return stamp.data === view.data && stamp.result === view.result; }
  private async action(action: WorkspaceAction) {
    if (this.active?.signal.aborted) return fail("assistant_cancelled");
    if (this.controller.getSnapshot().storageError) return fail("storage_unavailable");
    const result = await this.controller.dispatch(action);
    const view = this.controller.getSnapshot();
    if (view.storageError) return fail(view.storageError);
    if (view.error) return fail(view.error);
    return result;
  }
  private resolve(value: string, field: ChoiceField) {
    const data = this.controller.getSnapshot().data;
    const rows = field === "profile" ? data.profiles.map(p => ({ id: p.id, name: p.data.name, label: `${p.data.name} · ${p.data.date}${p.data.time ? ` ${p.data.time}` : ""} · ${p.id.slice(0, 8)}` })) : data.folders.map(f => ({ ...f, label: f.name }));
    const byId = rows.find(row => row.id === value);
    const exact = rows.filter(row => normalizedName(row.name) === normalizedName(value));
    const found = byId ? [byId] : exact.length ? exact : field === "profile" ? rows.filter(row => normalizedName(row.name).includes(normalizedName(value))) : [];
    if (!found.length) return fail(field === "profile" ? "profile_missing" : "folder_missing");
    if (found.length > 20) return fail("too_many_matches");
    if (found.length > 1) throw new AmbiguousTarget(field, found.map(({ id, label }) => ({ id, label })));
    return found[0].id;
  }
  private async chart() {
    const view = this.controller.getSnapshot();
    if (view.result?.kind === "astrology" && view.result.profileId === view.data.ui.selectedProfileId) return view.result;
    const saved = view.data.calculations.filter(c => c.kind === "astrology" && c.profileId === view.data.ui.selectedProfileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!saved || saved.kind !== "astrology") return fail("chart_required");
    await this.action({ type: "open-calculation", id: saved.id }); return saved;
  }
  private async execute(intent: AssistantIntent, locale: SiteLocale): Promise<AssistantReply> {
    const view = this.controller.getSnapshot(); const data = view.data;
    switch (intent.type) {
      case "new-chart": await this.action({ type: "new-profile" }); return { code: "birth_form_opened", screen: "new" };
      case "show-rashi": await this.chart(); return { code: "rashi_opened", screen: "chart", focus: "rashi" };
      case "show-transits": {
        await this.chart();
        await this.action({ type: "set-chart-overlay", mode: intent.enabled ? "transits" : "none" });
        return { code: intent.enabled ? "transits_shown" : "transits_hidden", detail: intent.enabled ? this.controller.getSnapshot().data.ui.transit.result?.instant.utc : undefined, screen: "chart", focus: "rashi" };
      }
      case "help": return { code: "command_help" };
      case "show-context": return { code: "context_ready" };
      case "fill-draft": await this.action({ type: "edit-draft", patch: intent.fields }); return { code: "draft_filled" };
      case "create-profile": {
        if (!intent.fields.name?.trim()) return { code: "name_required" };
        if (!intent.fields.date) return { code: "date_required" };
        const draft = validateProfile({ ...emptyDraft(), ...intent.fields });
        const existing = data.profiles.filter(p => samePerson(p.data, draft));
        if (existing.length > 1) throw new AmbiguousTarget("profile", existing.map(p => ({ id: p.id, label: `${p.data.name} · ${p.data.date} · ${p.id.slice(0, 8)}` })));
        if (existing.length) { await this.action({ type: "select-profile", id: existing[0].id }); return { code: "existing_profile" }; }
        await this.action({ type: "create-profile", draft }); return { code: "profile_created" };
      }
      case "select-profile": await this.action({ type: "open-profile", id: this.resolve(intent.profile, "profile") }); return { code: "profile_selected", screen: "chart", focus: "rashi" };
      case "create-folder": await this.action({ type: "create-folder", name: intent.name }); return { code: "folder_ready" };
      case "rename-folder": await this.action({ type: "rename-folder", id: this.resolve(intent.folder, "folder"), name: intent.name }); return { code: "folder_renamed" };
      case "move-profile": {
        const id = data.ui.selectedProfileId ?? fail("profile_missing");
        await this.action({ type: "move-profile", id, folderId: this.resolve(intent.folder, "folder") }); return { code: "profile_moved" };
      }
      case "move-all": {
        const folderId = this.resolve(intent.folder, "folder");
        const people = data.profiles.filter(p => p.data.folderId !== folderId);
        if (people.length > 20) return { code: "bulk_limit" };
        if (!people.length) return { code: "nothing_to_move" };
        const token = crypto.randomUUID();
        this.pending = { kind: "bulk", stamp: view, locale, token, folderId, ids: people.map(p => p.id) };
        return { code: "confirm_moves", confirmation: { id: token, folder: data.folders.find(f => f.id === folderId)!.name, people: people.map(p => `${p.data.name} · ${p.data.date}`) } };
      }
      case "save-profile": await this.action({ type: "save-profile" }); return { code: "profile_saved" };
      case "calculate": await this.action({ type: "calculate", kind: intent.kind }); return { code: "calculated" };
      case "save-calculation": await this.action({ type: "save-calculation" }); return { code: "calculation_saved" };
      case "open-calculation": {
        const id = intent.id === "latest" ? data.calculations.filter(c => c.profileId === data.ui.selectedProfileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id : intent.id;
        if (!id) return fail("calculation_missing"); await this.action({ type: "open-calculation", id }); return { code: "calculation_opened" };
      }
      case "select-varga": {
        const chart = await this.chart();
        if (!chart.result.charts[intent.varga]) return { code: "snapshot_tool_missing", screen: "chart", focus: "rashi" };
        await this.action({ type: "select-panel", panel: "vargas" }); await this.action(intent);
        return { code: "varga_opened", detail: intent.varga, screen: "chart", focus: "varga" };
      }
      case "select-dasha-system": {
        const chart = await this.chart();
        if (!calculationPeriods(chart.result, intent.system).length) return { code: "snapshot_tool_missing", screen: "chart", focus: "rashi" };
        await this.action(intent); return { code: "dasha_selected", detail: intent.system, screen: "chart", focus: "periods" };
      }
      case "open-period": {
        const chart = await this.chart(); const system = this.controller.getSnapshot().data.ui.dashaSystem;
        let periods = [...calculationPeriods(chart.result, system)]; const keys: string[] = [];
        if (intent.start) periods = periods.filter(p => p.start.slice(0, 10) === intent.start);
        for (const lord of intent.lords) {
          const matches = periods.filter(p => p.lord === lord);
          if (matches.length > 1) fail("ambiguous_period");
          const period = matches[0] ?? fail("invalid_action");
          keys.push(periodKey(period)); periods = dashaChildren(period);
        }
        for (const key of keys) if (!this.controller.getSnapshot().data.ui.expandedPeriods.includes(key)) await this.action({ type: "toggle-period", key });
        return { code: "period_opened", detail: intent.lords.join(" / ") };
      }

    }
  }
  private failure(error: unknown): AssistantReply {
    return { code: error instanceof WorkspaceError ? error.code : "assistant_failed" };
  }
  private async executeOrClarify(intent: AssistantIntent, locale: SiteLocale) {
    try { return await this.execute(intent, locale); }
    catch (error) {
      if (error instanceof AmbiguousTarget) {
        // A repeated create with multiple identical people becomes an explicit selection.
        const next = intent.type === "create-profile" ? { type: "select-profile" as const, profile: intent.fields.name! } : intent;
        this.pending = { kind: "choice", intent: next, field: error.field, choices: error.choices, stamp: this.controller.getSnapshot(), locale };
        return { code: "choose_target", choices: error.choices };
      }
      return this.failure(error);
    }
  }
  async run(text: string, locale: SiteLocale, requestId = crypto.randomUUID()): Promise<AssistantReply> {
    if (typeof text !== "string" || !text.trim() || text.length > 1600 || typeof requestId !== "string" || requestId.length > 120
      || (locale !== "ru" && locale !== "en") || this.adapter.mode !== "scripted") return { code: "invalid_action" };
    if (this.active) return { code: "operation_busy" };
    this.setLocale(locale);
    const receipt = this.receipts.get(requestId);
    if (receipt) return receipt.text === text && receipt.locale === locale ? structuredClone(receipt.reply) : { code: "invalid_request_id" };
    const stamp = this.controller.getSnapshot();
    if (!stamp.loaded || stamp.busy || stamp.storageError) return { code: stamp.storageError ?? "storage_unavailable" };
    this.pending = null;
    const abort = new AbortController(); this.active = abort;
    const timer = setTimeout(() => abort.abort(), 35_000);
    let reply: AssistantReply;
    try {
      const context = this.context(locale);
      if (JSON.stringify(context).length > 16_000) return fail("context_limit");
      const proposal = await abortable(this.adapter.propose({ text, locale, context: structuredClone(context) }, abort.signal), abort.signal);
      if (!this.current(stamp)) return fail("state_changed");
      reply = await this.executeOrClarify(validateAssistantIntent(proposal), locale);
    } catch (error) { reply = this.failure(error); }
    finally { clearTimeout(timer); this.active = null; }
    this.receipts.set(requestId, { text, locale, reply: structuredClone(reply) });
    if (this.receipts.size > 100) this.receipts.delete(this.receipts.keys().next().value!);
    return reply;
  }
  async choose(id: string, locale: SiteLocale): Promise<AssistantReply> {
    const pending = this.pending;
    if (this.active) return { code: "operation_busy" };
    if (!pending || pending.kind !== "choice" || pending.locale !== locale || !this.current(pending.stamp) || !pending.choices.some(c => c.id === id)) return { code: "state_changed" };
    this.pending = null;
    const abort = new AbortController(); this.active = abort;
    try { return await this.executeOrClarify(validateAssistantIntent({ ...pending.intent, [pending.field]: id }), locale); }
    finally { this.active = null; }
  }
  async confirm(token: string, locale: SiteLocale): Promise<AssistantReply> {
    const pending = this.pending;
    if (this.active) return { code: "operation_busy" };
    if (!pending || pending.kind !== "bulk" || pending.token !== token || pending.locale !== locale || !this.current(pending.stamp)) return { code: "state_changed" };
    this.pending = null;
    const abort = new AbortController(); this.active = abort;
    try { await this.action({ type: "move-profiles", ids: pending.ids, folderId: pending.folderId }); return { code: "profiles_moved" }; }
    catch (error) { return this.failure(error); }
    finally { this.active = null; }
  }
  dismiss() { this.pending = null; }
}
