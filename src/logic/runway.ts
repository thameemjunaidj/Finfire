/**
 * runway.ts
 *
 * The headline question CashCue answers: will the money last until payday,
 * and what can be spent per day without it running out?
 *
 * The insight the app is built on is that a raw balance lies. Rs 2,400 in the
 * account looks survivable until you notice rent leaves on the 3rd. So we
 * subtract what is already spoken for BEFORE deciding what is spendable.
 */

import { RecurringPayment, Runway, Transaction } from '../types';
import { daysBetween, toKey } from '../data/mockData';

/** Spending the person actually chooses day to day. Rent and bills are not
 *  choices, so including them would make the daily limit meaningless. */
const DISCRETIONARY = new Set(['food', 'transport', 'shopping', 'other']);

/** Outgoings the person cannot simply decide not to pay this month. */
const COMMITTED_CATEGORIES = new Set(['rent', 'bills', 'subscriptions']);

/** How far back we look to learn someone's normal spending rate. */
const LOOKBACK_DAYS = 30;

export function calculateRunway(
  transactions: Transaction[],
  recurring: RecurringPayment[],
  today: string = toKey(new Date()),
): Runway {
  // The balance is simply whatever the most recent transaction left behind.
  const latest = transactions.length > 0 ? transactions[transactions.length - 1] : null;
  const balance = latest ? latest.balanceAfter : 0;

  // When does money next come in? Salary is just a recurring credit.
  const incomes = recurring
    .filter((r) => r.direction === 'credit')
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
  const nextPayday = incomes.length > 0 ? incomes[0].nextDate : null;
  const daysUntilPayday = nextPayday ? Math.max(daysBetween(today, nextPayday), 0) : null;

  // What is already committed before that salary lands. Only unavoidable
  // outgoings count — a weekly grocery run is predictable but it is a choice,
  // and treating it as committed would double-count it against daily spending.
  const committed = recurring
    .filter((r) => r.direction === 'debit')
    .filter((r) => COMMITTED_CATEGORIES.has(r.category))
    .filter((r) => r.nextDate >= today && (nextPayday === null || r.nextDate <= nextPayday))
    .reduce((sum, r) => sum + r.lastAmount, 0);

  const disposable = balance - committed;

  // Learn the normal daily burn from the last 30 days of discretionary spend.
  const recent = transactions.filter(
    (t) =>
      t.direction === 'debit' &&
      DISCRETIONARY.has(t.category) &&
      t.date <= today &&
      daysBetween(t.date, today) <= LOOKBACK_DAYS,
  );
  const spent = recent.reduce((sum, t) => sum + t.amount, 0);
  const averageDailySpend = spent / LOOKBACK_DAYS;

  // How long the free money lasts at that rate.
  const runwayDays = averageDailySpend > 0 ? disposable / averageDailySpend : Infinity;

  // What they could spend per day and still coast in to payday at zero.
  const safeDailyLimit =
    daysUntilPayday && daysUntilPayday > 0 ? Math.max(disposable / daysUntilPayday, 0) : disposable;

  const shortfall =
    daysUntilPayday !== null && (disposable < 0 || runwayDays < daysUntilPayday);

  return {
    balance,
    nextPayday,
    daysUntilPayday,
    committed,
    disposable,
    averageDailySpend,
    runwayDays: Number.isFinite(runwayDays) ? Math.max(runwayDays, 0) : 999,
    safeDailyLimit,
    shortfall,
  };
}
