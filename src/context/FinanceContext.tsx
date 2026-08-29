import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { demoDataset } from '../data/demoData';
import { calculateFinancialSummary, simulatePurchase } from '../engine/financeEngine';
import { buildForecast } from '../engine/forecastEngine';
import { clearFinanceState, loadFinanceState, saveFinanceState } from '../services/storage';
import {
  FinanceDataset,
  FinancialSummary,
  PersistedFinanceState,
  SimulationInput,
  SimulationResult,
  SpendingForecast,
  Transaction,
  UserProfile,
} from '../types/finance';

interface FinanceContextValue extends FinanceDataset {
  summary: FinancialSummary;
  /** Forward-looking projection: month-end spend, savings and how to fix them. */
  forecast: SpendingForecast;
  loaded: boolean;
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  useDemoAccount: () => void;
  completeCustomSetup: (profile: UserProfile) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'source'>) => void;
  importTransactions: (transactions: Transaction[]) => void;
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
    addTransaction: (transaction) => setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        availableBalance: Math.max(
          0,
          current.profile.availableBalance + (transaction.direction === 'credit' ? transaction.amount : -transaction.amount),
        ),
      },
      transactions: [
        ...current.transactions,
        { ...transaction, id: `manual-${Date.now()}`, source: 'manual' },
      ],
    })),
    importTransactions: (transactions) => setState((current) => ({
      ...current,
      transactions: [...current.transactions, ...transactions],
    })),
    runSimulation: (input) => simulatePurchase(dataset, input),
    setNotificationsEnabled: (notificationsEnabled) => setState((current) => ({ ...current, notificationsEnabled })),
    resetDemo: () => setState({ ...demoDataset, onboardingComplete: true, notificationsEnabled: state.notificationsEnabled }),
    eraseLocalData: async () => {
      await clearFinanceState();
      setState(initialState);
    },
  }), [dataset, forecast, loaded, state.notificationsEnabled, state.onboardingComplete, summary]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance must be used inside FinanceProvider');
  return value;
}
