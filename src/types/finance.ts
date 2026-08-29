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

export interface CategoryForecast {
  category: TransactionCategory;
  lastWeek: number;
  baselineWeek: number;
  projectedNextWeek: number;
  monthToDate: number;
  projectedMonthEnd: number;
  baselineMonth: number;
  trendPercentage: number;
  discretionary: boolean;
}

export interface SavingsAction {
  id: string;
  category: TransactionCategory;
  title: string;
  detail: string;
  monthlySaving: number;
  dailyReduction: number;
}

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
  projectedSavings: number;
  savingsTarget: number;
  savingsGap: number;
  onTrack: boolean;
  currentDailyPace: number;
  safeDailyAllowance: number;
  categories: CategoryForecast[];
  actions: SavingsAction[];
}

export interface TransactionImportSummary {
  added: number;
  skippedDuplicates: number;
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
