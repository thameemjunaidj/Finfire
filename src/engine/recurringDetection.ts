/**
 * recurringDetection.ts
 *
 * Finds repeating payments — subscriptions, bills, rent, EMIs — by looking at
 * the transactions themselves, and spots when one of them has gone up in price.
 *
 * Why this exists: until now every recurring payment was written by hand in
 * demoData.ts, including the price increase. That is fine for a scripted demo
 * and useless for real data. A bank statement has no "this is a subscription"
 * column, and neither will the CSV a judge uploads. Without this file, an
 * imported account produces zero subscription alerts.
 *
 * The method:
 *   1. Group debits by merchant.
 *   2. Measure the gaps between consecutive charges.
 *   3. If the gaps are consistent and roughly weekly-to-monthly, it repeats.
 *   4. Compare the latest charge against the one before it — that is the hike.
 *
 * Deliberately conservative. A false "your subscription went up" is far worse
 * than a missed one: it teaches the user that the alerts are noise.
 */

import { RecurringPayment, Transaction, TransactionCategory } from '../types/finance';
import { addDays, daysBetween } from '../utils/dates';

/** Two charges is thin evidence, but with only 60–90 days of history a monthly
 *  subscription may genuinely only appear twice. The consistency checks below
 *  are what stop that from producing nonsense. */
const MIN_OCCURRENCES = 2;

/** Gaps we accept as recurring: weekly through monthly, with some slack. */
const MIN_INTERVAL_DAYS = 6;
const MAX_INTERVAL_DAYS = 40;

/** How much the gaps may wobble. Bills rarely land on the same day each month. */
const INTERVAL_TOLERANCE_DAYS = 6;

/** A charge may differ from the merchant's normal by this much and still be
 *  the same subscription. Beyond it, the amounts are too erratic to be one. */
const AMOUNT_TOLERANCE = 0.5;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Merchant names arrive inconsistently ("NETFLIX.COM", "Netflix "). Group on a
 *  normalised key but keep the tidiest original spelling for display. */
function normaliseMerchant(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let best = values[0];
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestCount = count;
      best = value;
    }
  });
  return best;
}

/**
 * Find every repeating payment in a transaction list.
 * Returns them in the same shape the rest of the app already uses, so the
 * existing alert code picks up price increases with no changes.
 */
export function detectRecurringPayments(
  transactions: Transaction[],
  asOf: string = new Date().toISOString().slice(0, 10),
): RecurringPayment[] {
  const groups = new Map<string, Transaction[]>();

  transactions
    .filter((item) => item.direction === 'debit')
    .filter((item) => item.source !== 'simulation')
    .forEach((item) => {
      const key = normaliseMerchant(item.merchant);
      const existing = groups.get(key);
      if (existing) existing.push(item);
      else groups.set(key, [item]);
    });

  const detected: RecurringPayment[] = [];

  groups.forEach((rows, key) => {
    if (rows.length < MIN_OCCURRENCES) return;

    const ordered = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

    const gaps: number[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      gaps.push(daysBetween(ordered[index - 1].date, ordered[index].date));
    }

    const interval = Math.round(median(gaps));
    if (interval < MIN_INTERVAL_DAYS || interval > MAX_INTERVAL_DAYS) return;

    // Irregular gaps mean this is ordinary spending that happens to repeat.
    // Three Swiggy orders roughly a month apart are a coincidence, and this
    // check is what keeps them out of the "upcoming payments" list.
    const gapsConsistent = gaps.every((gap) => Math.abs(gap - interval) <= INTERVAL_TOLERANCE_DAYS);
    if (!gapsConsistent) return;

    const amounts = ordered.map((item) => item.amount);
    const typical = median(amounts);
    if (typical <= 0) return;

    /**
     * Amounts must be stable — EXCEPT the most recent one, which is allowed to
     * jump. That exception is the entire point: a price increase is a stable
     * history followed by one different charge. Without it, the very thing we
     * are hunting for would disqualify its own detection.
     */
    const historical = amounts.slice(0, -1);
    const stable = historical.every((amount) => Math.abs(amount - typical) / typical <= AMOUNT_TOLERANCE);
    if (!stable) return;

    const latest = ordered[ordered.length - 1];
    const previous = ordered[ordered.length - 2];

    /**
     * Roll the projected date forward until it is actually in the future.
     * A subscription last charged six weeks ago would otherwise be predicted
     * for a date that has already passed, and drop out of "upcoming payments"
     * entirely — the app would go quiet about a bill precisely when it is due.
     */
    let nextPaymentDate = addDays(latest.date, interval);
    let guard = 0;
    while (nextPaymentDate <= asOf && guard < 60) {
      nextPaymentDate = addDays(nextPaymentDate, interval);
      guard += 1;
    }

    detected.push({
      id: `detected-${key.replace(/\s+/g, '-')}`,
      merchant: latest.merchant,
      category: mostCommon(ordered.map((item) => item.category)) as TransactionCategory,
      previousAmount: previous ? previous.amount : latest.amount,
      currentAmount: latest.amount,
      nextPaymentDate,
      essential: mostCommon(ordered.map((item) => item.essential)),
    });
  });

  return detected;
}

/**
 * Combine hand-written recurring payments with detected ones.
 *
 * Anything declared explicitly wins — a person who told the app about a
 * payment knows more than our inference does. Detection only fills the gaps,
 * which is exactly what happens when a statement is imported and there are no
 * declared payments at all.
 */
export function mergeRecurringPayments(
  declared: RecurringPayment[],
  transactions: Transaction[],
  asOf?: string,
): RecurringPayment[] {
  const detected = detectRecurringPayments(transactions, asOf);
  const declaredKeys = new Set(declared.map((payment) => normaliseMerchant(payment.merchant)));

  const additions = detected.filter(
    (payment) => !declaredKeys.has(normaliseMerchant(payment.merchant)),
  );

  return [...declared, ...additions];
}
