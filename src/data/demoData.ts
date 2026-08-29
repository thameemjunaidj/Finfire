/**
 * demoData.ts — the demo account.
 *
 * WHO THIS IS
 * Aditya, 19, a day-scholar engineering student. His parents pay the college
 * fees and he eats at home, so the only money that passes through his hands is
 * ₹2,000 of pocket money on the 1st, plus whatever he gets for helping at his
 * uncle's shop some months.
 *
 * That ₹2,000 is the entire point. At student scale the numbers stop being
 * abstract: three subscriptions and one recharge eat a THIRD of his month
 * before he buys a single cup of tea, and a ₹50 Netflix increase is not a
 * rounding error — it is 2.5% of everything he has. Every judge in the room
 * has lived this exact budget, which is why it lands harder than a salary.
 *
 * PRICES (Netflix and Spotify checked August 2026)
 *   Netflix Mobile          ₹149  → Basic ₹199 when the mobile plan went
 *   Spotify Premium Student ₹59
 *   Jio monthly pack        ₹239  → ₹399 (a typical pack, and a typical jump)
 *
 * THE FIVE PLANTED SITUATIONS
 *   1. Netflix ₹149 → ₹199                 → subscription price increase
 *   2. Recharge ₹239 → ₹399 due on the 24th → a bill about to jump
 *   3. A heavy last week                → spending surge
 *   4. ₹657 of charges between 24th–27th    → payments piling up
 *   5. ₹1,300 left with 11 days to go       → short runway, and a better
 *                                             than even chance of running dry
 *
 * Generated from a fixed seed, so the account is identical every run.
 */

import { FinanceDataset, RecurringPayment, Transaction, TransactionCategory } from '../types/finance';

export const DEMO_ANALYSIS_DATE = '2026-08-21';

/**
 * One month of history — what a real new user will actually have on day one.
 *
 * Three months made a nicer demo and a dishonest one: it showed the app in a
 * state almost no first-time user is in. Thirty days is the harder case and
 * the true one.
 *
 * The consequence, stated plainly because it shapes what the app can claim:
 * a monthly subscription only appears ONCE in thirty days, and one charge is
 * not a pattern. So the automatic detector cannot infer monthly items from a
 * single month — it needs two occurrences to measure a gap. Weekly habits it
 * still finds easily. The three monthly payments below are therefore declared,
 * which is exactly what a real user does during onboarding, and detection
 * takes over from the second month onwards.
 */
const HISTORY_DAYS = 30;

const categoryEssentials: Partial<Record<TransactionCategory, boolean>> = {
  utilities: true,
  health: true,
};

/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function key(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function shift(value: string, days: number): string {
  const date = parse(value);
  date.setDate(date.getDate() + days);
  return key(date);
}

function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthlyDates(start: string, end: string, dayOfMonth: number): string[] {
  const output: string[] = [];
  const cursor = parse(start);
  cursor.setDate(1);
  const last = parse(end);
  while (cursor <= last) {
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dayOfMonth, 12);
    const candidateKey = key(candidate);
    if (candidateKey >= start && candidateKey <= end) output.push(candidateKey);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return output;
}

/* ---------------------------------------------------------------- */
/* Building the statement                                            */
/* ---------------------------------------------------------------- */

const START = shift(DEMO_ANALYSIS_DATE, -HISTORY_DAYS);
const random = makeRandom(20260821);
const rows: Transaction[] = [];
let counter = 0;

function add(
  date: string,
  merchant: string,
  amount: number,
  category: TransactionCategory,
  direction: 'debit' | 'credit' = 'debit',
): void {
  counter += 1;
  rows.push({
    id: `demo-${counter}`,
    date,
    merchant,
    amount: Math.round(amount),
    direction,
    category,
    essential: categoryEssentials[category] ?? false,
    source: 'demo',
  });
}

/* --- Money coming in ---------------------------------------------- */

// Pocket money on the 1st. This is the whole budget.
monthlyDates(START, DEMO_ANALYSIS_DATE, 1).forEach((date) => {
  add(date, 'Pocket Money', 2000, 'income', 'credit');
});

// Helping at his uncle's shop — some months, not all. Uneven income is
// exactly why a single averaged prediction would be misleading here.
const sideIncome = [400, 0, 600];
monthlyDates(START, DEMO_ANALYSIS_DATE, 17).forEach((date, index) => {
  const amount = sideIncome[index % sideIncome.length];
  if (amount > 0) add(date, 'Shop Help', amount, 'income', 'credit');
});

/* --- Fixed monthly outgoings -------------------------------------- */

// Phone recharge on the 24th.
monthlyDates(START, DEMO_ANALYSIS_DATE, 24).forEach((date) => {
  add(date, 'Jio Recharge', 239, 'utilities');
});

// Netflix on the 26th — the ₹149 mobile plan, until the most recent month.
const netflixDates = monthlyDates(START, DEMO_ANALYSIS_DATE, 26);
netflixDates.forEach((date, index) => {
  add(date, 'Netflix', index === netflixDates.length - 1 ? 199 : 149, 'subscription');
});

// Spotify Student on the 27th.
monthlyDates(START, DEMO_ANALYSIS_DATE, 27).forEach((date) => {
  add(date, 'Spotify', 59, 'subscription');
});

/* --- Day-to-day spending, at student scale ------------------------ */

for (let offset = 0; offset <= HISTORY_DAYS; offset += 1) {
  const date = shift(START, offset);
  const weekday = parse(date).getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const daysAgo = HISTORY_DAYS - offset;
  // Seven days, not ten: 'normal' is measured as everything before the last
  // week, so a surge that bleeds into that window partly cancels itself out
  // and the very alert we planted stops firing.
  const inSurge = daysAgo <= 7;

  // Canteen snack between classes — most college days, small money.
  if (!isWeekend && random() < 0.68) {
    add(date, 'College Canteen', 15 + random() * 18, 'food');
  }

  // Tea and vada at the stall outside the gate.
  if (!isWeekend && random() < 0.42) {
    add(date, 'Tea Stall', 10 + random() * 12, 'food');
  }

  // Bus to college, occasionally a shared auto when he is late.
  if (!isWeekend && random() < 0.5) {
    const auto = random() < 0.15;
    add(date, auto ? 'Share Auto' : 'City Bus', auto ? 25 + random() * 18 : 8 + random() * 10, 'transport');
  }

  // Ordering in is a treat, not a habit — until the last week, when
  // exam-week ordering turns it into most evenings. This is the surge the
  // app is meant to notice while there is still time to act on it.
  /**
   * Ordering in is a treat, not a habit — until exam week.
   *
   * These numbers are deliberately restrained. An earlier version made the
   * surge dramatic enough to push the month to ₹7,300, which on ₹2,000 of
   * pocket money is not a warning, it is a fantasy. Roughly five extra orders
   * in a week is what actually happens, and it is enough: on this budget
   * ₹800 of Swiggy IS the emergency.
   */
  const deliveryChance = inSurge ? 0.5 : isWeekend ? 0.09 : 0.03;
  if (random() < deliveryChance) {
    add(date, random() < 0.5 ? 'Swiggy' : 'Zomato', inSurge ? 120 + random() * 100 : 110 + random() * 110, 'food');
  }
  if (inSurge && random() < 0.25) {
    add(date, 'Swiggy', 90 + random() * 80, 'food');
  }

  // Printouts, lab records, assignment sheets.
  if (random() < 0.12) {
    add(date, 'Campus Xerox', 8 + random() * 20, 'other');
  }
}

/* --- One-off events that make the story --------------------------- */

add(shift(DEMO_ANALYSIS_DATE, -8), 'Friend Birthday Treat', 120, 'food');
add(shift(DEMO_ANALYSIS_DATE, -7), 'PVR Cinemas', 150, 'entertainment');
add(shift(DEMO_ANALYSIS_DATE, -5), 'Myntra', 199, 'shopping');          // sale t-shirt
add(shift(DEMO_ANALYSIS_DATE, -3), 'Apollo Pharmacy', 60, 'health');
add(shift(DEMO_ANALYSIS_DATE, -24), 'Landmark Books', 240, 'shopping'); // semester textbook

const transactions = rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/* ---------------------------------------------------------------- */
/* What is coming next                                               */
/* ---------------------------------------------------------------- */

/**
 * ₹657 between the 24th and the 27th, against ₹1,180 in hand and eleven days
 * before any more arrives. More than half of what he has left, leaving on its
 * own, for things he signed up for months ago — that is the moment this app
 * exists to catch.
 */
export const demoRecurringPayments: RecurringPayment[] = [
  { id: 'upcoming-jio', merchant: 'Jio Recharge', category: 'utilities', previousAmount: 239, currentAmount: 399, nextPaymentDate: '2026-08-24', essential: true },
  { id: 'upcoming-netflix', merchant: 'Netflix', category: 'subscription', previousAmount: 149, currentAmount: 199, nextPaymentDate: '2026-08-26', essential: false },
  { id: 'upcoming-spotify', merchant: 'Spotify', category: 'subscription', previousAmount: 59, currentAmount: 59, nextPaymentDate: '2026-08-27', essential: false },
];

export const demoDataset: FinanceDataset = {
  profile: {
    id: 'demo-aditya',
    name: 'Aditya',
    monthlyIncome: 2_000,
    /**
     * Chosen so the simulation lands near a coin flip rather than a
     * certainty. A demo reporting 100% could have been a subtraction; one
     * reporting the sixties shows the model weighing how the remaining days
     * might actually go.
     */
    availableBalance: 1_300,
    nextIncomeDate: '2026-09-01',
    essentialMonthlyExpenses: 657, // recharge + the two subscriptions
    analysisDate: DEMO_ANALYSIS_DATE,
  },
  transactions,
  recurringPayments: demoRecurringPayments,
};
