import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { demoDataset } from '../data/demoData';
import { calculateFinancialSummary, simulatePurchase } from '../engine/financeEngine';
import { buildForecast } from '../engine/forecastEngine';
import { mergeRecurringPayments } from '../engine/recurringDetection';
import { predictOutcome } from '../engine/predictionEngine';
import { trainModel } from '../engine/learningEngine';
import { explainOnDevice } from '../services/ai';
import { saveBackup } from '../services/backup';
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
  TransactionCategory,
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
  signedInAs?: string;
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  useDemoAccount: () => void;
  completeCustomSetup: (profile: UserProfile) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'source'>) => void;
  deleteTransaction: (id: string) => void;
  /** Correct what a payment was for. The categoriser learns from this. */
  setTransactionCategory: (id: string, category: TransactionCategory) => void;
  importTransactions: (transactions: Transaction[]) => TransactionImportSummary;
  updateProfile: (profile: UserProfile) => void;
  addRecurringPayment: (payment: Omit<RecurringPayment, 'id'>) => void;
  deleteRecurringPayment: (id: string) => void;
  runSimulation: (input: SimulationInput) => SimulationResult;
  /** The exact state that is saved on this phone — what a backup copies. */
  snapshot: () => PersistedFinanceState;
  /** Replace everything with a restored backup. */
  restoreState: (state: PersistedFinanceState) => void;
  /** The session token proving who this device is. */
  sessionToken?: string;
  /** False until the confirmation link is tapped. */
  emailVerified?: boolean;
  /**
   * Take over the app as this account.
   *
   * `restored` is that account's own data, fetched from the server during
   * sign-in. Passing nothing means starting empty — which is the correct
   * outcome for a new account, and the important one: what must NEVER happen
   * is the previous person's spending still being on screen.
   */
  signIn: (
    email: string,
    token: string,
    verified: boolean,
    restored?: PersistedFinanceState | null,
    emailFailed?: boolean,
  ) => void;
  /** True when no confirmation email could be sent, so the gate lets them by. */
  verificationEmailFailed?: boolean;
  markVerified: () => void;
  /** Acknowledge a warning: it leaves the list and the count drops. */
  dismissAlert: (id: string) => void;
  signOut: () => void;
  setNotificationsEnabled: (value: boolean) => void;
  resetDemo: () => void;
  eraseLocalData: () => Promise<void>;
}

/**
 * A brand-new, empty account.
 *
 * The app used to start pre-loaded with the sample account, which meant a
 * first-time user saw somebody else's spending presented as their own. It now
 * starts with nothing, and the sample is something you choose during setup.
 */
const initialState: PersistedFinanceState = {
  profile: {
    id: 'me',
    name: '',
    monthlyIncome: 0,
    availableBalance: 0,
    nextIncomeDate: '',
    essentialMonthlyExpenses: 0,
  },
  transactions: [],
  recurringPayments: [],
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

  /**
   * Keep the server's copy in step with the phone, without anyone pressing
   * anything.
   *
   * Backup used to be a button. That was fine while backup was a nicety, but
   * the account now OWNS the data — signing out clears the phone — so a copy
   * that only exists when someone remembered to press a button is a copy that
   * loses a week of somebody's spending.
   *
   * Four seconds of quiet before sending, so typing an amount is one upload
   * and not one per keystroke, and the previous payload is remembered so that
   * a re-render with nothing changed does not cost a request. Failures are
   * ignored on purpose: the phone still has everything, and the next change
   * tries again.
   */
  const lastPushed = useRef<string>('');
  useEffect(() => {
    if (!loaded || !state.sessionToken || !state.onboardingComplete) return;

    const payload = JSON.stringify(state);
    if (payload === lastPushed.current) return;

    const timer = setTimeout(() => {
      lastPushed.current = payload;
      void saveBackup(state.sessionToken as string, state);
    }, 4000);

    return () => clearTimeout(timer);
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

  const rawSummary = useMemo(() => calculateFinancialSummary(analysisDataset), [analysisDataset]);

  /**
   * Warnings the person has acknowledged are removed here, once, so that every
   * place showing them agrees: the list, the tab badge, the Home preview and
   * the assistant all read the same filtered array.
   */
  const summary = useMemo(() => {
    const dismissed = new Set(state.dismissedAlertIds ?? []);
    if (dismissed.size === 0) return rawSummary;
    return { ...rawSummary, alerts: rawSummary.alerts.filter((alert) => !dismissed.has(alert.id)) };
  }, [rawSummary, state.dismissedAlertIds]);
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
    signedInAs: state.signedInAs,
    sessionToken: state.sessionToken,
    emailVerified: state.emailVerified,
    verificationEmailFailed: state.verificationEmailFailed,
    onboardingComplete: state.onboardingComplete,
    notificationsEnabled: state.notificationsEnabled,
    useDemoAccount: () => setState((current) => ({ ...demoDataset, onboardingComplete: true, notificationsEnabled: true, signedInAs: current.signedInAs })),
    completeCustomSetup: (profile) => setState((current) => ({
      profile,
      transactions: [],
      recurringPayments: [],
      onboardingComplete: true,
      notificationsEnabled: true,
      // Resetting the account must not sign anyone out.
      signedInAs: current.signedInAs, sessionToken: current.sessionToken,
    })),
    addTransaction: (transaction) => setState((current) => addTransactionToState(current, createManualTransaction(transaction))),
    deleteTransaction: (id) => setState((current) => removeTransactionFromState(current, id)),
    setTransactionCategory: (id, category) => setState((current) => ({
      ...current,
      transactions: current.transactions.map((item) => (
        item.id === id
          ? { ...item, category, essential: ['rent', 'utilities', 'health'].includes(category) }
          : item
      )),
    })),
    importTransactions: (transactions) => {
      const importSummary = appendImportedTransactions(state, transactions).summary;
      setState((current) => appendImportedTransactions(current, transactions).state);
      return importSummary;
    },
    updateProfile: (profile) => setState((current) => ({ ...current, profile })),
    addRecurringPayment: (payment) => setState((current) => addRecurringPaymentToState(current, createRecurringPayment(payment))),
    deleteRecurringPayment: (id) => setState((current) => removeRecurringPaymentFromState(current, id)),
    runSimulation: (input) => simulatePurchase(analysisDataset, input),
    snapshot: () => state,
    // Keep whoever is signed in — a restore should not log them out of the
    // account they just restored from.
    restoreState: (restored) => setState((current) => ({
      ...restored,
      signedInAs: current.signedInAs,
      sessionToken: current.sessionToken,
      emailVerified: current.emailVerified,
    })),
    /**
     * The bug this fixes, in full, because it is the worst kind:
     *
     * Signing out used to clear only `signedInAs`. Everything else — profile,
     * a month of payments, the alerts — stayed exactly where it was. The next
     * person to sign in on that phone was shown the previous person's money
     * as their own, with their own name on the header. It looked like it was
     * working. That is what made it dangerous.
     *
     * So: sign-in now REPLACES the dataset. Either with what the server holds
     * for this account, or with nothing at all. The one exception is signing
     * back in as the same person the phone already had — usually because a
     * network hiccup made the restore come back empty — where wiping their
     * local data to "fix" it would be the worse of the two mistakes.
     */
    signIn: (email, token, verified, restored, emailFailed) => setState((current) => {
      const base = restored
        ?? (current.signedInAs === email ? current : initialState);
      return {
        ...base,
        signedInAs: email,
        sessionToken: token,
        emailVerified: verified,
        verificationEmailFailed: emailFailed === true,
        // Never inherited from a backup: this is a property of the phone, not
        // of the account.
        notificationsEnabled: current.notificationsEnabled,
      };
    }),
    markVerified: () => setState((current) => ({ ...current, emailVerified: true })),
    dismissAlert: (id) => setState((current) => (
      (current.dismissedAlertIds ?? []).includes(id)
        ? current
        : { ...current, dismissedAlertIds: [...(current.dismissedAlertIds ?? []), id] }
    )),
    /**
     * Signing out takes the data with it.
     *
     * It is a shared-phone app in practice — a hostel room, a friend "just
     * having a look" — and leaving one person's spending on the sign-in screen
     * for the next person is not a rough edge, it is a leak. The copy on the
     * server is what makes this safe to do: sign back in and it all comes
     * back. Only what is on this phone is being let go of here.
     */
    signOut: () => setState((current) => ({
      ...initialState,
      notificationsEnabled: current.notificationsEnabled,
    })),
    setNotificationsEnabled: (notificationsEnabled) => setState((current) => ({ ...current, notificationsEnabled })),
    resetDemo: () => setState((current) => ({ ...demoDataset, onboardingComplete: true, notificationsEnabled: current.notificationsEnabled, signedInAs: current.signedInAs })),
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
