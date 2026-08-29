import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { demoDataset } from '../data/demoData';
import { calculateFinancialSummary, simulatePurchase } from '../engine/financeEngine';
import { buildForecast } from '../engine/forecastEngine';
import { clearFinanceState, loadFinanceState, saveFinanceState } from '../services/storage';
import {
  addTransactionToState,
  addRecurringPaymentToState,
  appendImportedTransactions,
  createManualTransaction,
  createRecurringPayment,
  removeRecurringPaymentFromState,
  removeTransactionFromState,
} from '../services/financeState';
import {
  FinanceDataset,
  FinancialSummary,
  PersistedFinanceState,
  SimulationInput,
  SimulationResult,
  Transaction,
  TransactionImportSummary,
  RecurringPayment,
  SpendingForecast,
  UserProfile,
} from '../types/finance';

interface FinanceContextValue extends FinanceDataset {
  summary: FinancialSummary;
  forecast: SpendingForecast;
  loaded: boolean;
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  useDemoAccount: () => void;
  completeCustomSetup: (profile: UserProfile) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'source'>) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (transactions: Transaction[]) => TransactionImportSummary;
  updateProfile: (profile: UserProfile) => void;
  addRecurringPayment: (payment: Omit<RecurringPayment, 'id'>) => void;
  deleteRecurringPayment: (id: string) => void;
  runSimulation: (input: SimulationInput) => SimulationResult;
  setNotificationsEnabled: (value: boolean) => void;
  resetDemo: () => void;
  eraseLocalData: () => Promise<void>;
}

const initialState: PersistedFinanceState = {
  ...demoDataset,
  onboardingComplete: false,
  notificationsEnabled: true,
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedFinanceState>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadFinanceState().then((stored) => {
      if (stored) setState(stored);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) void saveFinanceState(state);
  }, [state, loaded]);

  const dataset = useMemo<FinanceDataset>(() => ({
    profile: state.profile,
    transactions: state.transactions,
    recurringPayments: state.recurringPayments,
  }), [state.profile, state.transactions, state.recurringPayments]);
  const summary = useMemo(() => calculateFinancialSummary(dataset), [dataset]);
  const forecast = useMemo(() => buildForecast(dataset), [dataset]);

  const value = useMemo<FinanceContextValue>(() => ({
    ...dataset,
    summary,
    forecast,
    loaded,
    onboardingComplete: state.onboardingComplete,
    notificationsEnabled: state.notificationsEnabled,
    useDemoAccount: () => setState({ ...demoDataset, onboardingComplete: true, notificationsEnabled: true }),
    completeCustomSetup: (profile) => setState({
      profile,
      transactions: [],
      recurringPayments: [],
      onboardingComplete: true,
      notificationsEnabled: true,
    }),
    addTransaction: (transaction) => setState((current) => addTransactionToState(current, createManualTransaction(transaction))),
    deleteTransaction: (id) => setState((current) => removeTransactionFromState(current, id)),
    importTransactions: (transactions) => {
      const importSummary = appendImportedTransactions(state, transactions).summary;
      setState((current) => appendImportedTransactions(current, transactions).state);
      return importSummary;
    },
    updateProfile: (profile) => setState((current) => ({ ...current, profile })),
    addRecurringPayment: (payment) => setState((current) => addRecurringPaymentToState(current, createRecurringPayment(payment))),
    deleteRecurringPayment: (id) => setState((current) => removeRecurringPaymentFromState(current, id)),
    runSimulation: (input) => simulatePurchase(dataset, input),
    setNotificationsEnabled: (notificationsEnabled) => setState((current) => ({ ...current, notificationsEnabled })),
    resetDemo: () => setState({ ...demoDataset, onboardingComplete: true, notificationsEnabled: state.notificationsEnabled }),
    eraseLocalData: async () => {
      await clearFinanceState();
      setState(initialState);
    },
  }), [dataset, forecast, loaded, state, summary]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance must be used inside FinanceProvider');
  return value;
}
