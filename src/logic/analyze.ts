/**
 * analyze.ts
 *
 * One call that runs the whole pipeline, so screens stay dumb:
 *
 *   transactions -> recurring payments -> runway -> alerts
 *
 * If a screen ever needs data, it calls this. It never reaches into the
 * data folder or the logic files directly.
 */

import { Alert, RecurringPayment, Runway, Transaction } from '../types';
import { getTransactions } from '../data/source';
import { toKey } from '../data/mockData';
import { detectRecurring, upcomingBefore } from './recurring';
import { calculateRunway } from './runway';
import { generateAlerts } from './alerts';

export interface Analysis {
  today: string;
  transactions: Transaction[];
  recurring: RecurringPayment[];
  upcoming: RecurringPayment[];
  runway: Runway;
  alerts: Alert[];
}

export function analyze(today: string = toKey(new Date())): Analysis {
  const transactions = getTransactions();
  const recurring = detectRecurring(transactions);
  const runway = calculateRunway(transactions, recurring, today);
  const alerts = generateAlerts(transactions, recurring, runway, today);

  // Everything charging in the next fortnight — the "what's coming" list.
  const upcoming = upcomingBefore(
    recurring,
    today,
    `${today.slice(0, 4)}-12-31`,
  ).slice(0, 6);

  return { today, transactions, recurring, upcoming, runway, alerts };
}
