/**
 * mockData.ts
 *
 * A fake but realistic bank statement for one person over the last 90 days.
 *
 * It is GENERATED rather than typed out, for two reasons:
 *   1. Dates stay relative to today, so the demo never looks stale.
 *   2. We deliberately plant the exact situations CashCue is built to catch,
 *      so every alert fires during the demo instead of you hoping one does.
 *
 * Planted stories (each one triggers a specific alert):
 *   - Netflix quietly went from Rs 199 to Rs 299 this month  -> price increase
 *   - The August electricity bill is Rs 3,400 vs a usual Rs 1,250 -> unusual bill
 *   - Food delivery spending roughly tripled in the last week -> spending spike
 *   - Rent + Netflix + Jio + electricity + internet all charge within 5 days
 *     of the salary landing -> autopay cluster
 *   - The balance is low enough that money runs out just before payday -> shortfall
 */

import { Category, Direction, Transaction } from '../types';

/** A transaction before we know the running balance. */
interface RawTransaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: Direction;
  category: Category;
}

/* ------------------------------------------------------------------ */
/* Small date helpers. We store dates as 'YYYY-MM-DD' strings because  */
/* they sort correctly as plain text and carry no timezone surprises.  */
/* ------------------------------------------------------------------ */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Date object -> 'YYYY-MM-DD', using local time (not UTC, which shifts the day). */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date object. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Whole days between two 'YYYY-MM-DD' dates. Positive when `b` is later. */
export function daysBetween(a: string, b: string): number {
  const ms = fromKey(b).getTime() - fromKey(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * A seeded random number generator (mulberry32).
 *
 * Math.random() would give you a different statement every time the app
 * reloads, which makes bugs impossible to reproduce and demos impossible to
 * rehearse. Same seed in, same numbers out, every single time.
 */
function makeRandom(seed: number): () => number {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every date in the window that falls on `dayOfMonth`, oldest first. */
function monthlyDates(start: Date, end: Date, dayOfMonth: number): string[] {
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
    if (candidate >= start && candidate <= end) out.push(toKey(candidate));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The generator                                                       */
/* ------------------------------------------------------------------ */

const HISTORY_DAYS = 90;
/** Where the account ends up today. Deliberately tight, to create real urgency. */
const CLOSING_BALANCE = 1900;

function buildRawTransactions(today: Date): RawTransaction[] {
  const start = addDays(today, -HISTORY_DAYS);
  const random = makeRandom(20260829);
  const rows: RawTransaction[] = [];

  const push = (
    date: string,
    merchant: string,
    description: string,
    amount: number,
    direction: Direction,
    category: Category,
  ) => {
    rows.push({ date, merchant, description, amount: Math.round(amount), direction, category });
  };

  /* --- Fixed monthly items ------------------------------------------ */

  // Salary lands on the 1st.
  monthlyDates(start, today, 1).forEach((date) => {
    push(date, 'Acme Tech', 'SALARY CREDIT ACME TECH PVT LTD', 52000, 'credit', 'income');
  });

  // Netflix on the 2nd. The most recent charge is the price increase.
  const netflix = monthlyDates(start, today, 2);
  netflix.forEach((date, i) => {
    const isLatest = i === netflix.length - 1;
    push(date, 'Netflix', 'NETFLIX.COM SUBSCRIPTION', isLatest ? 299 : 199, 'debit', 'subscriptions');
  });

  // Rent on the 3rd — the single biggest outgoing.
  monthlyDates(start, today, 3).forEach((date) => {
    push(date, 'Rent', 'IMPS RENT PAYMENT', 15000, 'debit', 'rent');
  });

  // Phone on the 4th.
  monthlyDates(start, today, 4).forEach((date) => {
    push(date, 'Jio', 'JIO PREPAID RECHARGE', 399, 'debit', 'bills');
  });

  // Electricity on the 5th — the latest one is the summer spike.
  const power = monthlyDates(start, today, 5);
  const powerAmounts = [1150, 1300, 3400];
  power.forEach((date, i) => {
    // Line the amounts up with the END of the list, so the spike is always latest.
    const offset = powerAmounts.length - power.length;
    const amount = powerAmounts[i + offset] ?? 1250;
    push(date, 'TNEB', 'TNEB ELECTRICITY BILL AUTOPAY', amount, 'debit', 'bills');
  });

  // Broadband on the 6th.
  monthlyDates(start, today, 6).forEach((date) => {
    push(date, 'ACT Fibernet', 'ACT BROADBAND AUTOPAY', 799, 'debit', 'bills');
  });

  // Spotify on the 8th.
  monthlyDates(start, today, 8).forEach((date) => {
    push(date, 'Spotify', 'SPOTIFY INDIA SUBSCRIPTION', 119, 'debit', 'subscriptions');
  });

  /* --- Day-to-day spending ------------------------------------------ */

  const foodMerchants = ['Swiggy', 'Zomato', 'Blinkit'];
  const rideMerchants = ['Uber', 'Rapido'];
  const shopMerchants = ['Amazon', 'Myntra'];

  for (let i = 0; i <= HISTORY_DAYS; i++) {
    const day = addDays(start, i);
    const date = toKey(day);
    const daysAgo = daysBetween(date, toKey(today));
    const inSpike = daysAgo <= 7; // the planted "bad week"

    // Food delivery: occasional normally, near-daily during the spike week.
    const foodChance = inSpike ? 0.9 : 0.32;
    if (random() < foodChance) {
      const merchant = foodMerchants[Math.floor(random() * foodMerchants.length)];
      const base = inSpike ? 420 + random() * 380 : 210 + random() * 250;
      push(date, merchant, `${merchant.toUpperCase()} ORDER`, base, 'debit', 'food');
    }
    // A second order on some spike days — this is what makes the week stand out.
    if (inSpike && random() < 0.55) {
      const merchant = foodMerchants[Math.floor(random() * foodMerchants.length)];
      push(date, merchant, `${merchant.toUpperCase()} ORDER`, 260 + random() * 300, 'debit', 'food');
    }

    // Weekly grocery run on Saturdays.
    if (day.getDay() === 6) {
      push(date, 'BigBasket', 'BIGBASKET GROCERIES', 1400 + random() * 700, 'debit', 'food');
    }

    // Rides.
    if (random() < 0.38) {
      const merchant = rideMerchants[Math.floor(random() * rideMerchants.length)];
      push(date, merchant, `${merchant.toUpperCase()} TRIP`, 90 + random() * 230, 'debit', 'transport');
    }

    // Occasional shopping.
    if (random() < 0.07) {
      const merchant = shopMerchants[Math.floor(random() * shopMerchants.length)];
      push(date, merchant, `${merchant.toUpperCase()} PURCHASE`, 600 + random() * 2600, 'debit', 'shopping');
    }
  }

  return rows;
}

/**
 * Turn the raw rows into real Transactions: sorted oldest-first, each one
 * carrying the account balance after it cleared.
 *
 * We work the opening balance out backwards from the closing balance we want,
 * so the story always ends where the demo needs it to.
 */
function withBalances(rows: RawTransaction[]): Transaction[] {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const net = sorted.reduce(
    (sum, t) => sum + (t.direction === 'credit' ? t.amount : -t.amount),
    0,
  );
  let balance = CLOSING_BALANCE - net; // opening balance

  return sorted.map((t, i) => {
    balance += t.direction === 'credit' ? t.amount : -t.amount;
    return {
      id: `tx_${i}_${t.date}`,
      date: t.date,
      description: t.description,
      merchant: t.merchant,
      amount: t.amount,
      direction: t.direction,
      category: t.category,
      balanceAfter: Math.round(balance),
    };
  });
}

/** The demo statement. Generated once when the app starts. */
export function generateMockTransactions(today: Date = new Date()): Transaction[] {
  return withBalances(buildRawTransactions(today));
}
