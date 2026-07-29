/**
 * Lightweight IndexedDB store for offline mutation queue.
 * No external idb dependency — works in all modern browsers.
 */

const DB_NAME = "hope-securetrack-offline";
const DB_VERSION = 1;
const STORE = "queue";

export type OfflineJob = {
  id: string;
  createdAt: string;
  table: string;
  action: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  match?: { column: string; value: string };
  status: "pending" | "syncing" | "failed" | "done";
  attempts: number;
  lastError?: string;
  label?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("status", "status", { unique: false });
        os.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queuePut(job: OfflineJob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(job);
  await txDone(tx);
  db.close();
}

export async function queueGetAll(status?: OfflineJob["status"]): Promise<OfflineJob[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const req = status
    ? store.index("status").getAll(status)
    : store.getAll();
  const rows = await new Promise<OfflineJob[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OfflineJob[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function queueUpdate(
  id: string,
  patch: Partial<OfflineJob>
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const getReq = store.get(id);
  await new Promise<void>((resolve, reject) => {
    getReq.onsuccess = () => {
      const cur = getReq.result as OfflineJob | undefined;
      if (!cur) {
        resolve();
        return;
      }
      store.put({ ...cur, ...patch });
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
  await txDone(tx);
  db.close();
}

export async function queueDelete(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function queueCountPending(): Promise<number> {
  const rows = await queueGetAll("pending");
  const failed = await queueGetAll("failed");
  return rows.length + failed.length;
}

export function newJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
