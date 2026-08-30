import {
  PersistedFinanceState,
  RecurringPayment,
  Transaction,
  TransactionImportSummary,
  TRANSACTION_CATEGORIES,
  UserProfile,
} from '../types/finance';
import { isValidIsoDate } from '../utils/validation';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createManualTransaction(input: Omit<Transaction, 'id' | 'source'>): Transaction {
  return { ...input, id: uniqueId('manual'), source: 'manual' };
}

export function createRecurringPayment(input: Omit<RecurringPayment, 'id'>): RecurringPayment {
  return { ...input, id: uniqueId('recurring') };
}

export function addRecurringPaymentToState(
  state: PersistedFinanceState,
  payment: RecurringPayment,
): PersistedFinanceState {
  return { ...state, recurringPayments: [...state.recurringPayments, payment] };
}

export function removeRecurringPaymentFromState(state: PersistedFinanceState, id: string): PersistedFinanceState {
  return { ...state, recurringPayments: state.recurringPayments.filter((payment) => payment.id !== id) };
}

export function balanceDelta(transaction: Transaction): number {
  return transaction.direction === 'credit' ? transaction.amount : -transaction.amount;
}

export function addTransactionToState(state: PersistedFinanceState, transaction: Transaction): PersistedFinanceState {
  return {
    ...state,
    profile: {
      ...state.profile,
      availableBalance: state.profile.availableBalance + balanceDelta(transaction),
    },
    transactions: [...state.transactions, transaction],
  };
}

export function removeTransactionFromState(state: PersistedFinanceState, id: string): PersistedFinanceState {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction || transaction.source === 'demo') return state;
  const shouldRestoreBalance = transaction.source === 'manual';
  return {
    ...state,
    profile: shouldRestoreBalance
      ? {
        ...state.profile,
        availableBalance: state.profile.availableBalance - balanceDelta(transaction),
      }
      : state.profile,
    transactions: state.transactions.filter((item) => item.id !== id),
  };
}

export function appendImportedTransactions(
  state: PersistedFinanceState,
  incoming: Transaction[],
): { state: PersistedFinanceState; summary: TransactionImportSummary } {
  const existingIds = new Set(state.transactions.map((item) => item.id));
  const fingerprint = (item: Transaction) => [
    item.date,
    item.direction,
    Math.round(item.amount * 100),
    item.merchant.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ].join('|');
  const existingFingerprints = new Set(state.transactions.map(fingerprint));
  const accepted: Transaction[] = [];
  let skippedDuplicates = 0;
  incoming.forEach((transaction) => {
    if (existingIds.has(transaction.id) || existingFingerprints.has(fingerprint(transaction))) {
      skippedDuplicates += 1;
      return;
    }
    existingIds.add(transaction.id);
    accepted.push(transaction);
  });
  return {
    state: accepted.length ? { ...state, transactions: [...state.transactions, ...accepted] } : state,
    summary: { added: accepted.length, skippedDuplicates },
  };
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<UserProfile>;
  return typeof profile.id === 'string'
    && typeof profile.name === 'string'
    && profile.name.trim().length > 0
    && Number.isFinite(profile.monthlyIncome)
    && Number(profile.monthlyIncome) > 0
    && Number.isFinite(profile.availableBalance)
    && Number.isFinite(profile.essentialMonthlyExpenses)
    && Number(profile.essentialMonthlyExpenses) >= 0
    && typeof profile.nextIncomeDate === 'string'
    && isValidIsoDate(profile.nextIncomeDate)
    && (profile.analysisDate === undefined || (isValidIsoDate(profile.analysisDate) && profile.nextIncomeDate >= profile.analysisDate));
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Transaction>;
  return typeof item.id === 'string'
    && typeof item.merchant === 'string'
    && typeof item.date === 'string'
    && isValidIsoDate(item.date)
    && Number.isFinite(item.amount)
    && Number(item.amount) > 0
    && (item.direction === 'credit' || item.direction === 'debit')
    && typeof item.category === 'string'
    && TRANSACTION_CATEGORIES.includes(item.category)
    && typeof item.essential === 'boolean';
}

function isRecurringPayment(value: unknown): value is RecurringPayment {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RecurringPayment>;
  return typeof item.id === 'string'
    && typeof item.merchant === 'string'
    && typeof item.nextPaymentDate === 'string'
    && isValidIsoDate(item.nextPaymentDate)
    && Number.isFinite(item.previousAmount)
    && Number(item.previousAmount) >= 0
    && Number.isFinite(item.currentAmount)
    && Number(item.currentAmount) > 0
    && typeof item.category === 'string'
    && TRANSACTION_CATEGORIES.includes(item.category)
    && typeof item.essential === 'boolean';
}

export function sanitizePersistedState(value: unknown): PersistedFinanceState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<PersistedFinanceState>;
  if (!isUserProfile(state.profile) || !Array.isArray(state.transactions) || !Array.isArray(state.recurringPayments)) {
    return null;
  }
  return {
    profile: state.profile,
    transactions: state.transactions.filter(isTransaction),
    recurringPayments: state.recurringPayments.filter(isRecurringPayment),
    onboardingComplete: state.onboardingComplete === true,
    notificationsEnabled: state.notificationsEnabled !== false,
    signedInAs: typeof state.signedInAs === 'string' ? state.signedInAs : undefined,
    sessionToken: typeof state.sessionToken === 'string' ? state.sessionToken : undefined,
    emailVerified: state.emailVerified === true,
    dismissedAlertIds: Array.isArray(state.dismissedAlertIds)
      ? state.dismissedAlertIds.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
}
