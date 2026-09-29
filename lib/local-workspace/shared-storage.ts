import type {WorkspaceData,LocalCalculation} from "./model";
export type RecoveryState = { data: WorkspaceData; results: LocalCalculation[] };
export type WorkspaceRecovery = RecoveryState & { id: string; createdAt: string; pending: WorkspaceData | null };
export type RecoveryStorageMethods = { recover(state: RecoveryState): Promise<void>; getRecoveryEntries(): WorkspaceRecovery[] };
