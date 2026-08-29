export type TransactionCategory =
  | 'income'
  | 'rent'
  | 'utilities'
  | 'food'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'subscription'
  | 'other';

export type TransactionDirection = 'credit' | 'debit';

export interface UserProfile {
  id: string;
  name: string;
  monthlyIncome: number;
  availableBalance: number;
  nextIncomeDate: string;
  essentialMonthlyExpenses: number;
  analysisDate?: string;
}

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  direction: TransactionDirection;
  category: TransactionCategory;
  essential: boolean;
  recurringGroupId?: string;
  source?: 'demo' | 'manual' | 'csv' | 'simulation';
}

export interface RecurringPayment {
  id: string;
  merchant: string;
  category: TransactionCategory;
  previousAmount: number;
  currentAmount: number;
  nextPaymentDate: string;
  essential: boolean;
}

export type AlertSeverity = 'watch' | 'high' | 'critical';
export type AlertType =
  | 'spending_surge'
  | 'bill_anomaly'
  | 'subscription_increase'
  | 'payment_pileup'
  | 'low_runway';

export interface FinancialAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  evidence: string;
  recommendation: string;
  impactAmount?: number;
  componentScore: number;
}

export type RiskBand = 'Safe' | 'Caution' | 'High Risk' | 'Critical';

export interface RiskComponents {
  spendingSurge: number;
  runway: number;
  billAnomaly: number;
  paymentPressure: number;
  subscriptionIncrease: number;
}

export interface FinancialSummary {
  riskScore: number;
  riskBand: RiskBand;
  riskExplanation: string;
  disposableBalance: number;
  protectedBalance: number;
  runwayDays: number;
  projectedMonthlySpending: number;
  normalMonthlySpending: number;
  upcomingPaymentsTotal: number;
  upcomingPaymentsCount: number;
  currentMonthSpending: number;
  monthlySpend: Array<{ month: string; amount: number }>;
  alerts: FinancialAlert[];
  components: RiskComponents;
}

export interface FinanceDataset {
  profile: UserProfile;
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
}

export interface SimulationInput {
  description: string;
  amount: number;
  category: TransactionCategory;
  proposedDate: string;
}

export interface SimulationResult {
  before: FinancialSummary;
  after: FinancialSummary;
  input: SimulationInput;
  verdict: RiskBand;
  runwayChange: number;
  riskChange: number;
}

export interface PersistedFinanceState extends FinanceDataset {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Forecasting — looking forward instead of back                       */
/* ------------------------------------------------------------------ */

/** How one spending category is trending, and where it lands if nothing changes. */
export interface CategoryForecast {
  category: TransactionCategory;
  /** Spend in the last 7 days. */
  lastWeek: number;
  /** What a normal week looks like for this category, from the last 28 days. */
  baselineWeek: number;
  /** Where next week lands if the recent pace continues. */
  projectedNextWeek: number;
  /** Spend so far this calendar month. */
  monthToDate: number;
  /** Where this month ends at the current pace. */
  projectedMonthEnd: number;
  /** A normal month for this category. */
  baselineMonth: number;
  /** How far above (+) or below (-) normal the projection sits, as a percentage. */
  trendPercentage: number;
  /** Discretionary categories are the ones a person can actually cut. */
  discretionary: boolean;
}

/** One concrete, costed suggestion for closing the savings gap. */
export interface SavingsAction {
  id: string;
  category: TransactionCategory;
  title: string;
  detail: string;
  /** What following it saves before the month ends. */
  monthlySaving: number;
  /** What it means per day, which is the only form people can act on. */
  dailyReduction: number;
}

/** The whole forward-looking picture: where the month lands, and how to change it. */
export interface SpendingForecast {
  asOf: string;
  daysElapsed: number;
  daysRemaining: number;

  lastWeekSpending: number;
  baselineWeeklySpending: number;
  projectedNextWeekSpending: number;

  currentMonthSpending: number;
  projectedMonthEndSpending: number;
  baselineMonthlySpending: number;

  expectedIncome: number;
  /** Income minus projected spending — negative means the month ends in the red. */
  projectedSavings: number;
  savingsTarget: number;
  /** How far short of the target the projection falls. Zero when on track. */
  savingsGap: number;
  onTrack: boolean;

  /** What is being spent per day right now, discretionary only. */
  currentDailyPace: number;
  /** What could be spent per day and still hit the savings target. */
  safeDailyAllowance: number;

  categories: CategoryForecast[];
  actions: SavingsAction[];
}

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  'income',
  'rent',
  'utilities',
  'food',
  'transport',
  'shopping',
  'entertainment',
  'health',
  'subscription',
  'other',
];
