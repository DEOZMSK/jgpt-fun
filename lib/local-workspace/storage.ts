import { decodeWorkspace, emptyWorkspace, WorkspaceError, type WorkspaceData } from "./model";

export type WorkspaceEnvelope = { revision: number; data: WorkspaceData };
export interface WorkspaceStorage {
  load(): Promise<WorkspaceEnvelope>;
  save(data: WorkspaceData, expectedRevision: number): Promise<number>;
  close(): void;
}

/** One atomic document keeps stored snapshots and cross-record references consistent. */
export class IndexedWorkspaceStorage implements WorkspaceStorage {
  constructor(private readonly databaseName = "global-local-workspace-v1") {}
  private connection: Promise<IDBDatabase> | null = null;
  private db() {
    if (!this.connection) this.connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new WorkspaceError("storage_unavailable"));
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("workspace");
      request.onerror = () => { this.connection = null; reject(new WorkspaceError("storage_unavailable")); };
      request.onblocked = () => { this.connection = null; reject(new WorkspaceError("storage_blocked")); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.connection = null; };
        resolve(db);
      };
    });
    return this.connection;
  }
  async load(): Promise<WorkspaceEnvelope> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      // A single read/write transaction serializes concurrent migrations and backups.
      const transaction = db.transaction("workspace", "readwrite");
      const store = transaction.objectStore("workspace");
      const request = store.get("current");
      let loaded: WorkspaceEnvelope = { revision: 0, data: emptyWorkspace() };
      let reason = "storage_unavailable";
      transaction.onabort = () => reject(new WorkspaceError(reason));
      transaction.onerror = () => { if (transaction.error?.name === "QuotaExceededError") reason = "storage_quota"; };
      transaction.oncomplete = () => resolve(loaded);
      request.onsuccess = () => {
        try {
          const envelope = request.result;
          if (!envelope) return;
          if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || envelope.revision >= Number.MAX_SAFE_INTEGER) throw new WorkspaceError("storage_invalid");
          const migrated = envelope.data?.schemaVersion === 1;
          loaded = { revision: envelope.revision + (migrated ? 1 : 0), data: decodeWorkspace(envelope.data) };
          if (migrated) {
            const recovery = store.get("schema1-recovery");
            recovery.onsuccess = () => {
              try {
                if (!recovery.result) store.put(envelope, "schema1-recovery");
                store.put(loaded, "current");
              } catch (e) { reason = e instanceof DOMException && e.name === "QuotaExceededError" ? "storage_quota" : "storage_unavailable"; transaction.abort(); }
            };
          }
        } catch { reason = "storage_invalid"; transaction.abort(); }
      };
    });
  }
  async save(data: WorkspaceData, expectedRevision: number): Promise<number> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      const store = transaction.objectStore("workspace");
      let reason = "storage_unavailable";
      transaction.onabort = () => reject(new WorkspaceError(reason));
      transaction.onerror = () => { if (transaction.error?.name === "QuotaExceededError") reason = "storage_quota"; };
      transaction.oncomplete = () => resolve(expectedRevision + 1);
      const request = store.get("current");
      request.onsuccess = () => {
        const actualRevision = (request.result as WorkspaceEnvelope | undefined)?.revision ?? 0;
        // An older open application cannot write v1 over a migrated document.
        if (actualRevision !== expectedRevision || request.result?.data?.schemaVersion === 1) { reason = "storage_conflict"; transaction.abort(); return; }
        try { store.put({ revision: expectedRevision + 1, data }, "current"); }
        catch (e) { reason = e instanceof DOMException && e.name === "QuotaExceededError" ? "storage_quota" : "storage_unavailable"; transaction.abort(); }
      };
    });
  }
  close() { void this.connection?.then(db => db.close(), () => {}); this.connection = null; }
}
