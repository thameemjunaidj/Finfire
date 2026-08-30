import {
  AlertSeverity,
  FinanceDataset,
  FinancialAlert,
  FinancialSummary,
  RiskBand,
  RiskComponents,
  SimulationInput,
  SimulationResult,
  Transaction,
} from '../types/finance';
import { addDays, daysBetween, daysInMonth, monthKey, monthLabel, parseLocalDate, toIsoDate } from '../utils/dates';
import { formatCurrency, formatDate } from '../utils/format';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value);

const severityWeight: Record<AlertSeverity, number> = { critical: 3, high: 2, watch: 1 };

function severityFromPercentage(value: number): AlertSeverity {
  if (value >= 35) return 'critical';
  if (value >= 20) return 'high';
  return 'watch';
}

function spendingByMonth(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  transactions
    .filter((item) => item.direction === 'debit')
    .forEach((item) => totals.set(monthKey(item.date), (totals.get(monthKey(item.date)) ?? 0) + item.amount));
  return totals;
}

function createAlert(alert: FinancialAlert): FinancialAlert {
  return alert;
}

/**
 * How much history before the app is willing to put a number on anything.
 *
 * A week, and at least three payments. Both, because either one alone can be
 * satisfied without any real evidence: seven days can be a single backdated
 * entry, and three payments can all be from this morning. Together they mean
 * the app has actually watched someone spend for a while.
 *
 * A week is also the shortest span where "unusual" means anything, because
 * spending is weekly — weekends cost more than Tuesdays, and a baseline that
 * has not seen a weekend will call every Saturday a surge.
 *
 * Importing a bank statement clears both in one go, which is the intended
 * route in. Entering payments by hand takes longer, and should.
 */
export const MINIMUM_HISTORY_DAYS = 7;
const MINIMUM_HISTORY_ENTRIES = 3;

export function calculateFinancialSummary(dataset: FinanceDataset): FinancialSummary {
  const { profile, transactions, recurringPayments } = dataset;
  const asOf = profile.analysisDate ?? toIsoDate(new Date());
  const currentKey = monthKey(asOf);
  const elapsedDays = Math.max(1, parseLocalDate(asOf).getDate());
  const debitTransactions = transactions.filter((item) => item.direction === 'debit' && item.date <= asOf);
  const monthTotals = spendingByMonth(debitTransactions);
  const currentMonthSpending = monthTotals.get(currentKey) ?? 0;
  /**
   * Only months we hold from the 1st count as "normal".
   *
   * With a single month of history the previous month is a stub — a week or
   * two of data — and using it as the baseline makes an ordinary month look
   * like a 300% spending surge. Excluding partial months means a new user
   * falls back to their daily rate instead, which is honest rather than
   * alarming.
   */
  const earliestDate = debitTransactions.length
    ? debitTransactions.reduce((earliest, item) => (item.date < earliest ? item.date : earliest), debitTransactions[0].date)
    : asOf;
  const historicalEntries = [...monthTotals.entries()]
    .filter(([key]) => key < currentKey)
    .filter(([key]) => earliestDate <= `${key}-01`)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3);
  /**
   * "Normal" with no complete month behind you.
   *
   * The old fallback compared a full-month PROJECTION against the month SO
   * FAR, so a brand-new user was told their spending was accelerating on day
   * one, every time, purely because 31 days cost more than 21. That is the
   * fastest way to teach someone the alerts are noise.
   *
   * Instead, normal is the rate over everything EXCEPT the last week, scaled
   * to a month. Then a surge means "this week is unlike your other weeks",
   * which is a real signal and works from about two weeks of history.
   */
  // Inclusive: a payment entered today is one day of history, not zero.
  const daysOfHistory = debitTransactions.length
    ? Math.max(1, daysBetween(earliestDate, asOf) + 1)
    : 0;
  const hasEnoughHistory = daysOfHistory >= MINIMUM_HISTORY_DAYS
    && debitTransactions.length >= MINIMUM_HISTORY_ENTRIES;

  const priorWindowEnd = addDays(asOf, -7);
  const priorRows = debitTransactions.filter((item) => item.date <= priorWindowEnd);
  const priorDays = priorRows.length ? Math.max(1, daysBetween(earliestDate, priorWindowEnd)) : 0;
  const priorMonthlyRate = priorDays > 0
    ? (priorRows.reduce((sum, item) => sum + item.amount, 0) / priorDays) * daysInMonth(asOf)
    : 0;

  const normalMonthlySpending = historicalEntries.length
    ? historicalEntries.reduce((sum, [, value]) => sum + value, 0) / historicalEntries.length
    : Math.max(profile.essentialMonthlyExpenses, priorMonthlyRate);
  const projectedMonthlySpending = (currentMonthSpending / elapsedDays) * daysInMonth(asOf);
  const surgePercentage = normalMonthlySpending > 0
    ? ((projectedMonthlySpending - normalMonthlySpending) / normalMonthlySpending) * 100
    : 0;

  /**
   * With nothing recorded, say nothing.
   *
   * Every detector below compares against "normal", and with no history there
   * is no normal — so they were producing a risk score of 30 and a warning for
   * someone who had not entered a single payment. An app that raises an alarm
   * before it has any evidence is one nobody believes later.
   */
  if (debitTransactions.length === 0) {
    const balance = Math.max(0, profile.availableBalance);

    /**
     * One exception to the silence: an empty account.
     *
     * Everything else needs history to judge — you cannot call spending
     * "unusual" without knowing what usual is. But "there is no money left" is
     * something we can see directly, and it needs no comparison at all.
     */
    const noMoney = balance <= 0;

    return {
      hasSpendingHistory: false,
      daysOfHistory: 0,
      hasEnoughHistory: false,
      riskScore: noMoney ? 30 : 0,
      riskBand: noMoney ? 'Caution' : 'Safe',
      riskExplanation: noMoney
        ? 'There is nothing left in the account.'
        : 'Add a few days of spending and I can start looking for problems.',
      disposableBalance: balance,
      protectedBalance: balance,
      runwayDays: 0,
      projectedMonthlySpending: 0,
      normalMonthlySpending: 0,
      upcomingPaymentsTotal: 0,
      upcomingPaymentsCount: 0,
      currentMonthSpending: 0,
      monthlySpend: [],
      alerts: noMoney ? [createAlert({
        id: 'low-runway',
        type: 'low_runway',
        severity: 'critical',
        title: 'There is no money left',
        message: 'Your balance is zero, so anything due now will not go through.',
        evidence: 'Balance ₹0',
        recommendation: 'Add money before your next bill, or move the bill to a later date.',
        impactAmount: 0,
        componentScore: 100,
      })] : [],
      components: {
        spendingSurge: 0,
        runway: noMoney ? 100 : 0,
        billAnomaly: 0,
        paymentPressure: 0,
        subscriptionIncrease: 0,
      },
    };
  }

  const alerts: FinancialAlert[] = [];
  const spendingSurgeScore = surgePercentage >= 10
    ? clamp((Math.max(0, surgePercentage) / 50) * 100, 0, 75)
    : 0;
  if (surgePercentage >= 10) {
    const remainingDays = Math.max(1, daysInMonth(asOf) - elapsedDays);
    const safeRemaining = Math.max(0, normalMonthlySpending - currentMonthSpending);
    alerts.push(createAlert({
      id: 'spending-surge',
      type: 'spending_surge',
      severity: severityFromPercentage(surgePercentage),
      title: 'You are spending faster than usual',
      message: `If this continues, you could spend ${round(surgePercentage)}% more than usual this month.`,
      evidence: `Likely total ${formatCurrency(projectedMonthlySpending)} · Usual total ${formatCurrency(normalMonthlySpending)}`,
      recommendation: `Try to keep optional spending under ${formatCurrency(safeRemaining / remainingDays)} a day for the rest of the month.`,
      impactAmount: Math.max(0, projectedMonthlySpending - normalMonthlySpending),
      componentScore: spendingSurgeScore,
    }));
  }

  let billAnomalyScore = 0;
  const currentBills = debitTransactions.filter(
    (item) => monthKey(item.date) === currentKey && ['rent', 'utilities', 'health', 'other'].includes(item.category),
  );
  currentBills.forEach((currentBill) => {
    const key = currentBill.recurringGroupId ?? currentBill.merchant.toLowerCase();
    const previous = debitTransactions
      .filter((item) => {
        const itemKey = item.recurringGroupId ?? item.merchant.toLowerCase();
        return itemKey === key && monthKey(item.date) < currentKey;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-3);
    if (!previous.length) return;
    const average = previous.reduce((sum, item) => sum + item.amount, 0) / previous.length;
    const difference = currentBill.amount - average;
    const increase = average > 0 ? (difference / average) * 100 : 0;
    if (increase >= 30 && difference >= 100) {
      const score = clamp((increase / 80) * 100);
      billAnomalyScore = Math.max(billAnomalyScore, score);
      alerts.push(createAlert({
        id: `bill-${currentBill.id}`,
        type: 'bill_anomaly',
        severity: increase >= 60 ? 'critical' : increase >= 45 ? 'high' : 'watch',
        title: `Unusual ${currentBill.merchant} bill`,
        message: `This bill is ${round(increase)}% higher than usual.`,
        evidence: `${formatCurrency(currentBill.amount)} now · Usually ${formatCurrency(average)}`,
        recommendation: 'Check the bill details and compare them with your last three bills before paying.',
        impactAmount: difference,
        componentScore: score,
      }));
    }
  });

  /**
   * Bills that have not been charged yet.
   *
   * The loop above can only judge bills that already appear as transactions,
   * which means the app stays silent about a bill that is about to land at
   * three times its usual size — the single most useful thing it could warn
   * about, and the entire premise of being preventive rather than a report.
   */
  recurringPayments
    .filter((payment) => ['rent', 'utilities', 'health'].includes(payment.category))
    .filter((payment) => payment.nextPaymentDate > asOf)
    .forEach((payment) => {
      const difference = payment.currentAmount - payment.previousAmount;
      const increase = payment.previousAmount > 0 ? (difference / payment.previousAmount) * 100 : 0;
      if (increase < 50 || difference < 100) return;

      const score = clamp((increase / 80) * 100);
      billAnomalyScore = Math.max(billAnomalyScore, score);
      alerts.push(createAlert({
        id: `upcoming-bill-${payment.id}`,
        type: 'bill_anomaly',
        severity: increase >= 100 ? 'critical' : 'high',
        title: `${payment.merchant} bill is about to jump`,
        message: `Due on ${formatDate(payment.nextPaymentDate)}, and ${round(increase)}% higher than last time.`,
        evidence: `${formatCurrency(payment.previousAmount)} last time → ${formatCurrency(payment.currentAmount)} due`,
        recommendation: `Keep ${formatCurrency(payment.currentAmount)} aside before ${formatDate(payment.nextPaymentDate)}. If the amount looks wrong, check the bill.`,
        impactAmount: difference,
        componentScore: score,
      }));
    });

  let subscriptionIncreaseScore = 0;
  recurringPayments.forEach((payment) => {
    /**
     * Only categories where a rising charge means a PRICE change. Since
     * recurring payments are now detected automatically, an electricity bill
     * that doubled would otherwise be reported twice — once here and once as a
     * bill anomaly — which is how an alert list starts to feel like noise.
     */
    if (!['subscription', 'entertainment'].includes(payment.category)) return;

    const increaseAmount = payment.currentAmount - payment.previousAmount;
    const increasePercentage = payment.previousAmount > 0 ? (increaseAmount / payment.previousAmount) * 100 : 0;
    // ₹20 floor rather than ₹50: a ₹199 plan going to ₹229 is a real 15% rise.
    if (increasePercentage >= 5 && increaseAmount >= 20) {
      const score = clamp(increasePercentage);
      subscriptionIncreaseScore = Math.max(subscriptionIncreaseScore, score);
      alerts.push(createAlert({
        id: `subscription-${payment.id}`,
        type: 'subscription_increase',
        severity: increasePercentage >= 75 ? 'critical' : increasePercentage >= 30 ? 'high' : 'watch',
        title: `${payment.merchant} price increased`,
        message: `This regular payment increased by ${round(increasePercentage)}%.`,
        evidence: `${formatCurrency(payment.previousAmount)} → ${formatCurrency(payment.currentAmount)}`,
        recommendation: `Decide if you still want this before the next payment on ${formatDate(payment.nextPaymentDate)}.`,
        impactAmount: increaseAmount,
        componentScore: score,
      }));
    }
  });

  const sevenDaysLater = addDays(asOf, 7);
  /**
   * "Payments piling up" is about money that leaves WITHOUT a decision. A
   * weekly grocery run or a monthly Myntra habit is predictable, but nobody
   * gets a penalty for skipping it — counting those would inflate the pile-up
   * warning with spending the person can simply not do.
   *
   * Declared payments always count: if someone told the app about a payment,
   * they know better than our inference does.
   */
  const AUTOMATIC_CATEGORIES = ['rent', 'utilities', 'subscription', 'health'];
  const upcoming = recurringPayments
    .filter((payment) => !payment.id.startsWith('detected-') || AUTOMATIC_CATEGORIES.includes(payment.category))
    .filter((payment) => payment.nextPaymentDate >= asOf && payment.nextPaymentDate <= sevenDaysLater);
  const upcomingPaymentsTotal = upcoming.reduce((sum, payment) => sum + payment.currentAmount, 0);
  const disposableBalance = Math.max(0, profile.availableBalance);
  const upcomingRatio = upcomingPaymentsTotal === 0 ? 0 : disposableBalance > 0 ? upcomingPaymentsTotal / disposableBalance : 1;
  const hasPaymentPressure = upcoming.length >= 3 || upcomingRatio >= 0.25;
  const paymentPressureScore = hasPaymentPressure
    ? clamp(Math.max((upcoming.length / 5) * 100, upcomingRatio * 100))
    : 0;
  if (hasPaymentPressure) {
    alerts.push(createAlert({
      id: 'payment-pileup',
      type: 'payment_pileup',
      severity: upcomingRatio >= 0.5 ? 'critical' : upcoming.length >= 3 ? 'high' : 'watch',
      title: 'Several payments are due soon',
      message: `${upcoming.length} payments are due in the next seven days.`,
      evidence: `${formatCurrency(upcomingPaymentsTotal)} due · ${round(upcomingRatio * 100)}% of the money you have left`,
      recommendation: `Set aside ${formatCurrency(upcomingPaymentsTotal)} now and avoid optional purchases until these payments are complete.`,
      impactAmount: upcomingPaymentsTotal,
      componentScore: paymentPressureScore,
    }));
  }

  const essentialDue = recurringPayments
    .filter((payment) => payment.essential && payment.nextPaymentDate >= asOf && payment.nextPaymentDate <= profile.nextIncomeDate)
    .reduce((sum, payment) => sum + payment.currentAmount, 0);
  const protectedBalance = Math.max(0, disposableBalance - essentialDue);
  const recentStart = addDays(asOf, -13);
  const recentDiscretionary = debitTransactions.filter(
    (item) => item.date >= recentStart && item.date <= asOf && !item.essential && item.source !== 'simulation',
  );
  const recentDailyDiscretionarySpend = recentDiscretionary.reduce((sum, item) => sum + item.amount, 0) / 14;
  const daysToIncome = Math.max(1, daysBetween(asOf, profile.nextIncomeDate));
  const runwayDays = profile.availableBalance <= 0
    ? 0
    : recentDailyDiscretionarySpend > 0
    ? Math.max(0, protectedBalance / recentDailyDiscretionarySpend)
    : daysToIncome + 30;
  let runwayScore = 0;
  if (runwayDays <= 7) runwayScore = 100;
  else if (runwayDays <= 14) runwayScore = 75;
  else if (runwayDays <= 21) runwayScore = 45;
  else runwayScore = 0;
  if (runwayDays <= 21) {
    const safeDailyCap = daysToIncome > 0 ? protectedBalance / daysToIncome : protectedBalance;
    const severity: AlertSeverity = runwayDays <= 7 ? 'critical' : runwayDays <= 14 ? 'high' : 'watch';
    alerts.push(createAlert({
      id: 'low-runway',
      type: 'low_runway',
      severity,
      title: 'Your money may not last long',
      message: `After setting aside essential bills, your remaining money may last about ${round(runwayDays)} days.`,
      evidence: `${formatCurrency(protectedBalance)} left after essential bills · Recently spending ${formatCurrency(recentDailyDiscretionarySpend)} a day`,
      recommendation: `Try to spend no more than ${formatCurrency(safeDailyCap)} a day until your next income.`,
      impactAmount: protectedBalance,
      componentScore: runwayScore,
    }));
  }

  const components: RiskComponents = {
    spendingSurge: spendingSurgeScore,
    runway: runwayScore,
    billAnomaly: billAnomalyScore,
    paymentPressure: paymentPressureScore,
    subscriptionIncrease: subscriptionIncreaseScore,
  };
  const riskScore = round(clamp(
    components.spendingSurge * 0.35
      + components.runway * 0.3
      + components.billAnomaly * 0.15
      + components.paymentPressure * 0.1
      + components.subscriptionIncrease * 0.1,
  ));
  const riskBand = getRiskBand(riskScore);
  const contributorLabels: Array<[keyof RiskComponents, string]> = [
    ['spendingSurge', 'spending faster than usual'],
    ['runway', 'money that may run out soon'],
    ['billAnomaly', 'an unusual bill'],
    ['paymentPressure', 'several payments due soon'],
    ['subscriptionIncrease', 'a subscription price increase'],
  ];
  const topContributors = contributorLabels
    .sort(([a], [b]) => components[b] - components[a])
    .filter(([key]) => components[key] > 0)
    .slice(0, 2)
    .map(([, label]) => label);
  const riskExplanation = topContributors.length
    ? `The biggest concerns are ${topContributors.join(' and ')}.`
    : 'Nothing needs your attention right now.';

  const sortedAlerts = alerts.sort((a, b) => {
    const severityDifference = severityWeight[b.severity] - severityWeight[a.severity];
    return severityDifference || b.componentScore - a.componentScore;
  });
  const monthlySpend = [...historicalEntries, [currentKey, currentMonthSpending] as [string, number]].map(([key, amount]) => ({
    month: monthLabel(key),
    amount,
  }));

  return {
    hasSpendingHistory: true,
    daysOfHistory,
    hasEnoughHistory,
    riskScore,
    riskBand,
    riskExplanation,
    disposableBalance,
    protectedBalance,
    runwayDays: round(runwayDays),
    projectedMonthlySpending: round(projectedMonthlySpending),
    normalMonthlySpending: round(normalMonthlySpending),
    upcomingPaymentsTotal,
    upcomingPaymentsCount: upcoming.length,
    currentMonthSpending,
    monthlySpend,
    alerts: sortedAlerts,
    components,
  };
}

export function getRiskBand(score: number): RiskBand {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High Risk';
  if (score >= 30) return 'Caution';
  return 'Safe';
}

export function simulatePurchase(dataset: FinanceDataset, input: SimulationInput): SimulationResult {
  const before = calculateFinancialSummary(dataset);
  const currentAnalysisDate = dataset.profile.analysisDate ?? toIsoDate(new Date());
  const effectiveAnalysisDate = input.proposedDate > currentAnalysisDate ? input.proposedDate : currentAnalysisDate;
  const transaction: Transaction = {
    id: `simulation-${Date.now()}`,
    date: input.proposedDate,
    merchant: input.description || 'Hypothetical purchase',
    amount: input.amount,
    direction: 'debit',
    category: input.category,
    essential: ['rent', 'utilities', 'health'].includes(input.category),
    source: 'simulation',
  };
  const afterDataset: FinanceDataset = {
    profile: {
      ...dataset.profile,
      analysisDate: effectiveAnalysisDate,
      availableBalance: Math.max(0, dataset.profile.availableBalance - input.amount),
    },
    recurringPayments: [...dataset.recurringPayments],
    transactions: [...dataset.transactions, transaction],
  };
  const after = calculateFinancialSummary(afterDataset);
  return {
    before,
    after,
    input,
    verdict: after.riskBand,
    runwayChange: after.runwayDays - before.runwayDays,
    riskChange: after.riskScore - before.riskScore,
  };
}
