/**
 * alerts.ts
 *
 * This is CashCue's actual product. Everything else feeds this file.
 *
 * The rule every alert follows: say WHAT happened, WHY it matters to this
 * person right now, and WHAT to do about it. "You spent Rs 4,200 on food"
 * is a chart. "Food is up 3x this week and it costs you 4 days of runway,
 * cook twice this week to get back on track" is an early warning.
 */

import { Alert, RecurringPayment, Runway, Severity, Transaction } from '../types';
import { addDays, daysBetween, fromKey, toKey } from '../data/mockData';
import { median } from './recurring';
import { formatRupees, formatShortDate, formatWhen } from './format';

const DISCRETIONARY = new Set(['food', 'transport', 'shopping', 'other']);

/* ------------------------------------------------------------------ */
/* 1. A subscription quietly went up in price                          */
/* ------------------------------------------------------------------ */

function priceIncreaseAlerts(recurring: RecurringPayment[]): Alert[] {
  const alerts: Alert[] = [];

  for (const r of recurring) {
    if (r.direction !== 'debit') continue;
    if (r.category !== 'subscriptions') continue;
    if (r.previousAmount === null) continue;

    const rise = r.lastAmount - r.previousAmount;
    // Ignore rounding noise — we only care about a real increase.
    if (rise < 20 || r.lastAmount < r.previousAmount * 1.1) continue;

    const percent = Math.round((rise / r.previousAmount) * 100);
    const perYear = rise * (365 / r.intervalDays);

    alerts.push({
      id: `price_${r.merchant}`,
      severity: 'warning',
      title: `${r.merchant} costs ${formatRupees(rise)} more`,
      what: `${r.merchant} charged ${formatRupees(r.lastAmount)} on ${formatShortDate(
        r.lastDate,
      )}, up from ${formatRupees(r.previousAmount)} — a ${percent}% increase.`,
      why: `Price rises on subscriptions are easy to miss because the payment goes out on its own. Left alone this one costs you an extra ${formatRupees(
        perYear,
      )} over a year.`,
      action: `Check whether a cheaper plan covers what you actually use, or cancel before the next charge on ${formatShortDate(
        r.nextDate,
      )}.`,
      amount: rise,
      evidence: [],
    });
  }

  return alerts;
}

/* ------------------------------------------------------------------ */
/* 2. A bill came in much larger than usual                            */
/* ------------------------------------------------------------------ */

function unusualBillAlerts(recurring: RecurringPayment[], runway: Runway): Alert[] {
  const alerts: Alert[] = [];

  for (const r of recurring) {
    if (r.direction !== 'debit') continue;
    if (r.category !== 'bills' && r.category !== 'rent') continue;
    if (r.occurrences < 2) continue;
    if (r.lastAmount <= r.medianAmount * 1.5) continue;

    const extra = r.lastAmount - r.medianAmount;
    const times = (r.lastAmount / r.medianAmount).toFixed(1);
    const daysOfRunway =
      runway.averageDailySpend > 0 ? Math.round(extra / runway.averageDailySpend) : 0;

    alerts.push({
      id: `bill_${r.merchant}`,
      severity: 'warning',
      title: `${r.merchant} bill is ${times}x your usual`,
      what: `Your ${r.merchant} bill on ${formatShortDate(r.lastDate)} was ${formatRupees(
        r.lastAmount,
      )}. You normally pay about ${formatRupees(r.medianAmount)}.`,
      why: `That is ${formatRupees(extra)} you had not planned for${
        daysOfRunway > 0 ? `, roughly ${daysOfRunway} days of your usual spending` : ''
      }. If it repeats next month it stops being a one-off and becomes your new normal.`,
      action: `Check the bill for a meter error or a changed tariff before the next one on ${formatShortDate(
        r.nextDate,
      )}.`,
      amount: extra,
      evidence: [],
    });
  }

  return alerts;
}

/* ------------------------------------------------------------------ */
/* 3. This week's spending is unusually high                           */
/* ------------------------------------------------------------------ */

function spendingSpikeAlerts(
  transactions: Transaction[],
  runway: Runway,
  today: string,
): Alert[] {
  /** Total discretionary spend in the 7 days ending `weeksAgo` weeks back. */
  const weekTotal = (weeksAgo: number): { total: number; rows: Transaction[] } => {
    const end = toKey(addDays(fromKey(today), -7 * weeksAgo));
    const start = toKey(addDays(fromKey(end), -6));
    const rows = transactions.filter(
      (t) =>
        t.direction === 'debit' &&
        DISCRETIONARY.has(t.category) &&
        t.date >= start &&
        t.date <= end,
    );
    return { total: rows.reduce((s, t) => s + t.amount, 0), rows };
  };

  const thisWeek = weekTotal(0);
  const previousWeeks = [1, 2, 3, 4].map((w) => weekTotal(w).total).filter((t) => t > 0);
  if (previousWeeks.length < 2) return [];

  const normal = median(previousWeeks);
  if (normal <= 0) return [];

  const extra = thisWeek.total - normal;
  if (thisWeek.total < normal * 1.4 || extra < 500) return [];

  // Which category drove it? Naming the cause is what makes this actionable.
  const byCategory = new Map<string, number>();
  for (const t of thisWeek.rows) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  let topCategory = 'spending';
  let topAmount = 0;
  for (const [category, amount] of byCategory) {
    if (amount > topAmount) {
      topAmount = amount;
      topCategory = category;
    }
  }

  const multiple = (thisWeek.total / normal).toFixed(1);
  const daysCost =
    runway.averageDailySpend > 0 ? Math.round(extra / runway.averageDailySpend) : 0;

  return [
    {
      id: 'spike_week',
      severity: 'warning',
      title: `Spending is ${multiple}x your normal week`,
      what: `You have spent ${formatRupees(thisWeek.total)} in the last 7 days, against a usual ${formatRupees(
        normal,
      )}. Most of it is ${topCategory} — ${formatRupees(topAmount)}.`,
      why: `The extra ${formatRupees(extra)} came out of the money meant to reach payday${
        daysCost > 0 ? `, and cost you about ${daysCost} days of runway` : ''
      }.`,
      action: `Bring ${topCategory} back to your normal rate for the rest of the week and you recover most of it.`,
      amount: extra,
      evidence: thisWeek.rows.slice(-5),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 4. Several automatic payments land close together                   */
/* ------------------------------------------------------------------ */

const CLUSTER_WINDOW_DAYS = 5;
const CLUSTER_MIN_PAYMENTS = 3;

/** Only money that leaves on its own counts as an autopay. A weekly grocery
 *  run is predictable too, but nobody gets a penalty for not doing it. */
const AUTOPAY_CATEGORIES = new Set(['bills', 'rent', 'subscriptions']);

function autopayClusterAlerts(
  recurring: RecurringPayment[],
  runway: Runway,
  today: string,
): Alert[] {
  const upcoming = recurring
    .filter((r) => r.direction === 'debit')
    .filter((r) => AUTOPAY_CATEGORIES.has(r.category))
    .filter((r) => r.nextDate >= today && daysBetween(today, r.nextDate) <= 14)
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));

  if (upcoming.length < CLUSTER_MIN_PAYMENTS) return [];

  // Slide a window across the upcoming payments and keep the heaviest cluster.
  let best: RecurringPayment[] = [];
  for (let i = 0; i < upcoming.length; i++) {
    const window = upcoming.filter(
      (r) => daysBetween(upcoming[i].nextDate, r.nextDate) >= 0 &&
             daysBetween(upcoming[i].nextDate, r.nextDate) <= CLUSTER_WINDOW_DAYS,
    );
    const total = window.reduce((s, r) => s + r.lastAmount, 0);
    const bestTotal = best.reduce((s, r) => s + r.lastAmount, 0);
    if (window.length >= CLUSTER_MIN_PAYMENTS && total > bestTotal) best = window;
  }

  if (best.length < CLUSTER_MIN_PAYMENTS) return [];

  const total = best.reduce((s, r) => s + r.lastAmount, 0);
  const first = best[0];
  const last = best[best.length - 1];
  const names = best.map((r) => r.merchant).join(', ');
  const startsIn = daysBetween(today, first.nextDate);

  // Crucially: money coming IN before the cluster counts. Without this the app
  // screams "you cannot afford this" at someone whose salary lands the day
  // before — the fastest way to teach a user to ignore your alerts.
  const incomeFirst = recurring
    .filter((r) => r.direction === 'credit')
    .filter((r) => r.nextDate >= today && r.nextDate <= first.nextDate)
    .reduce((sum, r) => sum + r.lastAmount, 0);

  const availableByThen = runway.balance + incomeFirst;
  const coversIt = availableByThen >= total;
  const shareOfIncome = incomeFirst > 0 ? Math.round((total / incomeFirst) * 100) : 0;

  return [
    {
      id: 'cluster_autopay',
      severity: coversIt ? 'warning' : 'critical',
      title: `${best.length} autopays worth ${formatRupees(total)} land together`,
      what: `${names} all charge between ${formatShortDate(first.nextDate)} and ${formatShortDate(
        last.nextDate,
      )}, starting ${formatWhen(startsIn)}.`,
      why: !coversIt
        ? `You will have ${formatRupees(
            availableByThen,
          )} by then — not enough to cover all of them. Whichever clears last is the one that bounces, and that means a penalty on top.`
        : incomeFirst > 0
          ? `Your salary lands first, so the money is there — but this is ${shareOfIncome}% of it gone within ${
              daysBetween(first.nextDate, last.nextDate) + 1
            } days of arriving, before you have decided anything.`
          : `Your balance covers them, but ${formatRupees(
              total,
            )} leaving this quickly is most of what you have to work with.`,
      action: coversIt
        ? `Set ${formatRupees(total)} aside on ${formatShortDate(
            first.nextDate,
          )} and plan the rest of the month on what is left.`
        : `Move the smaller ones to a later date, or top up by ${formatRupees(
            total - availableByThen,
          )} before ${formatShortDate(first.nextDate)}.`,
      amount: total,
      evidence: [],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 5. The money will not reach payday                                  */
/* ------------------------------------------------------------------ */

function shortfallAlerts(runway: Runway): Alert[] {
  if (!runway.shortfall || runway.daysUntilPayday === null) return [];

  const daysShort = Math.max(Math.round(runway.daysUntilPayday - runway.runwayDays), 1);
  const gap = Math.max(
    Math.round(runway.averageDailySpend * runway.daysUntilPayday - runway.disposable),
    0,
  );

  return [
    {
      id: 'runway_shortfall',
      severity: 'critical',
      title: `You run out ${daysShort} ${daysShort === 1 ? 'day' : 'days'} before payday`,
      what: `After committed payments you have ${formatRupees(
        runway.disposable,
      )} free, and you are spending about ${formatRupees(runway.averageDailySpend)} a day.`,
      why: `At that rate the money is gone with ${daysShort} ${
        daysShort === 1 ? 'day' : 'days'
      } still to go before your salary on ${
        runway.nextPayday ? formatShortDate(runway.nextPayday) : 'payday'
      }. That is the point where people reach for a credit card and the problem rolls into next month.`,
      action: `Hold spending to ${formatRupees(
        runway.safeDailyLimit,
      )} a day and you make it. That is ${formatRupees(gap)} less than your current pace.`,
      amount: gap,
      evidence: [],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Putting it together                                                 */
/* ------------------------------------------------------------------ */

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function generateAlerts(
  transactions: Transaction[],
  recurring: RecurringPayment[],
  runway: Runway,
  today: string = toKey(new Date()),
): Alert[] {
  const all = [
    ...shortfallAlerts(runway),
    ...autopayClusterAlerts(recurring, runway, today),
    ...unusualBillAlerts(recurring, runway),
    ...priceIncreaseAlerts(recurring),
    ...spendingSpikeAlerts(transactions, runway, today),
  ];

  // Most urgent first, and within the same urgency, biggest rupee impact first.
  return all.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });
}
