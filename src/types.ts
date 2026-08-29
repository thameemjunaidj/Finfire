/**
 * types.ts
 *
 * Every screen and every piece of logic in CashCue speaks these shapes.
 * Nothing here knows where the data came from — a mock file today,
 * a CSV the judge uploads in Review 2. That is the whole point.
 */

/** What kind of spending a transaction is. Used to separate "must pay" from "chose to pay". */
export type Category =
  | 'income'        // salary, refunds, money coming in
  | 'rent'          // rent / EMI — unavoidable
  | 'bills'         // electricity, phone, internet — unavoidable
  | 'subscriptions' // Netflix, Spotify — recurring but cancellable
  | 'food'          // Swiggy, Zomato, groceries
  | 'transport'     // Uber, fuel, metro
  | 'shopping'      // Amazon, Myntra
  | 'other';

/** Money in or money out. */
export type Direction = 'credit' | 'debit';

/**
 * One line on a bank statement.
 * `amount` is ALWAYS positive — `direction` says which way it moved.
 * Mixing sign and direction is how finance apps end up with bugs you
 * only notice on stage, so we keep them separate.
 */
export interface Transaction {
  id: string;
  date: string;          // 'YYYY-MM-DD' — sortable as plain text, no timezone traps
  description: string;   // what the bank prints, e.g. 'NETFLIX SUBSCRIPTION'
  merchant: string;      // cleaned-up name, e.g. 'Netflix'
  amount: number;        // rupees, always positive
  direction: Direction;
  category: Category;
  balanceAfter: number;  // account balance after this transaction cleared
}

/**
 * A payment that repeats — a subscription, a bill, an EMI, or a salary.
 * We detect these rather than being told about them, because an uploaded
 * CSV will never come with a "this is a subscription" column.
 */
export interface RecurringPayment {
  merchant: string;
  category: Category;
  direction: Direction;
  /** Roughly how many days between charges (30 for monthly, 7 for weekly). */
  intervalDays: number;
  /** The most recent amount charged. */
  lastAmount: number;
  /** The amount before that — lets us spot a price increase. */
  previousAmount: number | null;
  /** Typical amount across all occurrences, used to judge "unusually large". */
  medianAmount: number;
  lastDate: string;
  /** Our best guess at the next charge date, 'YYYY-MM-DD'. */
  nextDate: string;
  occurrences: number;
}

/** How loudly the app should shout about an alert. */
export type Severity = 'critical' | 'warning' | 'info';

/**
 * An alert always answers three questions, because "you spent a lot" is
 * useless advice. This is the core of what makes CashCue an early-warning
 * app rather than another spending chart.
 */
export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  what: string;   // what happened
  why: string;    // why it matters to this person right now
  action: string; // what they can do about it
  /** Rupee impact, when there is a number worth showing. */
  amount?: number;
  /** Transactions that triggered this, so the UI can show receipts. */
  evidence: Transaction[];
}

/**
 * The "will I make it to payday" calculation — the headline number.
 */
export interface Runway {
  balance: number;
  /** Next expected salary date, 'YYYY-MM-DD'. */
  nextPayday: string | null;
  daysUntilPayday: number | null;
  /** Bills and subscriptions we expect to be charged before payday. */
  committed: number;
  /** balance minus committed — what is genuinely free to spend. */
  disposable: number;
  /** Average discretionary spend per day, from recent history. */
  averageDailySpend: number;
  /** How many days the disposable money lasts at that rate. */
  runwayDays: number;
  /** What they can spend per day and still reach payday with zero. */
  safeDailyLimit: number;
  /** True when the money runs out before the salary lands. */
  shortfall: boolean;
}
