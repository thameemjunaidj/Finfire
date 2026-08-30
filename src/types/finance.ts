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
  /**
   * Whether there is any recorded spending behind these numbers.
   *
   * Without it, a screen cannot tell "your money lasts 0 days" (a finding)
   * from "we cannot work out how long your money lasts" (no data) — and it
   * showed the first to someone with ₹15,000 in the bank.
   */
  hasSpendingHistory: boolean;
  /** Calendar days until the next allowance/income date. */
  daysUntilNextIncome: number;
  /** Null means there is not enough spending history to answer honestly. */
  expectedToLastUntilIncome: boolean | null;
  /** How many days before the next income the recent spending pace runs out. */
  shortfallDays: number;
  /** Maximum optional daily spend after essential payments are protected. */
  safeDailySpending: number;
  /** Deterministic balance estimate at next income; null without spending history. */
  estimatedBalanceAtNextIncome: number | null;
  /** Date the protected balance reaches zero at the recent spending pace. */
  moneyLastingDate: string | null;
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
  decision: 'recommended' | 'caution' | 'not_recommended';
  createsShortfall: boolean;
  shortfallChange: number;
  explanation: string;
}

export type PlainRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

/** One presentation-ready answer built from the deterministic engine. */
export interface MoneyOutlook {
  riskLevel: PlainRiskLevel;
  headline: string;
  mainReason: string;
  recommendedAction: string;
  spendingPace: number;
  spendingPaceChange: number | null;
}

export interface PersistedFinanceState extends FinanceDataset {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  /** Email the person signed in with. Absent means signed out. */
  signedInAs?: string;
  /** Session token from the server. This, not the email, is what proves who
   *  this device is when it talks to the backup endpoints. */
  sessionToken?: string;
  /** Whether the signed-in address has been confirmed by email. */
  emailVerified?: boolean;
  /** Warnings the person has said "got it" to. They stop showing and stop
   *  counting, until the demo is reset. */
  dismissedAlertIds?: string[];
}

/* ------------------------------------------------------------------ */
/* The learned model — trained on the phone, from this person's own days */
/* ------------------------------------------------------------------ */

/** Something the model worked out about this person, said in plain words. */
export interface LearnedPattern {
  id: string;
  title: string;
  detail: string;
  /** 0-1. How strongly the data supports it; used only for ordering. */
  strength: number;
}

/** A small model fitted on the device. Six numbers, no server, no library. */
export interface LearnedModel {
  /** False when there was too little history to learn anything honest. */
  trained: boolean;
  weights: number[];
  bias: number;
  /** Scaling used during training, needed to run the model afterwards. */
  means: number[];
  deviations: number[];
  daysTrainedOn: number;
  /** Typical error in rupees per day — how much to trust it. */
  averageError: number;
  /** What it got wrong on each past day; the simulation samples these. */
  residuals: number[];
  /** A ceiling on any single day's prediction, so the model cannot extrapolate
   *  beyond anything this person has ever actually spent. */
  maxPlausibleDay: number;
  /** How many pay cycles the history covers. Below two, the money-cycle
   *  features are switched off because they cannot be told apart from time. */
  incomeCycles: number;
  patterns: LearnedPattern[];
}

/* ------------------------------------------------------------------ */
/* Prediction — a range and a likelihood, not a single number          */
/* ------------------------------------------------------------------ */

/** A predicted quantity expressed as a range: p50 is the typical outcome,
 *  p10 and p90 are the optimistic and pessimistic ends. */
export interface PredictionBand {
  p10: number;
  p50: number;
  p90: number;
}

export interface SpendingPrediction {
  asOf: string;
  /** How many days ahead the simulation ran. */
  horizonDays: number;
  /** How many times it ran. */
  simulations: number;
  /** How many real days of history it learned from. */
  daysObserved: number;
  /** How much to trust the numbers, given how much history there was. */
  confidence: 'low' | 'medium' | 'high';
  /** Total spending still to come before the month ends. */
  remainingSpend: PredictionBand;
  /** Where the balance lands at month end. */
  monthEndBalance: PredictionBand;
  /** Share of simulated futures where the money ran out before income arrived. */
  shortfallProbability: number;
  /** The day it typically went wrong, across the runs where it did. */
  likelyShortfallDate: string | null;
  /** Plain description of how the numbers were produced, shown in the app. */
  method: string;
}

/** A prediction turned into sentences a person can act on. */
export interface PredictionNarrative {
  headline: string;
  body: string;
  /** Whether the wording came from the device or from a language model. */
  source: 'on-device' | 'language-model';
}

/* ------------------------------------------------------------------ */
/* Forecasting — looking forward instead of back                       */
/* ------------------------------------------------------------------ */

/** How one spending category is trending, and where it lands if nothing changes. */
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
