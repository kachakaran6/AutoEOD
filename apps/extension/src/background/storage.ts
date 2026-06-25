import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface SyncPayload {
  id: string; // local guid
  domain: string;
  url: string;
  pageTitle: string;
  tabOpenedAt: string;
  tabClosedAt?: string | null;
  durationSeconds: number;
  captureTier: number;
  snapshotText?: string | null;
  adapterPayload?: any | null;
}

interface AutoEODDB extends DBSchema {
  sync_queue: {
    key: string;
    value: {
      payload: SyncPayload;
      addedAt: number;
      retryCount: number;
      nextRetryAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AutoEODDB>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AutoEODDB>('AutoEOD-Extension-DB', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('sync_queue')) {
            db.deleteObjectStore('sync_queue');
          }
          db.createObjectStore('sync_queue', { keyPath: 'payload.id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueuePayload(payload: SyncPayload) {
  const db = await getDB();
  const existing = await db.get('sync_queue', payload.id);
  
  await db.put('sync_queue', {
    payload,
    addedAt: Date.now(),
    retryCount: existing ? existing.retryCount : 0,
    nextRetryAt: 0, // Immediately retryable
  });
}

export async function getPendingPayloads() {
  const db = await getDB();
  const all = await db.getAll('sync_queue');
  const now = Date.now();
  // Only return items that are eligible for retry
  return all.filter(item => item.nextRetryAt <= now);
}

export async function removePayload(id: string) {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function updatePayloadRetry(id: string, retryCount: number, nextRetryAt: number) {
  const db = await getDB();
  const existing = await db.get('sync_queue', id);
  if (existing) {
    await db.put('sync_queue', {
      ...existing,
      retryCount,
      nextRetryAt,
    });
  }
}
