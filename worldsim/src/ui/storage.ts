/** A tiny promise wrapper around IndexedDB for save games. */
const DB = 'worldsim';
const STORE = 'saves';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface SaveSlot {
  data: string;
  seed: number;
  year: number;
  savedAt: number;
}

export async function putSave(slot: string, save: SaveSlot): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(save, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getSave(slot: string): Promise<SaveSlot | null> {
  try {
    const db = await open();
    const result = await new Promise<SaveSlot | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(slot);
      req.onsuccess = () => resolve((req.result as SaveSlot) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null; // storage blocked (private mode etc.)
  }
}
