/**
 * src/audio/customSoundStore.ts
 * -----------------------------
 * IndexedDB persistence + JSON backup export/import for user-recorded custom
 * sounds (Step 4 of the Updated Antigravity Brief).
 *
 * Persists custom recordings across page refreshes and browser restarts inside
 * the browser's IndexedDB (`sound-of-a-name-db`). Also allows exporting all
 * custom recordings as a portable `.json` backup file and importing them back.
 */

export interface StoredCustomSound {
  /** Key such as "num-0".."num-26" or "perc-snare-drum" */
  key: string;
  kind: 'number' | 'percussion';
  number?: number;
  percussionId?: string;
  mimeType: string;
  base64Data: string;
  sourceNote: string;
  updatedAt: string;
}

export interface CustomSoundBackupBundle {
  version: 1;
  exportedAt: string;
  application: 'The Sound of a Name';
  recordings: StoredCustomSound[];
}

const DB_NAME = 'sound-of-a-name-db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_sounds';

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'audio/wav' });
}

export async function loadAllCustomSoundsFromDb(): Promise<StoredCustomSound[]> {
  if (!isIndexedDbAvailable()) return [];
  try {
    const db = await openDatabase();
    return await new Promise<StoredCustomSound[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredCustomSound[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveCustomSoundToDb(record: StoredCustomSound): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Gracefully ignore storage quota or private-browsing errors
  }
}

export async function deleteCustomSoundFromDb(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore errors
  }
}

export async function clearAllCustomSoundsInDb(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore errors
  }
}

export async function createCustomSoundBackupBundle(): Promise<CustomSoundBackupBundle> {
  const recordings = await loadAllCustomSoundsFromDb();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    application: 'The Sound of a Name',
    recordings,
  };
}
