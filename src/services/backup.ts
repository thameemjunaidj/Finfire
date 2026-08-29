/**
 * backup.ts — an optional copy, kept against the day the phone is lost.
 *
 * THE SHAPE OF IT
 * The phone is the source of truth. Backup is a copy taken when the person
 * asks for one, restored when they ask for it, and deleted when they say so.
 * With backup switched off the app behaves identically — everything is still
 * stored and analysed on the device.
 *
 * WHY IT IS OPT-IN
 * This is somebody's bank history. Turning it on should be a decision they
 * made, not a default they never noticed. And "delete everything" has to
 * actually delete — the server function removes the row rather than hiding it,
 * so afterwards there is nothing held about that person at all.
 */

import { PersistedFinanceState } from '../types/finance';

/**
 * Your Convex deployment URL, without a trailing slash — the same one used in
 * gemini.ts. Empty means backup is unavailable and the app says so rather than
 * failing.
 */
export const BACKUP_BASE_URL = 'https://precise-tern-860.eu-west-1.convex.site';

const TIMEOUT_MS = 12000;

export interface BackupInfo {
  updatedAt: number;
  transactionCount: number;
}

export function isBackupAvailable(): boolean {
  return BACKUP_BASE_URL.length > 0;
}

async function post(path: string, body: unknown): Promise<any | null> {
  if (!isBackupAvailable()) return null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKUP_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Send a copy up. Returns when it was stored, or null if it did not work. */
export async function saveBackup(
  owner: string,
  state: PersistedFinanceState,
): Promise<number | null> {
  const result = await post('/backup/save', {
    owner,
    payload: JSON.stringify(state),
    transactionCount: state.transactions.length,
  });
  return typeof result?.updatedAt === 'number' ? result.updatedAt : null;
}

/**
 * Fetch the copy without applying it.
 *
 * Two steps on purpose: the app shows what it found — how many payments, from
 * when — before replacing anything. Restoring a three-payment backup over a
 * month of work, with no warning, is a bug that only shows up as a furious
 * user.
 */
export async function fetchBackup(
  owner: string,
): Promise<{ state: PersistedFinanceState; info: BackupInfo } | null> {
  const result = await post('/backup/load', { owner });
  if (!result || result.empty || typeof result.payload !== 'string') return null;

  try {
    const state = JSON.parse(result.payload) as PersistedFinanceState;
    // A corrupt backup must not take the app down with it.
    if (!state || !Array.isArray(state.transactions) || !state.profile) return null;
    return {
      state,
      info: {
        updatedAt: Number(result.updatedAt) || 0,
        transactionCount: Number(result.transactionCount) || state.transactions.length,
      },
    };
  } catch {
    return null;
  }
}

/** Remove everything held for this account. Returns true when it is gone. */
export async function deleteBackup(owner: string): Promise<boolean> {
  const result = await post('/backup/delete', { owner });
  return result !== null && typeof result.deleted === 'number';
}

/** "2 hours ago", for the line under the backup button. */
export function describeWhen(timestamp: number): string {
  if (!timestamp) return 'never';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
