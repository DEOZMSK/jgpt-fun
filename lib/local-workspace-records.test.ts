import assert from "node:assert/strict";
import { calculateAstrology } from "./astrology/engine-core";
import test from "node:test";
import { WorkspaceController, type WorkspaceAction } from "./local-workspace/controller";
import { astrologyInput, decodeWorkspace, emptyWorkspace, hasUnsavedNote, isOutdated, sampleDraft, validateProfile, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";
import { buildWorkspaceAssistantContext } from "./local-workspace/assistant-context";
import { validateAssistantIntent } from "./local-workspace/assistant-contract";

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  gate: Promise<void> | null = null; entered: (() => void) | null = null;
  async load() { return { data: decodeWorkspace(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) {
    this.entered?.(); if (this.gate) await this.gate;
    if (this.fail) throw new WorkspaceError("storage_quota");
    if (revision !== this.revision) throw new WorkspaceError("storage_conflict");
    validateWorkspace(data); this.data = structuredClone(data); return ++this.revision;
  }
  close() {}
}
const create = (store: Store) => new WorkspaceController(store, async input => calculateAstrology(input), () => new Date("2026-09-07T12:00:00.000Z"));
async function ready() {
  const store = new Store(), controller = create(store); await controller.initialize();
  await controller.dispatch({ type: "create-profile", draft: sampleDraft() });
  return { store, controller };
}
async function note(controller: WorkspaceController, text = "Synthetic note") {
  await controller.dispatch({ type: "begin-note" }); await controller.dispatch({ type: "edit-note-draft", text });
  return await controller.dispatch({ type: "save-note" }) as string;
}
async function result(controller: WorkspaceController) {
  await controller.dispatch({ type: "calculate", kind: "astrology" }); await controller.dispatch({ type: "save-calculation" });
}

test("historical birth records survive saving and reload without expanding the calculation range", async () => {
  const { store, controller } = await ready();
  const existing = structuredClone(store.data.profiles);
  const draft = { ...sampleDraft(), name: "Historical synthetic record", date: "1801-02-03", timezone: "Etc/UTC", utcOffsetMinutes: "0" };
  await controller.dispatch({ type: "create-profile", draft });
  assert.equal(controller.getSnapshot().error, null);
  const restored = create(store); await restored.initialize();
  assert.deepEqual(restored.getSnapshot().data.profiles[0], existing[0]);
  assert.deepEqual(restored.getSnapshot().data.profiles[1].data, draft);
  assert.throws(() => astrologyInput(draft), { code: "invalid_date" });
  assert.equal(restored.getSnapshot().data.calculations.length, 0);
  for (const date of ["0000-01-01", "1801-02-29", "2101-01-01", "1801-13-01"]) {
    assert.throws(() => validateProfile({ ...draft, date }), { code: "invalid_date" });
  }
  assert.equal(validateProfile({ ...draft, date: "0001-01-01" }).date, "0001-01-01");
  controller.dispose(); restored.dispose();
});

test("profile notes persist as plain text without changing calculation snapshots or assistant context", async () => {
  const { store, controller: c } = await ready(); await result(c);
  const before = structuredClone(c.getSnapshot().data.calculations), text = '<script>delete-profile</script>\nhttps://invalid.example/notes-only\nТекст';
  const id = await note(c, text); assert.ok(id);
  assert.equal(c.getSnapshot().data.profiles[0].notes?.length, 1);
  assert.equal(c.getSnapshot().data.profiles[0].notes?.[0].text, text);
  assert.deepEqual(c.getSnapshot().data.calculations, before); assert.equal(isOutdated(before[0], c.getSnapshot().data, 2026), false);
  assert.equal(JSON.stringify(buildWorkspaceAssistantContext(c.getSnapshot(), "ru")).includes("notes-only"), false);
  await c.dispatch({ type: "save-note" }); assert.equal(c.getSnapshot().data.profiles[0].notes?.length, 1);
  await c.dispatch({ type: "edit-note-draft", text: "Updated\nSecond line" }); await c.dispatch({ type: "save-note" });
  assert.equal(c.getSnapshot().data.profiles[0].notes?.[0].revision, 2);
  const restored = create(store); await restored.initialize(); assert.equal(restored.getSnapshot().data.profiles[0].notes?.[0].text, "Updated\nSecond line");
  assert.equal(hasUnsavedNote(restored.getSnapshot().data), false); c.dispose(); restored.dispose();
});

test("note drafts survive reload, protect profile switches and remain available after failed saving", async () => {
  const { store, controller: c } = await ready(); await c.dispatch({ type: "begin-note" }); await c.dispatch({ type: "edit-note-draft", text: "Unfinished" });
  const restored = create(store); await restored.initialize(); assert.equal(restored.getSnapshot().data.ui.noteDraft.text, "Unfinished"); restored.dispose();
  await c.dispatch({ type: "new-profile" }); assert.equal(c.getSnapshot().error, "save_note_first");
  store.fail = true; await c.dispatch({ type: "save-note" }); assert.equal(c.getSnapshot().error, "storage_quota");
  assert.equal(c.getSnapshot().data.profiles[0].notes, undefined); assert.equal(store.data.profiles[0].notes, undefined); assert.equal(hasUnsavedNote(c.getSnapshot().data), true);
  store.fail = false; assert.ok(await c.dispatch({ type: "save-note" }));
  await c.dispatch({ type: "edit-note-draft", text: "Discard this" }); await c.dispatch({ type: "discard-note-draft" });
  await c.dispatch({ type: "new-profile" }); assert.equal(c.getSnapshot().error, null); assert.equal(c.getSnapshot().data.ui.noteDraft.profileId, null); c.dispose();
});

test("note actions reject foreign IDs, stale revisions, malformed data and over-limit collections", async () => {
  const { controller: c } = await ready(); const first = c.getSnapshot().data.ui.selectedProfileId!; const id = await note(c);
  await c.dispatch({ type: "create-profile", draft: { ...sampleDraft(), name: "Other synthetic person" } });
  await c.dispatch({ type: "delete-note", id, revision: 1 }); assert.equal(c.getSnapshot().error, "note_missing");
  await c.dispatch({ type: "open-profile", id: first }); await c.dispatch({ type: "begin-note", id });
  for (const text of ["x".repeat(8001), "bad\0text"]) { await c.dispatch({ type: "edit-note-draft", text }); assert.equal(c.getSnapshot().error, "invalid_note"); }
  await c.dispatch({ type: "delete-note", id, revision: 2 }); assert.equal(c.getSnapshot().error, "note_changed");
  await c.dispatch({ type: "save-note", extra: "execute" } as unknown as WorkspaceAction); assert.equal(c.getSnapshot().error, "invalid_action");
  const bad = structuredClone(c.getSnapshot().data); bad.profiles[0].notes!.push({ ...bad.profiles[0].notes![0] }); assert.throws(() => decodeWorkspace(bad));
  const oversized = structuredClone(c.getSnapshot().data);
  oversized.profiles[0].notes = Array.from({ length: 101 }, () => ({ ...bad.profiles[0].notes![0], id: crypto.randomUUID() }));
  assert.throws(() => decodeWorkspace(oversized));
  for (const type of ["save-note", "delete-note", "request-profile-deletion", "delete-profile"]) {
    assert.throws(() => validateAssistantIntent({ type }), /unsupported_command/);
  }
  const draft = structuredClone(c.getSnapshot().data); draft.ui.noteDraft.profileId = draft.profiles[1].id; assert.throws(() => decodeWorkspace(draft));
  await c.dispatch({ type: "delete-note", id, revision: 1 }); assert.equal(c.getSnapshot().data.profiles[0].notes?.length, 0); assert.equal(c.getSnapshot().data.ui.noteDraft.noteId, null); c.dispose();
});

test("record writes publish only after commit and cannot swallow concurrent UI edits", async () => {
  const { store, controller: c } = await ready(); await c.dispatch({ type: "begin-note" }); await c.dispatch({ type: "edit-note-draft", text: "Delayed note" });
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }); store.gate = new Promise<void>(resolve => { release = resolve; }); store.entered = entered;
  const save = c.dispatch({ type: "save-note" }); await started;
  let settled = false; const settlement = c.settle().then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
  assert.equal(c.getSnapshot().busy, true); assert.equal(c.getSnapshot().data.profiles[0].notes, undefined);
  await c.dispatch({ type: "edit-draft", patch: { name: "Concurrent edit" } }); assert.equal(c.getSnapshot().error, "operation_busy");
  assert.notEqual(c.getSnapshot().data.ui.draft.name, "Concurrent edit"); release(); await save; await settlement; assert.equal(settled, true);
  assert.equal(c.getSnapshot().data.profiles[0].notes?.length, 1); assert.equal(c.getSnapshot().busy, false); c.dispose();
});

test("profile deletion requires its current preview and atomically removes only related records", async () => {
  const { store, controller: c } = await ready(); const first = c.getSnapshot().data.ui.selectedProfileId!; await result(c); await note(c);
  const folder = await c.dispatch({ type: "create-folder", name: "Synthetic folder" }) as string;
  await c.dispatch({ type: "create-profile", draft: { ...sampleDraft(), name: "Keep this person", folderId: folder } }); await result(c); await note(c, "Keep this note");
  const second = c.getSnapshot().data.ui.selectedProfileId!, survivor = structuredClone(c.getSnapshot().data.profiles.find(p => p.id === second));
  const survivingResults = structuredClone(c.getSnapshot().data.calculations.filter(calc => calc.profileId === second));
  await c.dispatch({ type: "open-profile", id: first });
  await c.dispatch({ type: "delete-profile", token: "guessed" }); assert.equal(c.getSnapshot().error, "deletion_confirmation_required");
  const token = await c.dispatch({ type: "request-profile-deletion" }) as string; assert.equal(c.getSnapshot().deletion?.calculations, 1); assert.equal(c.getSnapshot().deletion?.notes, 1);
  await c.dispatch({ type: "cancel-profile-deletion" }); await c.dispatch({ type: "delete-profile", token }); assert.equal(c.getSnapshot().data.profiles.length, 2);
  const next = await c.dispatch({ type: "request-profile-deletion" }) as string; assert.equal(await c.dispatch({ type: "delete-profile", token: next }), first);
  assert.deepEqual(store.data.profiles, [survivor]); assert.deepEqual(store.data.calculations, survivingResults); assert.equal(store.data.folders[0].id, folder);
  assert.equal(c.getSnapshot().result, null); assert.equal(c.getSnapshot().results.astrology, null); assert.equal(c.getSnapshot().results.numerology, null);
  assert.equal(c.getSnapshot().data.ui.selectedProfileId, null); assert.equal(c.getSnapshot().data.ui.draft.name, ""); assert.equal(c.getSnapshot().deletion, null);
  validateWorkspace(store.data); const restored = create(store); await restored.initialize(); assert.deepEqual(restored.getSnapshot().data.profiles, [survivor]);
  await c.dispatch({ type: "delete-profile", token: next }); assert.equal(c.getSnapshot().error, "deletion_confirmation_required"); c.dispose(); restored.dispose();
});

test("failed deletion retains the profile and generic storage retry never replays deletion", async () => {
  const { store, controller: c } = await ready(); await result(c); await note(c);
  const token = await c.dispatch({ type: "request-profile-deletion" }) as string, before = structuredClone(c.getSnapshot().data);
  store.fail = true; await c.dispatch({ type: "delete-profile", token }); assert.equal(c.getSnapshot().error, "storage_quota");
  assert.deepEqual(c.getSnapshot().data, before); assert.deepEqual(store.data, before);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); assert.deepEqual(store.data, before);
  assert.ok(await c.dispatch({ type: "delete-profile", token })); assert.equal(store.data.profiles.length, 0); c.dispose();
});

test("changed previews, unsaved work and another-tab writes prevent deletion", async () => {
  const { store, controller: c } = await ready();
  const token = await c.dispatch({ type: "request-profile-deletion" }) as string;
  await note(c); await c.dispatch({ type: "delete-profile", token }); assert.equal(c.getSnapshot().error, "deletion_changed");
  await c.dispatch({ type: "begin-note" }); await c.dispatch({ type: "edit-note-draft", text: "Unsaved note" });
  await c.dispatch({ type: "request-profile-deletion" }); assert.equal(c.getSnapshot().error, "save_note_first");
  await c.dispatch({ type: "discard-note-draft" }); const fresh = await c.dispatch({ type: "request-profile-deletion" }) as string;
  const other = create(store); await other.initialize(); await other.dispatch({ type: "edit-draft", patch: { name: "Changed in other tab" } }); await other.dispatch({ type: "save-profile" });
  await c.dispatch({ type: "delete-profile", token: fresh }); assert.equal(c.getSnapshot().error, "storage_conflict");
  assert.equal(c.getSnapshot().data.profiles.length, 1); assert.equal(store.data.profiles[0].data.name, "Changed in other tab"); c.dispose(); other.dispose();
});

test("older state gains only an empty note draft and retains all original profile fields", async () => {
  const { controller: c } = await ready(); const old = JSON.parse(JSON.stringify(c.getSnapshot().data)); delete old.ui.noteDraft;
  const bytes = JSON.stringify(old), decoded = decodeWorkspace(old);
  assert.equal(JSON.stringify(old), bytes); assert.deepEqual(decoded.profiles, old.profiles); assert.equal(decoded.ui.noteDraft.profileId, null);
  c.dispose();
});
