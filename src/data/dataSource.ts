// ---------------------------------------------------------------------------
// dataSource.ts
//
// THE SWAP POINT.
//
// Every screen in CashCue gets its data by calling loadSnapshot(). None of them
// know or care where it came from. For the first review that is the mock month;
// later, when judges upload their own statement, only this one file changes.
// No screen gets rewritten.
// ---------------------------------------------------------------------------

import { FinancialSnapshot } from '../types';
import { mockSnapshot } from './mockData';

/** Flip to 'upload' once CSV import is built. */
export type DataMode = 'mock' | 'upload';

export const DATA_MODE: DataMode = 'mock';

/**
 * Returns everything the app needs to show.
 *
 * It is async (returns a Promise) even though mock data is instant. That is
 * deliberate: reading a real file WILL be slow, and writing the screens
 * against a Promise now means they need no changes later.
 */
export async function loadSnapshot(): Promise<FinancialSnapshot> {
  if (DATA_MODE === 'mock') {
    return mockSnapshot;
  }

  // Later: read the judge's uploaded CSV, turn it into a FinancialSnapshot,
  // and return it. Same shape in, same screens out.
  throw new Error('Upload mode is not built yet');
}
