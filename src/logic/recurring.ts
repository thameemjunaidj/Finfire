/**
 * recurring.ts
 *
 * Works out which payments repeat — subscriptions, bills, rent, salary.
 *
 * We DETECT these rather than being told, because a bank statement has no
 * "this is a subscription" column, and neither will the CSV a judge uploads
 * in Review 2. This one file is what lets the app say anything interesting
 * about the future instead of just summarising the past.
 *
 * The idea: group every transaction by merchant, look at the gaps between
 * charges, and if those gaps are consistent, call it recurring and project
 * the next one forward.
 */

import { RecurringPayment, Transaction } from '../types';
import { addDays, daysBetween, fromKey, toKey } from '../data/mockData';

/** Middle value of a list. Used instead of the average because one Rs 3,400
 *  electricity bill would drag an average up and hide the very spike we want
 *  to detect. The median shrugs that off. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** How many occurrences before we trust a pattern. Two charges 30 days apart
 *  is thin evidence; with 90 days of history most real subscriptions show 3. */
const MIN_OCCURRENCES = 2;

/** Gaps we accept as "recurring": weekly through roughly monthly. */
const MIN_INTERVAL = 6;
const MAX_INTERVAL = 40;

/** How much the gaps are allowed to wobble. Bills rarely land on the exact
 *  same day, so we allow a week of drift before giving up on the pattern. */
const INTERVAL_TOLERANCE = 7;

export function detectRecurring(transactions: Transaction[]): RecurringPayment[] {
  // Step 1: group by merchant.
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const existing = groups.get(tx.merchant);
    if (existing) existing.push(tx);
    else groups.set(tx.merchant, [tx]);
  }

  const results: RecurringPayment[] = [];

  for (const [merchant, rows] of groups) {
    if (rows.length < MIN_OCCURRENCES) continue;

    const ordered = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

    // Step 2: measure the gaps between consecutive charges.
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      gaps.push(daysBetween(ordered[i - 1].date, ordered[i].date));
    }

    const interval = Math.round(median(gaps));
    if (interval < MIN_INTERVAL || interval > MAX_INTERVAL) continue;

    // Step 3: reject wobbly patterns. Three Swiggy orders that happen to be
    // ~30 days apart are a coincidence, not a subscription — this is the check
    // that keeps random spending out of the "upcoming payments" list.
    const consistent = gaps.every((g) => Math.abs(g - interval) <= INTERVAL_TOLERANCE);
    if (!consistent) continue;

    const amounts = ordered.map((t) => t.amount);
    const last = ordered[ordered.length - 1];
    const previous = ordered.length >= 2 ? ordered[ordered.length - 2] : null;

    results.push({
      merchant,
      category: last.category,
      direction: last.direction,
      intervalDays: interval,
      lastAmount: last.amount,
      previousAmount: previous ? previous.amount : null,
      medianAmount: median(amounts),
      lastDate: last.date,
      nextDate: toKey(addDays(fromKey(last.date), interval)),
      occurrences: ordered.length,
    });
  }

  // Biggest commitments first — that is the order a worried person wants.
  return results.sort((a, b) => b.lastAmount - a.lastAmount);
}

/** Recurring payments due between today and `until` (inclusive), soonest first. */
export function upcomingBefore(
  recurring: RecurringPayment[],
  today: string,
  until: string,
): RecurringPayment[] {
  return recurring
    .filter((r) => r.direction === 'debit')
    .filter((r) => r.nextDate >= today && r.nextDate <= until)
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}
