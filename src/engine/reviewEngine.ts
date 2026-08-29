/**
 * reviewEngine.ts — checking a new batch for anything odd.
 *
 * When a week or a month of statement arrives at once, the useful question is
 * not "what did I spend" — the file already says that. It is "was any of this
 * not normal for me?"
 *
 * Every check below compares the new rows against THIS person's own history.
 * There is no table of what a reasonable dinner costs; ₹400 on food is
 * unremarkable for one person and alarming for another. Everything runs on the
 * device.
 */

import { Transaction, TransactionCategory } from '../types/finance';
import { daysBetween } from '../utils/dates';
import { formatCurrency } from '../utils/format';

export type ReviewFlag = 'bigger_than_usual' | 'new_merchant' | 'possible_duplicate' | 'category_spike';

export interface ReviewItem {
  transaction: Transaction;
  flag: ReviewFlag;
  headline: string;
  detail: string;
  /** How far outside normal, roughly. Used for ordering only. */
  weight: number;
}

export interface BatchReview {
  added: number;
  total: number;
  /** Only the rows worth a second look. */
  items: ReviewItem[];
  /** One line for the top of the screen. */
  summary: string;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function normalise(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Below this, an unusual payment is not worth interrupting anyone about. */
const WORTH_MENTIONING = 100;

/** Categories where "more than usual" is a choice the person made. */
const SPIKE_CATEGORIES: TransactionCategory[] = ['food', 'transport', 'shopping', 'entertainment'];

/** Nobody reads ten warnings. Show the ones that matter most. */
const MOST_ITEMS = 5;

export function reviewBatch(history: Transaction[], incoming: Transaction[]): BatchReview {
  const past = history.filter((t) => t.direction === 'debit' && t.source !== 'simulation');
  const fresh = incoming.filter((t) => t.direction === 'debit');
  const total = fresh.reduce((sum, t) => sum + t.amount, 0);

  // What this person's payments normally look like.
  const pastAmounts = past.map((t) => t.amount);
  const bigForThisPerson = percentile(pastAmounts, 0.9);

  const byMerchant = new Map<string, number[]>();
  past.forEach((t) => {
    const key = normalise(t.merchant);
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(t.amount);
  });

  const items: ReviewItem[] = [];

  for (const transaction of fresh) {
    const key = normalise(transaction.merchant);
    const seenBefore = byMerchant.get(key);

    // --- A payment to a familiar place, but much larger than usual.
    if (seenBefore && seenBefore.length >= 2) {
      const usual = median(seenBefore);
      const difference = transaction.amount - usual;
      if (usual > 0 && transaction.amount > usual * 2 && difference >= WORTH_MENTIONING) {
        items.push({
          transaction,
          flag: 'bigger_than_usual',
          headline: `${transaction.merchant} cost ${formatCurrency(transaction.amount)}`,
          detail: `You usually pay about ${formatCurrency(usual)} there. This one is ${formatCurrency(difference)} more.`,
          weight: difference,
        });
        continue;
      }
    }

    // --- Somewhere new, and not a small amount.
    if (!seenBefore && transaction.amount >= Math.max(bigForThisPerson, WORTH_MENTIONING)) {
      items.push({
        transaction,
        flag: 'new_merchant',
        headline: `First payment to ${transaction.merchant}`,
        detail: `${formatCurrency(transaction.amount)} — larger than most of what you usually spend, and somewhere you have not paid before.`,
        weight: transaction.amount,
      });
      continue;
    }

    // --- The same amount to the same place twice in a couple of days.
    const twin = fresh.find(
      (other) => other !== transaction
        && normalise(other.merchant) === key
        && other.amount === transaction.amount
        && Math.abs(daysBetween(other.date, transaction.date)) <= 2
        && other.id < transaction.id,
    );
    if (twin) {
      items.push({
        transaction,
        flag: 'possible_duplicate',
        headline: `Paid ${transaction.merchant} twice`,
        detail: `${formatCurrency(transaction.amount)} on ${twin.date} and again on ${transaction.date}. If you only meant to pay once, this is worth checking with them.`,
        weight: transaction.amount,
      });
    }
  }

  /**
   * Whole categories, not just single payments.
   *
   * Twelve ordinary-looking food orders will trip none of the checks above and
   * still be the reason the month went wrong. So we compare each category in
   * the batch against what this person normally spends over the same number of
   * days.
   */
  const batchDays = fresh.length
    ? Math.max(1, daysBetween(
      fresh.reduce((min, t) => (t.date < min ? t.date : min), fresh[0].date),
      fresh.reduce((max, t) => (t.date > max ? t.date : max), fresh[0].date),
    ) + 1)
    : 1;

  const pastDays = past.length
    ? Math.max(1, daysBetween(
      past.reduce((min, t) => (t.date < min ? t.date : min), past[0].date),
      past.reduce((max, t) => (t.date > max ? t.date : max), past[0].date),
    ) + 1)
    : 1;

  const categoryTotals = new Map<TransactionCategory, number>();
  fresh.forEach((t) => categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + t.amount));

  categoryTotals.forEach((amount, category) => {
    /**
     * Only categories a person actually chooses day to day.
     *
     * A ₹349 phone recharge lands once a month, so measured against a daily
     * average spread over a four-day window it is always "eleven times normal"
     * — every single month, forever. Bills and subscriptions have their own
     * detectors that understand they are scheduled; including them here just
     * manufactured alarming nonsense. "Other" is out too: it is where
     * uncategorised payments sit, so its baseline is near zero and the first
     * unknown merchant reads as "408 times your normal".
     */
    if (!SPIKE_CATEGORIES.includes(category)) return;

    const pastForCategory = past.filter((t) => t.category === category).reduce((s, t) => s + t.amount, 0);
    const usualForSameLength = (pastForCategory / pastDays) * batchDays;
    const difference = amount - usualForSameLength;

    // Needs a real baseline to be a real comparison.
    if (usualForSameLength < WORTH_MENTIONING) return;

    if (amount > usualForSameLength * 1.6 && difference >= WORTH_MENTIONING) {
      const times = (amount / usualForSameLength).toFixed(1);
      const biggest = fresh
        .filter((t) => t.category === category)
        .sort((a, b) => b.amount - a.amount)[0];

      items.push({
        transaction: biggest,
        flag: 'category_spike',
        headline: `${category} was ${times}x your normal`,
        detail: `${formatCurrency(amount)} over ${batchDays} days, against a usual ${formatCurrency(usualForSameLength)}. The largest single one was ${biggest.merchant} at ${formatCurrency(biggest.amount)}.`,
        weight: difference,
      });
    }
  });

  items.sort((a, b) => b.weight - a.weight);
  const shown = items.slice(0, MOST_ITEMS);

  const summary = shown.length === 0
    ? `${fresh.length} payments added, ${formatCurrency(total)} in total. Nothing looks unusual.`
    : `${fresh.length} payments added, ${formatCurrency(total)} in total. ${shown.length} ${shown.length === 1 ? 'thing is' : 'things are'} worth a look.`;

  return { added: fresh.length, total, items: shown, summary };
}
