import test from "node:test";
import assert from "node:assert/strict";
import { calculateAstrology } from "./astrology/engine-core";
import { VARGAS } from "./astrology/contracts";
import { birthCalculationIssue, discardBirthDraft, saveBirthChart } from "./local-workspace/birth-flow";
import { WorkspaceController } from "./local-workspace/controller";
import { decodeWorkspace, emptyDraft, emptyWorkspace, hasUnsavedProfile, sampleDraft, WorkspaceError, type WorkspaceData } from "./local-workspace/model";

class Storage {
  data = emptyWorkspace();
  revision = 0;
  async load() { return { revision: this.revision, data: decodeWorkspace(structuredClone(this.data)) }; }
  async save(data: WorkspaceData, expected: number) {
    assert.equal(expected, this.revision);
    this.data = decodeWorkspace(structuredClone(data));
    return ++this.revision;
  }
  close() {}
}

test("new chart preflight rejects unknown or approximate accuracy before saving any profile", async () => {
  for (const accuracy of [emptyDraft().accuracy, "approximate"] as const) {
    const storage = new Storage(); let calls = 0;
    const controller = new WorkspaceController(storage, async input => { calls++; return calculateAstrology(input); });
    await controller.initialize();
    await controller.dispatch({ type: "edit-draft", patch: { ...sampleDraft(), accuracy } });
    const before = structuredClone(storage.data), revision = storage.revision;
    assert.deepEqual(birthCalculationIssue(controller.getSnapshot().data.ui.draft), { field: "accuracy", code: "uncertain_time" });
    assert.equal(await saveBirthChart(controller, true), false);
    assert.equal(calls, 0);
    assert.equal(controller.getSnapshot().data.profiles.length, 0);
    assert.equal(controller.getSnapshot().data.calculations.length, 0);
    assert.deepEqual(storage.data, before);
    assert.equal(storage.revision, revision);
    controller.dispose();
  }
});

test("primary new-chart save calculates all 20 vargas and restores the same saved result after reload", async () => {
  const storage = new Storage(); let calls = 0;
  const controller = new WorkspaceController(storage, async input => { calls++; return calculateAstrology(input); });
  await controller.initialize();
  const draft = { ...sampleDraft(), time: "12:00:37" };
  await controller.dispatch({ type: "edit-draft", patch: draft });
  assert.equal(birthCalculationIssue(draft), null);
  assert.equal(await saveBirthChart(controller, true), true);
  assert.equal(calls, 1);
  const view = controller.getSnapshot(), saved = view.results.astrology;
  assert.equal(view.error, null); assert.equal(view.storageError, null);
  assert.equal(view.data.profiles.length, 1); assert.equal(view.data.calculations.length, 1);
  assert.deepEqual(view.data.profiles[0].data, draft);
  assert.ok(saved?.kind === "astrology");
  assert.deepEqual(Object.keys(saved.result.charts).sort(), [...VARGAS].sort());
  assert.equal(saved.result.planets.length, 9);
  assert.ok(saved.result.charts.D60);
  assert.notDeepEqual(saved.result.charts.D1.planets, saved.result.charts.D60.planets);
  assert.equal(saved.result.birth.time, "12:00:37");
  const archive = structuredClone(storage.data.calculations);
  controller.dispose();
  const reopened = new WorkspaceController(storage, async () => { throw Error("Reload must use saved calculations"); });
  await reopened.initialize();
  assert.equal(reopened.getSnapshot().error, null);
  assert.equal(reopened.getSnapshot().results.astrology?.id, saved.id);
  assert.deepEqual(reopened.getSnapshot().data.calculations, archive);
  assert.equal(hasUnsavedProfile(reopened.getSnapshot().data), false);
  reopened.dispose();
});

test("cancelling edits restores the saved person and permits opening another or starting a new chart", async () => {
  const storage = new Storage(), controller = new WorkspaceController(storage);
  await controller.initialize();
  await controller.dispatch({ type: "edit-draft", patch: { ...sampleDraft(), name: "Synthetic Alpha" } });
  assert.equal(await saveBirthChart(controller, false), true);
  const alphaId = controller.getSnapshot().data.ui.selectedProfileId!;
  await controller.dispatch({ type: "new-profile" });
  await controller.dispatch({ type: "edit-draft", patch: { ...sampleDraft(), name: "Synthetic Beta" } });
  assert.equal(await saveBirthChart(controller, false), true);
  const betaId = controller.getSnapshot().data.ui.selectedProfileId!;
  const records = structuredClone(storage.data.profiles);
  await controller.dispatch({ type: "open-profile", id: alphaId });
  await controller.dispatch({ type: "edit-draft", patch: { name: "Uncommitted edit", time: "13:15:42" } });
  assert.equal(hasUnsavedProfile(controller.getSnapshot().data), true);
  await controller.dispatch({ type: "open-profile", id: betaId });
  assert.equal(controller.getSnapshot().error, "save_draft_first");
  assert.equal(await discardBirthDraft(controller), true);
  assert.equal(hasUnsavedProfile(controller.getSnapshot().data), false);
  assert.deepEqual(controller.getSnapshot().data.ui.draft, records.find(p => p.id === alphaId)!.data);
  assert.deepEqual(storage.data.profiles, records);
  await controller.dispatch({ type: "open-profile", id: betaId });
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(controller.getSnapshot().data.ui.selectedProfileId, betaId);
  await controller.dispatch({ type: "new-profile" });
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(controller.getSnapshot().data.ui.selectedProfileId, null);
  assert.deepEqual(controller.getSnapshot().data.ui.draft, emptyDraft());
  assert.deepEqual(storage.data.profiles, records);
  controller.dispose();
});

test("failed calculation retains the saved birth record and retry fills it without a duplicate person", async () => {
  const storage = new Storage(); let unavailable = true;
  const controller = new WorkspaceController(storage, async input => {
    if (unavailable) throw new WorkspaceError("engine_unavailable");
    return calculateAstrology(input);
  });
  await controller.initialize();
  await controller.dispatch({ type: "edit-draft", patch: sampleDraft() });
  assert.equal(await saveBirthChart(controller, true), false);
  const failed = controller.getSnapshot(), personId = failed.data.ui.selectedProfileId;
  assert.equal(failed.error, "engine_unavailable");
  assert.equal(failed.busy, false); assert.equal(failed.saving, false);
  assert.equal(storage.data.profiles.length, 1);
  assert.deepEqual(storage.data.profiles[0].data, sampleDraft());
  assert.equal(storage.data.calculations.length, 0);
  assert.equal(hasUnsavedProfile(failed.data), false);
  unavailable = false;
  assert.equal(await saveBirthChart(controller, true), true);
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(storage.data.profiles.length, 1);
  assert.equal(storage.data.profiles[0].id, personId);
  assert.equal(storage.data.calculations.length, 1);
  const saved = storage.data.calculations[0];
  assert.equal(saved.profileId, personId);
  assert.ok(saved.kind === "astrology");
  assert.equal(Object.keys(saved.result.charts).length, 20);
  controller.dispose();
});

test("save waits for pending draft persistence and calculates the latest typed birth details", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  class DelayedStorage extends Storage {
    pauseNextWrite = true;
    override async save(data: WorkspaceData, expected: number) {
      if (this.pauseNextWrite) { this.pauseNextWrite = false; await gate; }
      return super.save(data, expected);
    }
  }
  const storage = new DelayedStorage();
  const controller = new WorkspaceController(storage, async input => calculateAstrology(input));
  await controller.initialize();
  const firstEdit = controller.dispatch({ type: "edit-draft", patch: sampleDraft() });
  assert.equal(controller.getSnapshot().saving, true);
  const lastEdit = controller.dispatch({ type: "edit-draft", patch: { time: "12:01:23" } });
  let finished = false;
  const submission = saveBirthChart(controller, true).then(value => { finished = true; return value; });
  await Promise.resolve();
  assert.equal(finished, false, "submitting must wait instead of silently returning false");
  release();
  await Promise.all([firstEdit, lastEdit]);
  assert.equal(await submission, true);
  assert.equal(storage.data.profiles.length, 1);
  assert.equal(storage.data.profiles[0].data.time, "12:01:23");
  assert.equal(storage.data.calculations.length, 1);
  const saved = storage.data.calculations[0];
  assert.ok(saved.kind === "astrology");
  assert.equal(saved.result.birth.time, "12:01:23");
  assert.equal(Object.keys(saved.result.charts).length, 20);
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(controller.getSnapshot().storageError, null);
  controller.dispose();
});
