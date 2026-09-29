import { VARGAS } from "../astrology/contracts";
import { birthCalculationIssue } from "./birth-flow";
import type { WorkspaceController, WorkspaceView } from "./controller";
import { hasUnsavedProfile, isOutdated } from "./model";
import { refreshAstrology } from "./refresh-calculation";

/** Opening a complete birth record should also open its computed chart. */
export function needsAutomaticChart(view: WorkspaceView): boolean {
  if (!view.loaded || view.busy || view.saving || view.error || view.storageError || hasUnsavedProfile(view.data)) return false;
  const profile = view.data.profiles.find(p => p.id === view.data.ui.selectedProfileId);
  if (!profile || birthCalculationIssue(profile.data)) return false;
  const result = view.results.astrology;
  // A deliberately opened older snapshot remains selected across route remounts.
  // Only a complete result matching this person's current birth data satisfies it.
  if (view.data.calculations.some(calculation => calculation.profileId === profile.id
    && calculation.kind === "astrology" && VARGAS.every(varga => calculation.result.charts[varga])
    && !isOutdated(calculation, view.data))) return false;
  return !result || result.kind !== "astrology" || isOutdated(result, view.data) || VARGAS.some(varga => !result.result.charts[varga]);
}

/** Recheck identity after pending writes; never calculate another selected person. */
export async function ensureOpenedChart(controller: WorkspaceController, profileId: string): Promise<boolean> {
  await controller.settle();
  const view = controller.getSnapshot();
  if (view.data.ui.selectedProfileId !== profileId || !needsAutomaticChart(view)) return false;
  return refreshAstrology(controller);
}
