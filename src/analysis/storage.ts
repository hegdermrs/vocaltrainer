import { SessionArtifact, SessionArtifactIndexItem } from '@/src/analysis/types';

const DB_NAME = 'voice-trainer-ai';
const DB_VERSION = 1;
const STORE_NAME = 'session-artifacts';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function artifactToIndexItem(artifact: SessionArtifact): SessionArtifactIndexItem {
  return {
    id: artifact.id,
    timestamp: artifact.timestamp,
    practiceMode: artifact.payload.practiceMode,
    analysisStatus: artifact.analysisStatus,
    hasAudio: Boolean(artifact.recording?.blob),
    hasReport: Boolean(artifact.analysisReport),
    reportSummary: artifact.analysisReport?.summary
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((db) =>
    new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    })
  );
}

export async function saveSessionArtifact(artifact: SessionArtifact): Promise<void> {
  if (!isBrowser()) return;
  await withStore('readwrite', (store) => store.put(artifact));
}

export async function getSessionArtifact(id: number): Promise<SessionArtifact | undefined> {
  if (!isBrowser()) return undefined;
  const result = await withStore<SessionArtifact | undefined>('readonly', (store) => store.get(id));
  return result;
}

export async function listSessionArtifacts(): Promise<SessionArtifactIndexItem[]> {
  if (!isBrowser()) return [];
  const records = await withStore<SessionArtifact[]>('readonly', (store) => store.getAll());
  return (records ?? [])
    .slice()
    .sort((a, b) => b.id - a.id)
    .map(artifactToIndexItem);
}
