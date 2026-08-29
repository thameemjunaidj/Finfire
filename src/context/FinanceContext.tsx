import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { demoDataset } from '../data/demoData';
import { calculateFinancialSummary, simulatePurchase } from '../engine/financeEngine';
import { buildForecast } from '../engine/forecastEngine';
import { mergeRecurringPayments } from '../engine/recurringDetection';
import { predictOutcome } from '../engine/predictionEngine';
import { trainModel } from '../engine/learningEngine';
import { explainOnDevice } from '../services/ai';
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
  LearnedModel,
  PredictionNarrative,
  SimulationInput,
  SimulationResult,
  SpendingPrediction,
  Transaction,
  TransactionImportSummary,
  RecurringPayment,
  SpendingForecast,
  UserProfile,
} from '../types/finance';

interface FinanceContextValue extends FinanceDataset {
  summary: FinancialSummary;
  forecast: SpendingForecast;
  /** Simulated outcome: how likely the money runs out, and the likely range. */
  prediction: SpendingPrediction;
  /** What the on-device model learned about this person. */
  learned: LearnedModel;
  /** That prediction written out in plain language. */
  narrative: PredictionNarrative;
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
  /**
   * What the engines actually analyse: the stored data plus any recurring
   * payments we can infer from the transactions.
   *
   * Kept separate from `dataset` on purpose — `state` is what gets persisted,
   * and we do not want detected guesses written to storage as if the user had
   * declared them. This matters most for imported statements, which arrive
   * with no recurring payments at all.
   */
  const analysisDataset = useMemo<FinanceDataset>(() => ({
    ...dataset,
    recurringPayments: mergeRecurringPayments(
      dataset.recurringPayments,
      dataset.transactions,
      dataset.profile.analysisDate,
    ),
  }), [dataset]);

  const summary = useMemo(() => calculateFinancialSummary(analysisDataset), [analysisDataset]);
  const forecast = useMemo(() => buildForecast(analysisDataset), [analysisDataset]);

  /** The simulation, and the plain-English version of what it found. */
  const prediction = useMemo(() => predictOutcome(analysisDataset), [analysisDataset]);
  /** The model trained on this phone, kept so the app can show what it learned. */
  const learned = useMemo(() => trainModel(analysisDataset), [analysisDataset]);
  const narrative = useMemo(
    () => explainOnDevice(prediction, forecast, analysisDataset.profile),
    [prediction, forecast, analysisDataset.profile],
  );

  const value = useMemo<FinanceContextValue>(() => ({
    ...analysisDataset,
    summary,
    forecast,
    prediction,
    learned,
    narrative,
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
    runSimulation: (input) => simulatePurchase(analysisDataset, input),
    setNotificationsEnabled: (notificationsEnabled) => setState((current) => ({ ...current, notificationsEnabled })),
    resetDemo: () => setState({ ...demoDataset, onboardingComplete: true, notificationsEnabled: state.notificationsEnabled }),
    eraseLocalData: async () => {
      await clearFinanceState();
      setState(initialState);
    },
  }), [analysisDataset, forecast, learned, loaded, narrative, prediction, state, summary]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance must be used inside FinanceProvider');
  return value;
}
