import { astrologyInput, validateProfile, type BirthDraft } from "./model";
import type { WorkspaceController } from "./controller";
import { refreshAstrology } from "./refresh-calculation";

export type BirthIssue = { field: keyof BirthDraft; code: string };
export function birthCalculationIssue(draft: BirthDraft): BirthIssue | null {
  if (!draft.name.trim()) return { field: "name", code: "invalid_profile" };
  if (!draft.date) return { field: "date", code: "invalid_date" };
  if (!draft.time) return { field: "time", code: "invalid_time" };
  if (draft.accuracy !== "exact") return { field: "accuracy", code: "uncertain_time" };
  if (!draft.place || !draft.latitude.trim() || !draft.longitude.trim() || !draft.timezone) return { field: "place", code: "missing_birth_details" };
  try { astrologyInput(validateProfile(draft)); return null; }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "invalid_profile";
    const fields: Record<string, keyof BirthDraft> = { invalid_date: "date", invalid_time: "time", uncertain_time: "accuracy", invalid_timezone: "timezone", invalid_latitude: "latitude", invalid_longitude: "longitude", invalid_coordinates: "latitude", ambiguous_time: "utcOffsetMinutes", nonexistent_time: "time" };
    return { field: fields[code] ?? "place", code };
  }
}

/** Validate before creating a record, then persist the actual computed snapshot. */
export async function saveBirthChart(controller: WorkspaceController, calculate = true): Promise<boolean> {
  if (controller.getSnapshot().busy || controller.getSnapshot().storageError) return false;
  // Typing saves a draft asynchronously; submitting must wait for that write.
  await controller.settle();
  const before = controller.getSnapshot();
  if (before.busy || before.saving || before.storageError) return false;
  if (calculate && birthCalculationIssue(before.data.ui.draft)) return false;
  await controller.dispatch({ type: "save-profile" });
  await controller.settle();
  if (controller.getSnapshot().error || controller.getSnapshot().storageError) return false;
  return calculate ? refreshAstrology(controller) : true;
}

export async function discardBirthDraft(controller: WorkspaceController): Promise<boolean> {
  if (controller.getSnapshot().busy) return false;
  await controller.dispatch({ type: "reset-draft" });
  await controller.settle();
  return !controller.getSnapshot().error && !controller.getSnapshot().storageError;
}
