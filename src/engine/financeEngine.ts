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
      title: 'Spending is accelerating',
      message: `At this pace, you may spend ${round(surgePercentage)}% more than your recent monthly average.`,
      evidence: `${formatCurrency(projectedMonthlySpending)} projected vs ${formatCurrency(normalMonthlySpending)} usual`,
      recommendation: `Keep discretionary spending below ${formatCurrency(safeRemaining / remainingDays)} per day for the rest of the month.`,
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
        message: `This charge is ${round(increase)}% above its recent average.`,
        evidence: `${formatCurrency(currentBill.amount)} now vs ${formatCurrency(average)} average`,
        recommendation: 'Verify usage and compare this bill with the previous three statements before paying.',
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
        message: `Due on ${payment.nextPaymentDate}, and ${round(increase)}% higher than last time.`,
        evidence: `${formatCurrency(payment.previousAmount)} last time → ${formatCurrency(payment.currentAmount)} due`,
        recommendation: `Set ${formatCurrency(payment.currentAmount)} aside before ${payment.nextPaymentDate}, and check the reading if it looks wrong.`,
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
        message: `Your recurring charge increased by ${round(increasePercentage)}%.`,
        evidence: `${formatCurrency(payment.previousAmount)} → ${formatCurrency(payment.currentAmount)}`,
        recommendation: `Review, downgrade, or cancel the plan before ${formatDate(payment.nextPaymentDate, true)}.`,
        impactAmount: increaseAmount,
        componentScore: score,
      }));
    }
  });

  const sevenDaysLater = addDays(asOf, 7);
<<<<<<< HEAD
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
    .filter((payment) => payment.nextPaymentDate > asOf && payment.nextPaymentDate <= sevenDaysLater);
=======
  const upcoming = recurringPayments.filter(
    (payment) => payment.nextPaymentDate >= asOf && payment.nextPaymentDate <= sevenDaysLater,
  );
>>>>>>> d76e5acd6e84024390df24c3ee9ff98c69ab238a
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
      title: 'Payments are piling up',
      message: `${upcoming.length} automatic payments are due within the next seven days.`,
      evidence: `${formatCurrency(upcomingPaymentsTotal)} due — ${round(upcomingRatio * 100)}% of your available balance`,
      recommendation: `Reserve ${formatCurrency(upcomingPaymentsTotal)} now and pause non-essential purchases until they clear.`,
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
      title: 'Your money runway is short',
      message: `At your recent discretionary pace, your protected balance may last about ${round(runwayDays)} days.`,
      evidence: `${formatCurrency(protectedBalance)} protected balance ÷ ${formatCurrency(recentDailyDiscretionarySpend)}/day`,
      recommendation: `Cap discretionary spending at ${formatCurrency(safeDailyCap)} per day until your next income.`,
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
    ['spendingSurge', 'accelerated spending'],
    ['runway', 'a short money runway'],
    ['billAnomaly', 'an unusual bill'],
    ['paymentPressure', 'payments due this week'],
    ['subscriptionIncrease', 'a subscription price increase'],
  ];
  const topContributors = contributorLabels
    .sort(([a], [b]) => components[b] - components[a])
    .filter(([key]) => components[key] > 0)
    .slice(0, 2)
    .map(([, label]) => label);
  const riskExplanation = topContributors.length
    ? `Mainly driven by ${topContributors.join(' and ')}.`
    : 'No material risks are currently detected.';

  const sortedAlerts = alerts.sort((a, b) => {
    const severityDifference = severityWeight[b.severity] - severityWeight[a.severity];
    return severityDifference || b.componentScore - a.componentScore;
  });
  const monthlySpend = [...historicalEntries, [currentKey, currentMonthSpending] as [string, number]].map(([key, amount]) => ({
    month: monthLabel(key),
    amount,
  }));

  return {
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
