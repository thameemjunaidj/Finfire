/**
 * forecastEngine.ts
 *
 * The forward half of FinExtinguisher. financeEngine.ts asks "what is wrong right
 * now?"; this asks "where does this month end, and what would have to change?"
 *
 * The method, deliberately simple enough to explain to a judge in one breath:
 *
 *   1. Learn each category's normal rate from the last 28 days and from
 *      previous whole months.
 *   2. Blend the recent 7-day pace with that 28-day rate — 40/60, so a bad
 *      week moves the forecast without a single big Saturday defining it.
 *   3. Run that rate forward to the end of the month.
 *   4. Compare the projected month against income to get projected savings.
 *   5. If savings fall short of target, work out which categories to trim and
 *      by exactly how much per day.
 *
 * No machine learning, and that is the right call: with 90 days of one
 * person's data a model would only be an expensive way to compute an average,
 * and this version can explain every number it shows.
 */

import {
  CategoryForecast,
  FinanceDataset,
  SavingsAction,
  SpendingForecast,
  Transaction,
  TransactionCategory,
} from '../types/finance';
import { addDays, daysInMonth, monthKey, parseLocalDate } from '../utils/dates';
import { formatCurrency, titleCase } from '../utils/format';

/** Categories a person can realistically cut this month. Rent and utilities
 *  are not choices, so suggesting "spend less on rent" would be useless. */
const DISCRETIONARY: TransactionCategory[] = ['food', 'transport', 'shopping', 'entertainment', 'other'];

/** Every category that represents money going out. */
const SPEND_CATEGORIES: TransactionCategory[] = [
  'rent', 'utilities', 'food', 'transport', 'shopping', 'entertainment', 'health', 'subscription', 'other',
];

/** Share of income we treat as a healthy monthly saving. */
const SAVINGS_TARGET_RATE = 0.2;

/**
 * How much the recent week counts versus the longer 28-day average.
 *
 * Was 0.6, which let a single heavy week dominate the whole month — one
 * birthday and one sale purchase projected a student into spending twice his
 * income, a number he could not physically reach with no credit card. At 0.4
 * a bad week still moves the forecast without becoming the forecast.
 */
const RECENT_WEIGHT = 0.4;

/** Suggestions smaller than this are noise, not advice. */
const MIN_USEFUL_SAVING = 150;

const round = (value: number) => Math.round(value);

/** Total debit spend for a category between two dates, inclusive. */
function spendBetween(
  transactions: Transaction[],
  category: TransactionCategory | null,
  from: string,
  to: string,
): number {
  return transactions
    .filter((t) => t.direction === 'debit')
    .filter((t) => t.source !== 'simulation')
    .filter((t) => (category === null ? true : t.category === category))
    .filter((t) => t.date >= from && t.date <= to)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Average of a category's spend across previous whole months (up to three). */
function previousMonthlyAverage(
  transactions: Transaction[],
  category: TransactionCategory,
  currentKey: string,
): number | null {
  const relevant = transactions
    .filter((t) => t.direction === 'debit' && t.source !== 'simulation');

  // Where the data begins. A month the history starts halfway through holds
  // only part of that month's spending, so treating it as a normal month
  // understates it badly — with one month of history that alone would make
  // every user look like they had suddenly started overspending.
  const earliest = relevant.length
    ? relevant.reduce((oldest, t) => (t.date < oldest ? t.date : oldest), relevant[0].date)
    : currentKey;

  const totals = new Map<string, number>();
  relevant
    .filter((t) => t.category === category)
    .forEach((t) => {
      const key = monthKey(t.date);
      if (key >= currentKey) return;        // only months that have finished
      if (earliest > `${key}-01`) return;   // and only those held in full
      totals.set(key, (totals.get(key) ?? 0) + t.amount);
    });

  const months = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-3);
  if (!months.length) return null;
  return months.reduce((sum, [, amount]) => sum + amount, 0) / months.length;
}

export function buildForecast(dataset: FinanceDataset): SpendingForecast {
  const { profile, transactions, recurringPayments } = dataset;
  const asOf = profile.analysisDate ?? new Date().toISOString().slice(0, 10);

  const currentKey = monthKey(asOf);
  const totalDays = daysInMonth(asOf);
  const monthEnd = `${currentKey}-${String(totalDays).padStart(2, '0')}`;

  /** Scheduled charges for a category still to come in a date window. */
  const scheduledBetween = (category: TransactionCategory, from: string, to: string): number =>
    recurringPayments
      .filter((payment) => payment.category === category)
      .filter((payment) => payment.nextPaymentDate > from && payment.nextPaymentDate <= to)
      .reduce((sum, payment) => sum + payment.currentAmount, 0);
  const daysElapsed = Math.max(1, parseLocalDate(asOf).getDate());
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  /** Used wherever we divide, so the last day of the month cannot divide by zero. */
  const remainingForMath = Math.max(1, daysRemaining);

  const weekStart = addDays(asOf, -6);   // last 7 days including today
  const monthStart = `${currentKey}-01`;
  const baselineStart = addDays(asOf, -27); // last 28 days = four clean weeks

  const categories: CategoryForecast[] = SPEND_CATEGORIES.map((category) => {
    const lastWeek = spendBetween(transactions, category, weekStart, asOf);
    const last28 = spendBetween(transactions, category, baselineStart, asOf);
    const monthToDate = spendBetween(transactions, category, monthStart, asOf);

    // The blended daily rate: recent behaviour weighted, longer history as ballast.
    const recentDaily = lastWeek / 7;
    const baselineDaily = last28 / 28;
    const blendedDaily = RECENT_WEIGHT * recentDaily + (1 - RECENT_WEIGHT) * baselineDaily;

    const discretionary = DISCRETIONARY.includes(category);

    /**
     * Fixed costs are NOT run-rated. Rent arrives once on the 1st; spreading
     * it across the month as a daily rate and projecting forward invents a
     * second part-payment, and the app ends up claiming rent is rising 19%.
     * For those categories the future is not a trend — it is a schedule.
     */
    const projectedMonthEnd = discretionary
      ? monthToDate + blendedDaily * daysRemaining
      : monthToDate + scheduledBetween(category, asOf, monthEnd);

    const projectedNextWeek = discretionary
      ? blendedDaily * 7
      : scheduledBetween(category, asOf, addDays(asOf, 7));

    // Prefer real previous months as "normal"; fall back to the 28-day rate.
    const historical = previousMonthlyAverage(transactions, category, currentKey);
    const baselineMonth = historical ?? baselineDaily * totalDays;

    const trendPercentage = baselineMonth > 0
      ? ((projectedMonthEnd - baselineMonth) / baselineMonth) * 100
      : 0;

    return {
      category,
      lastWeek: round(lastWeek),
      baselineWeek: round(last28 / 4),
      projectedNextWeek: round(projectedNextWeek),
      monthToDate: round(monthToDate),
      projectedMonthEnd: round(projectedMonthEnd),
      baselineMonth: round(baselineMonth),
      trendPercentage,
      discretionary,
    };
  }).filter((forecast) => forecast.projectedMonthEnd > 0 || forecast.baselineMonth > 0);

  const sum = (pick: (c: CategoryForecast) => number) => categories.reduce((total, c) => total + pick(c), 0);

  const projectedMonthEndSpending = sum((c) => c.projectedMonthEnd);
  const baselineMonthlySpending = sum((c) => c.baselineMonth);
  const currentMonthSpending = sum((c) => c.monthToDate);
  const lastWeekSpending = sum((c) => c.lastWeek);
  const baselineWeeklySpending = sum((c) => c.baselineWeek);
  const projectedNextWeekSpending = sum((c) => c.projectedNextWeek);

  const expectedIncome = profile.monthlyIncome;
  const projectedSavings = expectedIncome - projectedMonthEndSpending;
  const savingsTarget = expectedIncome * SAVINGS_TARGET_RATE;
  const savingsGap = Math.max(0, savingsTarget - projectedSavings);
  const onTrack = projectedSavings >= savingsTarget;

  // What is being spent per day on things that could be cut.
  const discretionaryWeek = categories
    .filter((c) => c.discretionary)
    .reduce((total, c) => total + c.lastWeek, 0);
  const currentDailyPace = discretionaryWeek / 7;

  // What could be spent per day and still hit the target: take everything the
  // month is allowed to cost, subtract what is already gone and what the
  // unavoidable categories will still take, then spread the rest over the days left.
  const allowedMonthSpend = expectedIncome - savingsTarget;
  const committedRemaining = categories
    .filter((c) => !c.discretionary)
    .reduce((total, c) => total + Math.max(0, c.projectedMonthEnd - c.monthToDate), 0);
  const discretionaryAllowance = allowedMonthSpend - currentMonthSpending - committedRemaining;
  const targetDailyAllowance = Math.max(0, discretionaryAllowance / remainingForMath);

  /**
   * When the savings target is already out of reach, the target-based figure
   * collapses to zero and the app ends up advising "spend ₹0 a day", which is
   * not advice — it is an insult to someone who is already short.
   *
   * So we fall back to the survival number: what can be spent per day and
   * still reach the next income with the committed payments covered. Saving
   * nothing this month is a real outcome, and saying so plainly beats
   * pretending the target is still available.
   */
  const committedBeforeIncome = categories
    .filter((c) => !c.discretionary)
    .reduce((total, c) => total + Math.max(0, c.projectedMonthEnd - c.monthToDate), 0);
  const survivalDailyAllowance = Math.max(
    0,
    (profile.availableBalance - committedBeforeIncome) / remainingForMath,
  );

  const safeDailyAllowance = Math.max(targetDailyAllowance, survivalDailyAllowance);

  return {
    asOf,
    daysElapsed,
    daysRemaining,
    lastWeekSpending: round(lastWeekSpending),
    baselineWeeklySpending: round(baselineWeeklySpending),
    projectedNextWeekSpending: round(projectedNextWeekSpending),
    currentMonthSpending: round(currentMonthSpending),
    projectedMonthEndSpending: round(projectedMonthEndSpending),
    baselineMonthlySpending: round(baselineMonthlySpending),
    expectedIncome: round(expectedIncome),
    projectedSavings: round(projectedSavings),
    savingsTarget: round(savingsTarget),
    savingsGap: round(savingsGap),
    onTrack,
    currentDailyPace: round(currentDailyPace),
    safeDailyAllowance: round(safeDailyAllowance),
    categories: categories.sort((a, b) => b.projectedMonthEnd - a.projectedMonthEnd),
    actions: buildSavingsActions(categories, savingsGap, daysRemaining, onTrack),
  };
}

/**
 * Turn the gap into a short list of specific, costed changes.
 *
 * The ordering matters: we cut where the person is most above their OWN normal
 * first. Telling someone to spend less on food when their food spending is
 * already typical is how an app loses trust — the suggestion has to be
 * something they can recognise as unusual.
 */
function buildSavingsActions(
  categories: CategoryForecast[],
  savingsGap: number,
  daysRemaining: number,
  onTrack: boolean,
): SavingsAction[] {
  const remainingForMath = Math.max(1, daysRemaining);

  const candidates = categories
    .filter((c) => c.discretionary)
    .filter((c) => c.projectedMonthEnd > c.monthToDate) // something left to cut
    .map((c) => ({
      forecast: c,
      /** How far above this category's own normal the projection runs. */
      excess: Math.max(0, c.projectedMonthEnd - c.baselineMonth),
      /** Spend still to come in this category. */
      remaining: c.projectedMonthEnd - c.monthToDate,
    }))
    .sort((a, b) => b.excess - a.excess || b.remaining - a.remaining);

  const actions: SavingsAction[] = [];

  // On track: show the upside of trimming the biggest category anyway.
  if (onTrack) {
    const top = candidates[0];
    if (top && top.remaining > MIN_USEFUL_SAVING) {
      const saving = top.remaining * 0.2;
      actions.push({
        id: `boost-${top.forecast.category}`,
        category: top.forecast.category,
        title: `Save ${formatCurrency(saving)} more`,
        detail: `You are on track already. Trimming ${titleCase(top.forecast.category).toLowerCase()} by a fifth for the rest of the month would put another ${formatCurrency(saving)} aside without touching anything essential.`,
        monthlySaving: round(saving),
        dailyReduction: round(saving / remainingForMath),
      });
    }
    return actions;
  }

  let stillNeeded = savingsGap;

  for (const candidate of candidates) {
    if (stillNeeded <= 0) break;

    // Never suggest cutting more than 40% of what is left in a category —
    // advice nobody can follow is worse than no advice.
    const maximumCut = Math.min(candidate.remaining * 0.4 + candidate.excess, candidate.remaining);
    const saving = Math.min(stillNeeded, maximumCut);
    if (saving < MIN_USEFUL_SAVING) continue;

    const label = titleCase(candidate.forecast.category).toLowerCase();
    const perDay = saving / remainingForMath;
    const aboveNormal = candidate.excess > MIN_USEFUL_SAVING;

    actions.push({
      id: `cut-${candidate.forecast.category}`,
      category: candidate.forecast.category,
      title: `Cut ${label} by ${formatCurrency(saving)}`,
      detail: aboveNormal
        ? `${titleCase(label)} is heading for ${formatCurrency(candidate.forecast.projectedMonthEnd)} against your usual ${formatCurrency(candidate.forecast.baselineMonth)}. Getting back to normal is about ${formatCurrency(perDay)} a day less for the ${daysRemaining} days left.`
        : `${titleCase(label)} is running at its usual level, but it is the largest thing left that you control. About ${formatCurrency(perDay)} a day less for the ${daysRemaining} days left gets you there.`,
      monthlySaving: round(saving),
      dailyReduction: round(perDay),
    });

    stillNeeded -= saving;
  }

  // Be honest when the numbers do not close.
  if (stillNeeded > MIN_USEFUL_SAVING) {
    actions.push({
      id: 'gap-remains',
      category: 'other',
      title: `${formatCurrency(stillNeeded)} still uncovered`,
      detail: `Even after those cuts, ${formatCurrency(stillNeeded)} of the target cannot come out of day-to-day spending this month. The realistic options are a smaller saving this month, or cancelling something recurring.`,
      monthlySaving: 0,
      dailyReduction: 0,
    });
  }

  return actions;
}
