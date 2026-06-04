import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export type SyncPhase = 'idle' | 'listing' | 'complete' | 'error';

export type SyncStatus = {
  phase: SyncPhase;
  message: string;
  currentPage: number;
  importedCount: number;
  alibabaTotal: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

const STATUS_DIR = path.join(process.cwd(), 'data');
const STATUS_FILE = path.join(STATUS_DIR, 'sync-status.json');

const IDLE_STATUS: SyncStatus = {
  phase: 'idle',
  message: 'Ready to sync',
  currentPage: 0,
  importedCount: 0,
  alibabaTotal: null,
  startedAt: null,
  completedAt: null,
  error: null,
};

export function readSyncStatus(): SyncStatus {
  try {
    if (existsSync(STATUS_FILE)) {
      return { ...IDLE_STATUS, ...JSON.parse(readFileSync(STATUS_FILE, 'utf-8')) };
    }
  } catch {
    /* use idle */
  }
  return { ...IDLE_STATUS };
}

export function writeSyncStatus(status: Partial<SyncStatus>) {
  if (!existsSync(STATUS_DIR)) {
    mkdirSync(STATUS_DIR, { recursive: true });
  }
  const next = { ...readSyncStatus(), ...status };
  writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export function resetSyncStatus() {
  return writeSyncStatus({
    ...IDLE_STATUS,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  });
}

export function completeSyncStatus(importedCount: number, alibabaTotal: number | null) {
  return writeSyncStatus({
    phase: 'complete',
    message: `Imported ${importedCount.toLocaleString()} products from Alibaba`,
    importedCount,
    alibabaTotal,
    completedAt: new Date().toISOString(),
    error: null,
  });
}

export function failSyncStatus(error: string) {
  return writeSyncStatus({
    phase: 'error',
    message: 'Sync failed',
    error,
    completedAt: new Date().toISOString(),
  });
}
