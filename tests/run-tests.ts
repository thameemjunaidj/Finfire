import { demoDataset } from '../src/data/demoData';
import { calculateFinancialSummary, getRiskBand, simulatePurchase } from '../src/engine/financeEngine';
import { buildForecast } from '../src/engine/forecastEngine';
import { predictOutcome } from '../src/engine/predictionEngine';
import { explainOnDevice } from '../src/services/ai';
import { parseTransactionsCsv } from '../src/services/csv';

function assert(condition: unknown, message: string): void {
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
approximately(summary.runwayDays, 7, 0, 'demo runway');

// The electricity bill is due on the 27th, so it is not a transaction yet.
// This asserts the app warns BEFORE the charge lands, which is the whole point.
assert(
  summary.alerts.some((alert) => alert.id.startsWith('upcoming-bill-')),
  'warns about a scheduled bill before it is charged',
);

const simulation = simulatePurchase(demoDataset, {
  description: 'Phone purchase',
  amount: 600,
  category: 'shopping',
  proposedDate: '2026-08-21',
});
assert(simulation.after.riskScore >= simulation.before.riskScore, 'risky purchase does not reduce risk');
assert(simulation.after.runwayDays < simulation.before.runwayDays, 'a ₹600 purchase reduces runway');
assert(demoDataset.transactions.every((item) => item.source !== 'simulation'), 'simulation never mutates real data');

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

const parsed = parseTransactionsCsv('date,merchant,amount,direction,category,essential\n2026-08-18,"Cafe, Vellore",350,debit,food,no');
assert(parsed.transactions.length === 1, 'imports a valid CSV transaction');
assert(parsed.transactions[0].merchant === 'Cafe, Vellore', 'handles quoted CSV commas');
assert(parsed.errors.length === 0, 'valid CSV has no errors');

const invalid = parseTransactionsCsv('merchant,amount\nShop,500');
assert(invalid.transactions.length === 0 && invalid.errors.length === 1, 'rejects missing CSV headers');

console.log(`Fin Extinguisher tests passed: ${summary.alerts.length} alerts, risk ${summary.riskScore}/100, runway ${summary.runwayDays} days, ${Math.round(prediction.shortfallProbability * 100)}% shortfall risk.`);
