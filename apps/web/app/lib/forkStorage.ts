import { v4 as uuidv4 } from 'uuid';
import type { Fork } from './forkTypes';

const DB_NAME = 'openscrim-forks';
const STORE_NAME = 'forks';
const DB_VERSION = 1;
const MAX_FORKS_PER_RECORDING = 50;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('recordingId', 'recordingId', {
          unique: false,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFork(fork: Fork): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(fork);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getForks(recordingId: string): Promise<Fork[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('recordingId');
    const request = index.getAll(recordingId);
    request.onsuccess = () => {
      resolve(
        (request.result as Fork[]).sort((a, b) => a.timestamp - b.timestamp)
      );
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getFork(id: string): Promise<Fork | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      resolve((request.result as Fork) ?? null);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function updateForkEdits(
  id: string,
  edits: string,
  cursor: { lineNumber: number; column: number },
  extras?: { files?: Record<string, string>; activePath?: string }
): Promise<void> {
  const fork = await getFork(id);
  if (!fork) return;
  fork.edits = edits;
  fork.cursor = cursor;
  if (extras?.files) fork.files = extras.files;
  if (extras?.activePath) fork.activePath = extras.activePath;
  fork.updatedAt = Date.now();
  await saveFork(fork);
}

export async function deleteFork(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function createFork(params: {
  recordingId: string;
  timestamp: number;
  content: string;
  language: string;
  cursor: { lineNumber: number; column: number };
  files?: Record<string, string>;
  activePath?: string;
}): Promise<Fork> {
  const forks = await getForks(params.recordingId);
  if (forks.length >= MAX_FORKS_PER_RECORDING) {
    const oldest = forks[0];
    if (oldest) {
      await deleteFork(oldest.id);
    }
  }

  const now = Date.now();
  const fork: Fork = {
    id: uuidv4(),
    recordingId: params.recordingId,
    timestamp: params.timestamp,
    content: params.content,
    language: params.language,
    cursor: params.cursor,
    edits: params.content,
    createdAt: now,
    updatedAt: now,
    files: params.files,
    activePath: params.activePath,
  };

  await saveFork(fork);
  return fork;
}
