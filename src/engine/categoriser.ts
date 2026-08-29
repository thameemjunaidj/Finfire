/**
 * categoriser.ts — working out what a payment was for.
 *
 * A bank message says "Rs 240 to SWGY*ORDER". It does not say "food". This
 * file decides, on the phone, in two stages:
 *
 *   1. What this person has done before. If they have paid Swiggy eleven times
 *      and called it food every time, that is not a guess.
 *   2. Word by word, for merchants never seen. "Cafe", "mart", "recharge" and
 *      "pharmacy" each lean toward a category, and those leanings are learned
 *      from the user's own history rather than typed in by us.
 *
 * A small starter list gets a brand-new user going on day one, and is
 * overruled the moment their own history disagrees. That order matters: this
 * app is for one person, not the average person.
 */

import { Transaction, TransactionCategory } from '../types/finance';

export interface Categorisation {
  category: TransactionCategory;
  /** 0-1. Below about 0.5 the app should ask rather than assume. */
  confidence: number;
  /** Why, in words, so a wrong answer can be understood and corrected. */
  reason: string;
}

/** Day-one knowledge. Deliberately short: it exists so a new user is not shown
 *  a screen full of "Other", not to be a merchant database. */
const STARTER_WORDS: Array<[RegExp, TransactionCategory]> = [
  [/swiggy|zomato|dominos|pizza|restaurant|cafe|canteen|tea|bakery|mess|hotel|biryani|blinkit|zepto|instamart|grocer|mart/i, 'food'],
  [/uber|ola|rapido|metro|bus|auto|petrol|diesel|fuel|indian oil|bharat petro|hp pay|irctc|railway/i, 'transport'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|store|trends|lifestyle/i, 'shopping'],
  [/netflix|spotify|youtube|prime|hotstar|jiocinema|sony ?liv|zee|apple|google one|adobe|canva|chatgpt/i, 'subscription'],
  [/jio|airtel|\bvi\b|bsnl|vodafone|recharge|electricity|tneb|tangedco|broadband|fibernet|wifi|gas|water|bescom/i, 'utilities'],
  [/rent|\bpg\b|hostel|landlord|residency|apartment/i, 'rent'],
  [/pharmacy|apollo|medical|hospital|clinic|doctor|medplus|lab|diagnost/i, 'health'],
  [/pvr|inox|cinema|bookmyshow|movie|gaming|steam|playstation|concert/i, 'entertainment'],
  [/salary|stipend|pocket money|scholarship|refund|interest/i, 'income'],
];

const ALL_CATEGORIES: TransactionCategory[] = [
  'income', 'rent', 'utilities', 'food', 'transport',
  'shopping', 'entertainment', 'health', 'subscription', 'other',
];

/** What the model has learned from this person, ready to classify with. */
export interface CategoryModel {
  /** Exact merchant name to the category they chose for it, and how often. */
  byMerchant: Map<string, Map<TransactionCategory, number>>;
  /** Individual words to categories — how unseen merchants get classified. */
  byWord: Map<string, Map<TransactionCategory, number>>;
  /** How common each category is for this person overall. */
  categoryTotals: Map<TransactionCategory, number>;
  transactionsLearnedFrom: number;
}

function normalise(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(merchant: string): string[] {
  return normalise(merchant).split(' ').filter((w) => w.length >= 3);
}

function bump<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Learn from everything this person has already categorised. */
export function trainCategoryModel(transactions: Transaction[]): CategoryModel {
  const byMerchant = new Map<string, Map<TransactionCategory, number>>();
  const byWord = new Map<string, Map<TransactionCategory, number>>();
  const categoryTotals = new Map<TransactionCategory, number>();

  const usable = transactions.filter((t) => t.source !== 'simulation');

  for (const transaction of usable) {
    const key = normalise(transaction.merchant);
    if (!key) continue;

    if (!byMerchant.has(key)) byMerchant.set(key, new Map());
    bump(byMerchant.get(key)!, transaction.category);

    for (const word of words(transaction.merchant)) {
      if (!byWord.has(word)) byWord.set(word, new Map());
      bump(byWord.get(word)!, transaction.category);
    }

    bump(categoryTotals, transaction.category);
  }

  return { byMerchant, byWord, categoryTotals, transactionsLearnedFrom: usable.length };
}

function mostCommon(counts: Map<TransactionCategory, number>): { category: TransactionCategory; count: number; total: number } {
  let best: TransactionCategory = 'other';
  let bestCount = 0;
  let total = 0;
  counts.forEach((count, category) => {
    total += count;
    if (count > bestCount) { bestCount = count; best = category; }
  });
  return { category: best, count: bestCount, total };
}

export function categorise(model: CategoryModel, merchant: string): Categorisation {
  const key = normalise(merchant);

  // 1. Seen this exact merchant before — the strongest evidence there is.
  const seen = model.byMerchant.get(key);
  if (seen) {
    const { category, count, total } = mostCommon(seen);
    return {
      category,
      confidence: Math.min(0.98, 0.7 + (count / Math.max(total, 1)) * 0.28),
      reason: `You have put ${merchant} in ${category} ${count} ${count === 1 ? 'time' : 'times'} before.`,
    };
  }

  // 2. Score every category by the words in the name, learned from history.
  const scores = new Map<TransactionCategory, number>();
  ALL_CATEGORIES.forEach((c) => scores.set(c, 0));

  let learnedEvidence = 0;
  for (const word of words(merchant)) {
    const counts = model.byWord.get(word);
    if (!counts) continue;
    counts.forEach((count, category) => {
      bump(scores, category, count);
      learnedEvidence += count;
    });
  }

  if (learnedEvidence >= 2) {
    const { category, count, total } = mostCommon(scores);
    const share = count / Math.max(total, 1);
    return {
      category,
      confidence: Math.min(0.85, 0.45 + share * 0.4),
      reason: `Names like "${merchant}" have been ${category} in your history.`,
    };
  }

  // 3. Nothing learned yet — fall back to the starter list.
  for (const [pattern, category] of STARTER_WORDS) {
    if (pattern.test(merchant)) {
      return {
        category,
        confidence: 0.6,
        reason: `"${merchant}" looks like a ${category} payment.`,
      };
    }
  }

  return {
    category: 'other',
    confidence: 0.2,
    reason: 'We could not tell what this was for — tap to set it.',
  };
}

/**
 * Categorise a batch, letting each answer inform the next.
 *
 * If the user confirms the first Swiggy charge in an uploaded statement, the
 * remaining forty rows in the same file should not each be a fresh guess.
 */
export function categoriseBatch(
  model: CategoryModel,
  merchants: string[],
): Categorisation[] {
  const working: CategoryModel = {
    byMerchant: new Map(model.byMerchant),
    byWord: new Map(model.byWord),
    categoryTotals: new Map(model.categoryTotals),
    transactionsLearnedFrom: model.transactionsLearnedFrom,
  };

  return merchants.map((merchant) => {
    const result = categorise(working, merchant);
    if (result.confidence >= 0.6) {
      const key = normalise(merchant);
      if (!working.byMerchant.has(key)) working.byMerchant.set(key, new Map());
      bump(working.byMerchant.get(key)!, result.category);
    }
    return result;
  });
}
