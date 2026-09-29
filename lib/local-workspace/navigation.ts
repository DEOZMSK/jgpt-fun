import type { WorkspaceAction } from "./controller";
import { emptyDraft, hasUnsavedProfile, type BirthDraft, type WorkspaceData } from "./model";

/** Warn before leaving entered birth data, but not an untouched new-chart form. */
export function hasMeaningfulBirthDraft(data: WorkspaceData): boolean {
  if (data.profiles.some(profile => profile.id === data.ui.selectedProfileId)) return hasUnsavedProfile(data);
  const blank = emptyDraft();
  return (Object.keys(blank) as (keyof BirthDraft)[]).some(key => data.ui.draft[key] !== blank[key]);
}

export function catalogProfiles(data: WorkspaceData, allFolders = false) {
  const search = data.ui.search.trim().toLocaleLowerCase();
  return data.profiles.filter(profile => {
    const inFolder = allFolders || (!data.ui.folderFilter || data.ui.folderFilter === "unfiled"
      ? !profile.data.folderId : profile.data.folderId === data.ui.folderFilter);
    return (Boolean(search) || inFolder) && `${profile.data.name} ${profile.data.date} ${profile.data.place}`.toLocaleLowerCase().includes(search);
  });
}

/** Return to folders and unfiled charts without retaining a hidden search. */
export function showAllCharts(act: (action: WorkspaceAction) => void) {
  act({ type: "search", text: "" });
  act({ type: "filter-folder", id: null });
}

export function selectedAstrologySnapshots(data: WorkspaceData) {
  if (!data.ui.selectedProfileId) return [];
  return data.calculations.filter(calculation => calculation.profileId === data.ui.selectedProfileId && calculation.kind === "astrology")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
