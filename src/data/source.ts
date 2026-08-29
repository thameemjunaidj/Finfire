/**
 * source.ts
 *
 * The single door every screen walks through to get data.
 *
 * This file exists entirely so that Review 2 is an addition rather than a
 * rewrite. Today `getTransactions()` hands back the mock statement. When the
 * judges' CSV upload is built, it hands back the parsed upload instead — and
 * not one line of the alerts, runway or screen code has to change, because
 * none of them ever knew where the data came from.
 *
 * Rule for the whole team: NOTHING outside this folder imports mockData.
 */

import { Transaction } from '../types';
import { generateMockTransactions } from './mockData';

export type DataSourceName = 'mock' | 'uploaded';

let activeSource: DataSourceName = 'mock';
let uploadedTransactions: Transaction[] | null = null;

/** Generated once and reused, so every screen sees the same statement. */
let mockCache: Transaction[] | null = null;

/** Which statement the app is currently showing. */
export function getActiveSource(): DataSourceName {
  return activeSource;
}

/**
 * The one function the rest of the app calls.
 * Always returns transactions oldest-first.
 */
export function getTransactions(): Transaction[] {
  if (activeSource === 'uploaded' && uploadedTransactions) {
    return uploadedTransactions;
  }
  if (!mockCache) {
    mockCache = generateMockTransactions();
  }
  return mockCache;
}

/**
 * Review 2 hook: hand this the rows parsed out of an uploaded CSV and the
 * whole app switches over to the judge's own data.
 */
export function setUploadedTransactions(transactions: Transaction[]): void {
  uploadedTransactions = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  activeSource = 'uploaded';
}

/** Go back to the demo statement — useful for a "reset demo" button on stage. */
export function useMockData(): void {
  activeSource = 'mock';
  uploadedTransactions = null;
}
