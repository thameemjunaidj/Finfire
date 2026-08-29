import { demoDataset } from '../src/data/demoData';
import { calculateFinancialSummary, getRiskBand, simulatePurchase } from '../src/engine/financeEngine';
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
assert(types.has('bill_anomaly'), 'detects an unusual electricity bill');
assert(types.has('subscription_increase'), 'detects the Adobe subscription increase');
assert(types.has('payment_pileup'), 'detects three payments due in seven days');
assert(types.has('low_runway'), 'detects a low money runway');
assert(summary.riskScore >= 0 && summary.riskScore <= 100, 'clamps risk score to 0–100');
assert(summary.upcomingPaymentsCount === 3, 'counts three upcoming payments');
approximately(summary.upcomingPaymentsTotal, 6199, 0, 'upcoming total');
approximately(summary.runwayDays, 9, 0, 'demo runway');

const simulation = simulatePurchase(demoDataset, {
  description: 'Phone purchase',
  amount: 5000,
  category: 'shopping',
  proposedDate: '2026-08-18',
});
assert(simulation.after.riskScore >= simulation.before.riskScore, 'risky purchase does not reduce risk');
assert(simulation.after.runwayDays < simulation.before.runwayDays, '₹5,000 purchase reduces runway');
approximately(simulation.after.runwayDays, 5, 0, 'simulated runway');
assert(demoDataset.transactions.every((item) => item.source !== 'simulation'), 'simulation never mutates real data');

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

console.log(`FinFire tests passed: ${summary.alerts.length} alerts, risk ${summary.riskScore}/100, runway ${summary.runwayDays} days.`);
