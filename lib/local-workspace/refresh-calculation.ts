import type { WorkspaceController } from "./controller";

/** Explicitly calculate and save a new result; never replace an archived snapshot. */
export async function refreshAstrology(controller: WorkspaceController): Promise<boolean> {
  const before = controller.getSnapshot();
  if (before.busy || before.saving || before.storageError || !before.data.ui.selectedProfileId) return false;
  await controller.dispatch({ type: "calculate", kind: "astrology" });
  const calculated = controller.getSnapshot();
  if (calculated.error || calculated.storageError || calculated.result?.kind !== "astrology"
    || calculated.result.profileId !== before.data.ui.selectedProfileId
    || calculated.data.ui.selectedProfileId !== before.data.ui.selectedProfileId) return false;
  await controller.dispatch({ type: "save-calculation" });
  await controller.settle();
  const saved = controller.getSnapshot();
  return !saved.error && !saved.storageError && saved.data.calculations.some(c => c.id === saved.result?.id);
}
