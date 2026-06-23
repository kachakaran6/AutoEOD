import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface SyncPayload {
  externalId: string;
  title: string;
  lastSeenAt: string;
  modelName?: string;
  workspace?: string;
  tabId?: number;
  windowId?: number;
  messages: Array<{ 
    id?: string;
    role: string; 
    excerpt: string;
    timestamp?: string;
    durationMs?: number;
  }>;
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
    dbPromise = openDB<AutoEODDB>('AutoEOD-Extension-DB', 1, {
      upgrade(db) {
        db.createObjectStore('sync_queue', { keyPath: 'payload.externalId' });
      },
    });
  }
  return dbPromise;
}

export async function enqueuePayload(payload: SyncPayload) {
  const db = await getDB();
  const existing = await db.get('sync_queue', payload.externalId);
  
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

export async function removePayload(externalId: string) {
  const db = await getDB();
  await db.delete('sync_queue', externalId);
}

export async function updatePayloadRetry(externalId: string, retryCount: number, nextRetryAt: number) {
  const db = await getDB();
  const existing = await db.get('sync_queue', externalId);
  if (existing) {
    await db.put('sync_queue', {
      ...existing,
      retryCount,
      nextRetryAt,
    });
  }
}
