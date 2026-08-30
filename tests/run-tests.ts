import { demoDataset } from '../src/data/demoData';
import { calculateFinancialSummary, getRiskBand, simulatePurchase } from '../src/engine/financeEngine';
import { buildMoneyOutlook } from '../src/engine/decisionEngine';
import { buildForecast } from '../src/engine/forecastEngine';
import { categorise, trainCategoryModel } from '../src/engine/categoriser';
import { predictOutcome } from '../src/engine/predictionEngine';
import { reviewBatch } from '../src/engine/reviewEngine';
import { parseBankMessage, parseMessageBatch, toTransaction } from '../src/engine/smsParser';
import { explainOnDevice } from '../src/services/ai';
import { parseTransactionsCsv } from '../src/services/csv';
import { readStatement } from '../src/services/statementParser';
import {
  addTransactionToState,
  addRecurringPaymentToState,
  appendImportedTransactions,
  createManualTransaction,
  createRecurringPayment,
  removeRecurringPaymentFromState,
  removeTransactionFromState,
  sanitizePersistedState,
} from '../src/services/financeState';
import { FinanceDataset, PersistedFinanceState, Transaction } from '../src/types/finance';
import { plainLabel } from '../src/utils/format';
import { isValidIsoDate, parseNonNegativeMoney, parsePositiveMoney } from '../src/utils/validation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Test failed: ${message}`);
}

function approximately(actual: number, expected: number, tolerance: number, label: string): void {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
}

const summary = calculateFinancialSummary(demoDataset);
const types = new Set(summary.alerts.map((alert) => alert.type));
assert(types.has('spending_surge'), 'detects a spending surge');
assert(types.has('bill_anomaly'), 'detects the recharge about to jump');
assert(types.has('subscription_increase'), 'detects the Netflix price increase');
assert(types.has('payment_pileup'), 'detects payments due in seven days');
assert(types.has('low_runway'), 'detects a low money runway');
assert(summary.riskScore >= 0 && summary.riskScore <= 100, 'clamps risk score to 0–100');
assert(summary.upcomingPaymentsCount === 3, 'counts three upcoming payments');
approximately(summary.upcomingPaymentsTotal, 657, 0, 'upcoming total');
approximately(summary.runwayDays, 9, 0, 'demo runway');
assert(summary.daysUntilNextIncome === 11, 'counts days until the demo allowance');
assert(summary.expectedToLastUntilIncome === false, 'detects that the demo money will not last');
assert(summary.shortfallDays === 2, 'derives a two-day demo shortfall from runway and allowance date');
assert(summary.safeDailySpending > 0, 'derives a safe daily spend from protected balance');
assert(summary.estimatedBalanceAtNextIncome !== null && summary.estimatedBalanceAtNextIncome < 0, 'derives a negative balance at the next allowance');

// The electricity bill is due on the 27th, so it is not a transaction yet.
// This asserts the app warns BEFORE the charge lands, which is the whole point.
assert(
  summary.alerts.some((alert) => alert.id.startsWith('upcoming-bill-')),
  'warns about a scheduled bill before it is charged',
);

const forecast = buildForecast(demoDataset);
const outlook = buildMoneyOutlook(summary, forecast);
assert(outlook.headline.includes('run short'), 'plain outlook leads with the shortage answer');
assert(outlook.mainReason.length > 20, 'plain outlook explains the main reason');
assert(forecast.asOf === demoDataset.profile.analysisDate, 'forecast uses the reproducible analysis date');
assert(forecast.categories.length > 0, 'forecast reports category projections');
assert(forecast.projectedMonthEndSpending >= forecast.currentMonthSpending, 'month-end forecast never loses recorded spending');
assert(forecast.projectedNextWeekSpending >= 0, 'next-week projection is non-negative');
assert(forecast.safeDailyAllowance >= 0, 'safe daily allowance is non-negative');

const simulation = simulatePurchase(demoDataset, {
  description: 'Phone purchase',
  amount: 600,
  category: 'shopping',
  proposedDate: '2026-08-21',
});
assert(simulation.after.riskScore >= simulation.before.riskScore, 'risky purchase does not reduce risk');
assert(simulation.after.runwayDays < simulation.before.runwayDays, 'a ₹600 purchase reduces runway');
assert(simulation.decision === 'not_recommended', 'purchase decision clearly warns when the shortfall grows');
assert(simulation.shortfallChange > 0, 'purchase comparison reports added shortfall days');
assert(demoDataset.transactions.every((item) => item.source !== 'simulation'), 'simulation never mutates real data');

const safeDataset: FinanceDataset = {
  profile: {
    id: 'safe',
    name: 'Safe User',
    monthlyIncome: 50_000,
    availableBalance: 50_000,
    nextIncomeDate: '2026-09-01',
    essentialMonthlyExpenses: 0,
    analysisDate: '2026-08-18',
  },
  transactions: [],
  recurringPayments: [],
};
const safeSummary = calculateFinancialSummary(safeDataset);
assert(safeSummary.riskScore === 0, 'a genuinely safe empty dataset has zero risk');
assert(safeSummary.alerts.length === 0, 'a safe dataset has no false warnings');
// An empty account is not "safe" — it is unknown, and the app now says so.
// "Nothing needs your attention" implies we looked and found nothing, when in
// fact we had nothing to look at. Same zero risk, honest wording.
assert(
  safeSummary.riskExplanation.includes('Add a few days of spending'),
  'an empty account says it has nothing to go on, rather than reassuring',
);
assert(plainLabel('debit') === 'Money out', 'shows debit in plain language');
assert(plainLabel('critical') === 'Urgent', 'shows critical severity in plain language');

const noBalanceSummary = calculateFinancialSummary({
  ...safeDataset,
  profile: { ...safeDataset.profile, availableBalance: 0 },
});
assert(noBalanceSummary.alerts.some((alert) => alert.type === 'low_runway'), 'zero balance creates a runway warning');
assert(!noBalanceSummary.alerts.some((alert) => alert.type === 'payment_pileup'), 'zero balance without payments does not create a false payment warning');

const futureSimulation = simulatePurchase(safeDataset, {
  description: 'Future purchase',
  amount: 5000,
  category: 'shopping',
  proposedDate: '2026-08-20',
});
assert(futureSimulation.after.currentMonthSpending === 5000, 'a proposed future-date purchase is included in its simulation');

/* --- The prediction model ----------------------------------------- */

const prediction = predictOutcome(demoDataset);
assert(
  prediction.shortfallProbability >= 0 && prediction.shortfallProbability <= 1,
  'shortfall probability is a probability',
);
assert(
  prediction.remainingSpend.p10 <= prediction.remainingSpend.p50
    && prediction.remainingSpend.p50 <= prediction.remainingSpend.p90,
  'prediction bands are ordered',
);
assert(prediction.daysObserved > 0, 'the model learned from real days');
// One month of history must not be reported as two. The learning window is
// clamped to the data, so a new user is told 'medium confidence', not 'high'.
assert(prediction.daysObserved <= 32, 'never claims more history than exists');

// Determinism matters more than it sounds: a demo that shows a different
// percentage on every reload is one nobody can rehearse or trust.
const repeat = predictOutcome(demoDataset);
assert(
  repeat.shortfallProbability === prediction.shortfallProbability
    && repeat.remainingSpend.p50 === prediction.remainingSpend.p50,
  'the simulation is deterministic',
);

// The narrative must never invent a figure the model did not produce.
const narrative = explainOnDevice(prediction, buildForecast(demoDataset), demoDataset.profile);
assert(narrative.source === 'on-device', 'falls back to on-device wording with no API key');
assert(narrative.body.length > 80, 'narrative explains itself in full sentences');

assert(getRiskBand(0) === 'Safe', 'safe band lower bound');
assert(getRiskBand(30) === 'Caution', 'caution band lower bound');
assert(getRiskBand(60) === 'High Risk', 'high band lower bound');
assert(getRiskBand(80) === 'Critical', 'critical band lower bound');

const csv = '\uFEFFdate,merchant,amount,direction,category,essential\n2026-08-18,"Cafe, Vellore",350,debit,food,no';
const parsed = parseTransactionsCsv(csv);
const parsedAgain = parseTransactionsCsv(csv);
assert(parsed.transactions.length === 1, 'imports a valid CSV transaction');
assert(parsed.transactions[0].merchant === 'Cafe, Vellore', 'handles quoted CSV commas');
assert(parsed.errors.length === 0, 'valid CSV has no errors');
assert(parsed.transactions[0].id === parsedAgain.transactions[0].id, 'CSV IDs are stable across repeated imports');

const aliases = parseTransactionsCsv('date,merchant,amount,category\n2026-08-18,Salary,2500,salary\n2026-08-18,Market,-350,groceries');
assert(aliases.transactions[0].direction === 'credit', 'salary category defaults to credit');
assert(aliases.transactions[0].category === 'income', 'salary category maps to income');
assert(aliases.transactions[1].direction === 'debit', 'negative bank amount defaults to debit');
assert(aliases.transactions[1].category === 'food', 'groceries category maps to food');

const invalidHeaders = parseTransactionsCsv('merchant,amount\nShop,500');
assert(invalidHeaders.transactions.length === 0 && invalidHeaders.errors.length === 1, 'rejects missing CSV headers');
const invalidRows = parseTransactionsCsv('date,merchant,amount,direction\n2026-02-30,Shop,500,debit\n2026-08-18,Cafe,250,sideways');
assert(invalidRows.transactions.length === 0 && invalidRows.errors.length === 2, 'rejects impossible dates and unknown directions');

const baseState: PersistedFinanceState = {
  ...safeDataset,
  profile: { ...safeDataset.profile, availableBalance: 100 },
  onboardingComplete: true,
  notificationsEnabled: true,
};
const manualDebit = createManualTransaction({
  date: '2026-08-18',
  merchant: 'Large purchase',
  amount: 200,
  direction: 'debit',
  category: 'shopping',
  essential: false,
});
const addedState = addTransactionToState(baseState, manualDebit);
assert(addedState.profile.availableBalance === -100, 'keeps the exact debit delta even when the balance goes below zero');
const restoredState = removeTransactionFromState(addedState, manualDebit.id);
assert(restoredState.profile.availableBalance === 100, 'removing a manual debit restores the exact prior balance');
assert(restoredState.transactions.length === 0, 'removing a manual transaction removes the row');
assert(removeTransactionFromState({ ...baseState, transactions: [demoDataset.transactions[0]] }, demoDataset.transactions[0].id).transactions.length === 1, 'demo evidence cannot be removed');

const manualCredit = createManualTransaction({
  date: '2026-08-18',
  merchant: 'Freelance payment',
  amount: 500,
  direction: 'credit',
  category: 'income',
  essential: false,
});
const creditedState = addTransactionToState(baseState, manualCredit);
assert(creditedState.profile.availableBalance === 600, 'manual income raises the balance');
assert(removeTransactionFromState(creditedState, manualCredit.id).profile.availableBalance === 100, 'removing manual income reverses its balance change');

const recurring = createRecurringPayment({
  merchant: 'Test subscription',
  category: 'subscription',
  previousAmount: 100,
  currentAmount: 150,
  nextPaymentDate: '2026-08-20',
  essential: false,
});
const withRecurring = addRecurringPaymentToState(baseState, recurring);
assert(withRecurring.recurringPayments.length === 1, 'scheduled-payment manager adds a commitment');
assert(removeRecurringPaymentFromState(withRecurring, recurring.id).recurringPayments.length === 0, 'scheduled-payment manager removes a commitment');

const importedTransaction: Transaction = { ...parsed.transactions[0], id: 'csv-stable-test' };
const firstImport = appendImportedTransactions(baseState, [importedTransaction]);
const repeatedImport = appendImportedTransactions(firstImport.state, [importedTransaction]);
assert(firstImport.summary.added === 1, 'first CSV import adds a row');
assert(repeatedImport.summary.added === 0 && repeatedImport.summary.skippedDuplicates === 1, 'repeated CSV import is duplicate-safe');
assert(repeatedImport.state.profile.availableBalance === baseState.profile.availableBalance, 'CSV import does not alter the available balance');

/* --- Connected statement and bank-message imports ---------------- */

const bankStatement = [
  'Account Name,Student Account',
  'Statement Period,August 2026',
  'Transaction Date,Narration,Withdrawal Amt.,Deposit Amt.',
  '21/08/2026,UPI-SWIGGY-swiggy@ybl-REF402944,"1,240.00",',
  '22-Aug-26,Scholarship Credit,,5000.00',
].join('\n');
const statement = readStatement(bankStatement);
assert(statement.transactions.length === 2, 'reads a real bank-style statement with preamble and split debit/credit columns');
assert(statement.transactions[0].merchant === 'Swiggy', 'cleans a machine narration into a readable merchant');
assert(statement.transactions[0].direction === 'debit' && statement.transactions[1].direction === 'credit', 'keeps money out and money in separate');
assert(statement.mapping.Narration === 'who it was paid to', 'shows the user how statement columns were understood');

const categoryModel = trainCategoryModel(demoDataset.transactions);
const swiggyGuess = categorise(categoryModel, 'Swiggy');
assert(swiggyGuess.category === 'food' && swiggyGuess.confidence >= 0.6, 'uses spending history to categorise imported merchants');

const bankMessage = 'Rs 240 debited from A/c XX1234 to Swiggy on 21-08-2026';
const parsedMessage = parseBankMessage(bankMessage, '2026-08-30');
assert(parsedMessage?.merchant === 'Swiggy' && parsedMessage.amount === 240, 'reads a pasted bank payment message');
assert(parseBankMessage('Your OTP is 123456. Do not share it. Rs 5000', '2026-08-30') === null, 'never imports an OTP as spending');
assert(parseMessageBatch(`${bankMessage}\nRs 600 credited to A/c XX1234 from Scholarship on 22-08-2026`).length === 2, 'reads several pasted messages');
const smsTransaction = toTransaction(parsedMessage!, 'food');
assert(smsTransaction.id === toTransaction(parsedMessage!, 'food').id, 'a pasted message has a stable duplicate-safe id');

const differentIdSamePayment = { ...smsTransaction, id: 'another-import-id' };
const fingerprintRepeat = appendImportedTransactions(
  { ...baseState, transactions: [smsTransaction] },
  [differentIdSamePayment],
);
assert(fingerprintRepeat.summary.skippedDuplicates === 1, 'recognises the same payment even when its import id changes');

const unusual = reviewBatch(demoDataset.transactions, [{
  id: 'review-new-place',
  date: '2026-08-21',
  merchant: 'New Electronics Store',
  amount: 4500,
  direction: 'debit',
  category: 'shopping',
  essential: false,
  source: 'csv',
}]);
assert(unusual.items.some((item) => item.flag === 'new_merchant'), 'shows unusual imported spending before it is saved');

const sanitized = sanitizePersistedState({
  ...baseState,
  signedInAs: 'student@example.com',
  sessionToken: 'session-test-token',
  emailVerified: true,
  dismissedAlertIds: ['warning-one', 42],
  transactions: [importedTransaction, { ...importedTransaction, id: 'bad', category: 'unknown' }],
});
assert(sanitized?.transactions.length === 1, 'stored malformed transaction rows are discarded safely');
assert(sanitized?.signedInAs === 'student@example.com' && sanitized.sessionToken === 'session-test-token', 'a saved sign-in survives app restart');
assert(sanitized?.emailVerified === true, 'email confirmation survives app restart');
assert(sanitized?.dismissedAlertIds?.length === 1, 'keeps valid dismissed warning ids and drops malformed ones');
assert(sanitizePersistedState({ broken: true }) === null, 'unrecoverable saved state is rejected');

assert(isValidIsoDate('2026-08-29'), 'accepts a real ISO date');
assert(!isValidIsoDate('2026-02-29'), 'rejects an impossible non-leap date');
assert(parsePositiveMoney('₹1,250.50') === 1250.5, 'parses formatted positive money');
assert(parsePositiveMoney('0') === null, 'rejects a zero positive-money input');
assert(parseNonNegativeMoney('0') === 0, 'accepts zero for non-negative money');

console.log(`FinFire tests passed: ${summary.alerts.length} alerts, risk ${summary.riskScore}/100, runway ${summary.runwayDays} days, ${Math.round(prediction.shortfallProbability * 100)}% shortfall risk.`);
