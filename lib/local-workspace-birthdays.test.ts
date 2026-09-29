import assert from "node:assert/strict";
import { calculateAstrology } from "./astrology/engine-core";
import test from "node:test";
import { birthdayReminderEnabled, localBirthdayDate, upcomingBirthdays } from "./local-workspace/birthdays";
import { WorkspaceController, type WorkspaceAction } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, fingerprint, hasUnsavedProfile, isOutdated, sampleDraft, validateWorkspace, WorkspaceError, type LocalFolder, type LocalProfile, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

const identifier = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const timestamp = "2026-09-09T12:00:00.000Z";
const profile = (date: string, n = 1): LocalProfile => ({ id: identifier(n), data: { ...sampleDraft(), name: `Synthetic ${n}`, date }, createdAt: timestamp, updatedAt: timestamp, birthdayReminder: true });

test("birthdays use optional personal overrides before folder inheritance", () => {
  const folder: LocalFolder = { id: identifier(10), name: "Synthetic folder", birthdayReminder: true };
  const person = profile("2000-09-09"); person.data.folderId = folder.id; delete person.birthdayReminder;
  assert.equal(birthdayReminderEnabled(person, [folder]), true);
  person.birthdayReminder = false;
  assert.equal(birthdayReminderEnabled(person, [folder]), false);
  person.birthdayReminder = true;
  assert.equal(birthdayReminderEnabled(person, [{ ...folder, birthdayReminder: false }]), true);
  delete person.birthdayReminder;
  assert.equal(birthdayReminderEnabled(person, []), false);
  assert.equal(birthdayReminderEnabled(person, [{ id: folder.id, name: folder.name }]), false);
  person.data.folderId = null;
  assert.equal(birthdayReminderEnabled(person, [folder]), false);
});

test("birthdays show today, tomorrow and the inclusive seven-day horizon across New Year", () => {
  const people = [profile("2000-01-06", 6), profile("2000-12-31", 2), profile("2000-12-30", 1), profile("2000-01-01", 3), profile("2000-01-07", 7)];
  assert.deepEqual(upcomingBirthdays(people, [], "2026-12-30").map(item => [item.date, item.daysUntil, item.age]), [
    ["2026-12-30", 0, 26], ["2026-12-31", 1, 26], ["2027-01-01", 2, 27], ["2027-01-06", 7, 27]
  ]);
  assert.deepEqual(upcomingBirthdays(people, [], "2026-12-30", 0).map(item => item.daysUntil), [0]);
  assert.deepEqual(upcomingBirthdays(people, [], "invalid"), []);
  assert.deepEqual(upcomingBirthdays(people, [], "2026-12-30", -1), []);
});

test("February 29 reminders use February 28 in common years and preserve the birth record", () => {
  const person = profile("2000-02-29"), original = structuredClone(person);
  assert.deepEqual(upcomingBirthdays([person], [], "2027-02-27").map(item => [item.date, item.daysUntil, item.age, item.adjustedLeapDay]), [["2027-02-28", 1, 27, true]]);
  assert.deepEqual(upcomingBirthdays([person], [], "2028-02-28").map(item => [item.date, item.daysUntil, item.age, item.adjustedLeapDay]), [["2028-02-29", 1, 28, false]]);
  assert.equal(upcomingBirthdays([person], [], "2100-02-28")[0].date, "2100-02-28");
  assert.deepEqual(upcomingBirthdays([person], [], "2027-03-01"), []);
  assert.deepEqual(person, original);
});

test("future and invalid birth dates are omitted; civil date arithmetic is independent of DST", () => {
  const people = [profile("2026-09-10"), profile("2027-09-09", 2), profile("2026-02-29", 3), profile("2000-02-30", 4)];
  assert.deepEqual(upcomingBirthdays(people, [], "2026-09-09"), []);
  assert.equal(upcomingBirthdays([profile("2026-09-09")], [], "2026-09-09")[0].age, 0);
  assert.equal(upcomingBirthdays([profile("2000-03-09")], [], "2026-03-07")[0].daysUntil, 2);
  assert.equal(upcomingBirthdays([profile("2000-11-02")], [], "2026-10-31")[0].daysUntil, 2);
  assert.equal(localBirthdayDate(new Date(2026, 8, 9, 0, 1)), "2026-09-09");
  assert.equal(localBirthdayDate(new Date(2026, 8, 9, 23, 59)), "2026-09-09");
  assert.equal(localBirthdayDate(new Date(NaN)), "");
});

class MemoryStorage implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; rejectSave = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) {
    if (this.rejectSave) throw new WorkspaceError("storage_quota");
    if (revision !== this.revision) throw new WorkspaceError("storage_conflict");
    this.data = structuredClone(validateWorkspace(data)); return ++this.revision;
  }
  close() {}
}
async function setup() {
  const storage = new MemoryStorage();
  storage.data.profiles = [profile("2000-09-09")]; delete storage.data.profiles[0].birthdayReminder;
  storage.data.folders = [{ id: identifier(10), name: "Synthetic folder" }];
  storage.data.profiles[0].data.folderId = identifier(10);
  storage.data.ui.selectedProfileId = identifier(1); storage.data.ui.draft = { ...storage.data.profiles[0].data };
  let id = 20;
  const controller = new WorkspaceController(storage, async input => calculateAstrology(input), () => new Date(timestamp), () => identifier(id++));
  await controller.initialize();
  return { storage, controller };
}

test("reminder metadata is backward-compatible, boolean-only and retained by the shared archive", () => {
  const data = emptyWorkspace(); data.profiles = [profile("2000-09-09")]; delete data.profiles[0].birthdayReminder;
  data.folders = [{ id: identifier(10), name: "Synthetic folder" }];
  assert.equal(decodeWorkspace(data).profiles[0].birthdayReminder, undefined);
  data.profiles[0].birthdayReminder = false; data.folders[0].birthdayReminder = true;
  const archive = decodeWorkspace(data);
  assert.equal(archive.profiles[0].birthdayReminder, false); assert.equal(archive.folders[0].birthdayReminder, true);
  for (const collection of ["profiles", "folders"] as const) {
    for (const invalid of [null, "true", 1, {}, undefined]) {
      const broken = structuredClone(data);
      (broken[collection][0] as unknown as Record<string, unknown>).birthdayReminder = invalid;
      assert.throws(() => validateWorkspace(broken));
    }
    const broken = structuredClone(data);
    (broken[collection][0] as unknown as Record<string, unknown>).birthdayEmail = "not-an-enabled-field";
    assert.throws(() => validateWorkspace(broken));
  }
});

test("reminder actions persist atomically without changing drafts, calculations or fingerprints", async () => {
  const { controller, storage } = await setup();
  await controller.dispatch({ type: "calculate", kind: "astrology" });
  await controller.dispatch({ type: "save-calculation" });
  const before = controller.getSnapshot().data, snapshots = JSON.stringify(before.calculations), input = JSON.stringify(before.ui.draft);
  const beforeFingerprint = fingerprint(before.profiles[0].data, "astrology", before.ui.periodMode, 2026);
  await controller.dispatch({ type: "folder-birthday-reminder", id: identifier(10), enabled: true });
  await controller.dispatch({ type: "profile-birthday-reminder", id: identifier(1), enabled: false });
  assert.equal(birthdayReminderEnabled(controller.getSnapshot().data.profiles[0], controller.getSnapshot().data.folders), false);
  await controller.dispatch({ type: "profile-birthday-reminder", id: identifier(1), enabled: null });
  const after = controller.getSnapshot().data;
  assert.equal(birthdayReminderEnabled(after.profiles[0], after.folders), true);
  assert.equal(Object.hasOwn(after.profiles[0], "birthdayReminder"), false);
  assert.equal(JSON.stringify(after.calculations), snapshots); assert.equal(JSON.stringify(after.ui.draft), input);
  assert.equal(fingerprint(after.profiles[0].data, "astrology", after.ui.periodMode, 2026), beforeFingerprint);
  assert.equal(hasUnsavedProfile(after), false); assert.equal(isOutdated(after.calculations[0], after, 2026), false);
  const restored = new WorkspaceController(storage); await restored.initialize();
  assert.equal(birthdayReminderEnabled(restored.getSnapshot().data.profiles[0], restored.getSnapshot().data.folders), true);
  storage.rejectSave = true;
  await controller.dispatch({ type: "profile-birthday-reminder", id: identifier(1), enabled: false });
  assert.equal(controller.getSnapshot().error, "storage_quota");
  assert.equal(birthdayReminderEnabled(controller.getSnapshot().data.profiles[0], controller.getSnapshot().data.folders), true);
  controller.dispose(); restored.dispose();
});

test("bulk opt-in preserves personal opt-outs and validates every action shape", async () => {
  const { controller, storage } = await setup(); controller.dispose();
  storage.data.profiles.push(profile("2000-09-09", 2), profile("2000-09-10", 3));
  storage.data.profiles[1].birthdayReminder = false; delete storage.data.profiles[2].birthdayReminder;
  const next = new WorkspaceController(storage); await next.initialize();
  await next.dispatch({ type: "enable-birthday-reminders" });
  const data = next.getSnapshot().data;
  assert.equal(data.folders[0].birthdayReminder, true);
  assert.deepEqual(data.profiles.map(item => birthdayReminderEnabled(item, data.folders)), [true, false, true]);
  assert.equal(data.profiles[0].birthdayReminder, undefined);
  await next.dispatch({ type: "folder-birthday-reminder", id: identifier(10), enabled: false });
  assert.equal(birthdayReminderEnabled(next.getSnapshot().data.profiles[0], next.getSnapshot().data.folders), false);
  const original = JSON.stringify(next.getSnapshot().data);
  for (const action of [
    { type: "profile-birthday-reminder", id: identifier(1), enabled: "true" },
    { type: "folder-birthday-reminder", id: identifier(10), enabled: null },
    { type: "profile-birthday-reminder", id: identifier(1), enabled: true, email: "unexpected" },
    { type: "enable-birthday-reminders", enabled: true },
    { type: "folder-birthday-reminder", id: identifier(99), enabled: true },
    { type: "profile-birthday-reminder", id: identifier(99), enabled: true }
  ]) {
    await next.dispatch(action as WorkspaceAction);
    assert.ok(next.getSnapshot().error); assert.equal(JSON.stringify(next.getSnapshot().data), original);
  }
  next.dispose();
});
