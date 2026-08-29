import { FinanceDataset, RecurringPayment, Transaction, TransactionCategory } from '../types/finance';

export const DEMO_ANALYSIS_DATE = '2026-08-18';

type SeedTransaction = Omit<Transaction, 'id' | 'source'>;

const categoryEssentials: Partial<Record<TransactionCategory, boolean>> = {
  rent: true,
  utilities: true,
  health: true,
};

function transaction(
  id: string,
  date: string,
  merchant: string,
  amount: number,
  category: TransactionCategory,
  options: Partial<SeedTransaction> = {},
): Transaction {
  return {
    id,
    date,
    merchant,
    amount,
    category,
    direction: options.direction ?? 'debit',
    essential: options.essential ?? categoryEssentials[category] ?? false,
    recurringGroupId: options.recurringGroupId,
    source: 'demo',
  };
}

const routineMerchants: Record<TransactionCategory, string[]> = {
  income: ['BrightByte Salary'],
  rent: ['Lakeview Residency'],
  utilities: ['TNEB Electricity', 'Jio Fiber'],
  food: ['Swiggy', 'Zomato', 'FreshMart', 'Chai Point'],
  transport: ['Uber', 'Metro Recharge', 'Indian Oil'],
  shopping: ['Myntra', 'Amazon', 'Reliance Trends'],
  entertainment: ['PVR Cinemas', 'GameZone'],
  health: ['Apollo Pharmacy'],
  subscription: ['Netflix', 'Spotify', 'Adobe Creative Cloud', 'Google One'],
  other: ['UPI Transfer'],
};

function buildMonth(month: string, index: number, electricity: number): Transaction[] {
  const day = (value: number) => `${month}-${`${value}`.padStart(2, '0')}`;
  const rows: Transaction[] = [
    transaction(`${month}-salary`, day(1), 'BrightByte Salary', 48_000, 'income', { direction: 'credit', essential: true }),
    transaction(`${month}-rent`, day(2), 'Lakeview Residency', 9_000, 'rent', { recurringGroupId: 'rent' }),
    transaction(`${month}-power`, day(5), 'TNEB Electricity', electricity, 'utilities', { recurringGroupId: 'electricity' }),
    transaction(`${month}-fiber`, day(7), 'Jio Fiber', 699, 'utilities', { recurringGroupId: 'fiber' }),
    transaction(`${month}-adobe`, day(8), 'Adobe Creative Cloud', 797, 'subscription', { recurringGroupId: 'adobe' }),
    transaction(`${month}-netflix`, day(9), 'Netflix', 649, 'subscription', { recurringGroupId: 'netflix' }),
    transaction(`${month}-spotify`, day(10), 'Spotify', 119, 'subscription', { recurringGroupId: 'spotify' }),
    transaction(`${month}-google`, day(11), 'Google One', 130, 'subscription', { recurringGroupId: 'google-one' }),
  ];

  const variable: Array<[number, TransactionCategory, number]> = [
    [3, 'food', 420], [4, 'transport', 280], [6, 'food', 610], [8, 'food', 340],
    [10, 'transport', 450], [12, 'food', 780], [13, 'shopping', 860 + index * 40],
    [15, 'food', 390], [17, 'transport', 310], [19, 'food', 560],
    [21, 'entertainment', 520], [22, 'food', 430], [24, 'transport', 380],
    [25, 'food', 720], [27, 'shopping', 950], [28, 'food', 480],
  ];

  variable.forEach(([date, category, amount], rowIndex) => {
    const merchants = routineMerchants[category];
    rows.push(transaction(`${month}-var-${rowIndex}`, day(date), merchants[rowIndex % merchants.length], amount, category));
  });
  return rows;
}

const historicalTransactions = [
  ...buildMonth('2026-05', 0, 1_790),
  ...buildMonth('2026-06', 1, 1_825),
  ...buildMonth('2026-07', 2, 1_860),
];

const currentTransactions: Transaction[] = [
  transaction('aug-salary', '2026-08-01', 'BrightByte Salary', 48_000, 'income', { direction: 'credit', essential: true }),
  transaction('aug-rent', '2026-08-02', 'Lakeview Residency', 9_000, 'rent', { recurringGroupId: 'rent' }),
  transaction('aug-food-1', '2026-08-03', 'Swiggy', 860, 'food'),
  transaction('aug-transport-1', '2026-08-04', 'Uber', 620, 'transport'),
  transaction('aug-power', '2026-08-05', 'TNEB Electricity', 2_940, 'utilities', { recurringGroupId: 'electricity' }),
  transaction('aug-shopping-1', '2026-08-06', 'Myntra', 7_150, 'shopping'),
  transaction('aug-fiber', '2026-08-07', 'Jio Fiber', 699, 'utilities', { recurringGroupId: 'fiber' }),
  transaction('aug-adobe', '2026-08-08', 'Adobe Creative Cloud', 1_596, 'subscription', { recurringGroupId: 'adobe' }),
  transaction('aug-food-2', '2026-08-09', 'Zomato', 1_040, 'food'),
  transaction('aug-transport-2', '2026-08-10', 'Indian Oil', 1_300, 'transport'),
  transaction('aug-entertainment', '2026-08-11', 'PVR Cinemas', 980, 'entertainment'),
  transaction('aug-food-3', '2026-08-12', 'FreshMart', 1_260, 'food', { essential: true }),
  transaction('aug-shopping-2', '2026-08-13', 'Amazon', 1_740, 'shopping'),
  transaction('aug-food-4', '2026-08-14', 'Swiggy', 790, 'food'),
  transaction('aug-transport-3', '2026-08-15', 'Uber', 540, 'transport'),
  transaction('aug-health', '2026-08-16', 'Apollo Pharmacy', 450, 'health'),
  transaction('aug-food-5', '2026-08-17', 'Zomato', 880, 'food'),
  transaction('aug-shopping-3', '2026-08-18', 'Reliance Trends', 1_490, 'shopping'),
];

export const demoRecurringPayments: RecurringPayment[] = [
  { id: 'upcoming-netflix', merchant: 'Netflix', category: 'subscription', previousAmount: 649, currentAmount: 649, nextPaymentDate: '2026-08-20', essential: false },
  { id: 'upcoming-insurance', merchant: 'Health Insurance', category: 'health', previousAmount: 2_150, currentAmount: 2_150, nextPaymentDate: '2026-08-22', essential: true },
  { id: 'upcoming-bike', merchant: 'Bike EMI', category: 'transport', previousAmount: 3_400, currentAmount: 3_400, nextPaymentDate: '2026-08-24', essential: true },
  { id: 'upcoming-adobe', merchant: 'Adobe Creative Cloud', category: 'subscription', previousAmount: 797, currentAmount: 1_596, nextPaymentDate: '2026-09-08', essential: false },
  { id: 'upcoming-rent', merchant: 'Lakeview Residency', category: 'rent', previousAmount: 9_000, currentAmount: 9_000, nextPaymentDate: '2026-09-02', essential: true },
];

export const demoDataset: FinanceDataset = {
  profile: {
    id: 'demo-arjun',
    name: 'Arjun',
    monthlyIncome: 48_000,
    availableBalance: 16_800,
    nextIncomeDate: '2026-09-01',
    essentialMonthlyExpenses: 14_500,
    analysisDate: DEMO_ANALYSIS_DATE,
  },
  transactions: [...historicalTransactions, ...currentTransactions],
  recurringPayments: demoRecurringPayments,
};
