import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { FinancialSummary, SimulationResult } from '../types/finance';
import { toIsoDate } from '../utils/dates';
import { formatCurrency, formatDate, riskColor } from '../utils/format';
import { parsePositiveMoney } from '../utils/validation';

export function SimulatorScreen() {
  const { profile, runSimulation } = useFinance();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const numericAmount = parsePositiveMoney(amount);
  const purchaseDate = profile.analysisDate ?? toIsoDate(new Date());

  useEffect(() => setResult(null), [profile.id, profile.analysisDate, profile.nextIncomeDate]);

  const simulate = () => {
    if (numericAmount === null) return;
    setResult(runSimulation({
      description: description.trim() || 'Purchase',
      amount: numericAmount,
      category: 'shopping',
      proposedDate: purchaseDate,
    }));
  };

  return (
    <Screen title="Can I afford it?" subtitle="Test a purchase before the money leaves your account.">
      <View style={styles.formCard}>
        <FormField label="What do you want to buy?" value={description} onChangeText={setDescription} placeholder="e.g. Concert ticket" />
        <FormField label="How much does it cost? (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="800" />
        <FinButton label="Check this purchase" icon="check-circle" disabled={numericAmount === null} onPress={simulate} />
        <Text style={styles.hypothetical}>This is only a test. It will not change your balance or spending.</Text>
      </View>

      {result ? <PurchaseResult result={result} nextIncomeDate={profile.nextIncomeDate} /> : (
        <View style={styles.empty}>
          <Feather name="shopping-bag" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Enter a purchase to see the trade-off</Text>
          <Text style={styles.emptyText}>FinFire will compare your money before and after the purchase, using your recent spending pace.</Text>
        </View>
      )}
    </Screen>
  );
}

function moneyLasts(summary: FinancialSummary, nextIncomeDate: string): string {
  if (!summary.hasSpendingHistory) return 'Not enough history';
  if (summary.expectedToLastUntilIncome) return `Through ${formatDate(nextIncomeDate)}`;
  return summary.moneyLastingDate ? `Until ${formatDate(summary.moneyLastingDate)}` : 'Runs short before income';
}

function balanceAtIncome(summary: FinancialSummary): string {
  if (summary.estimatedBalanceAtNextIncome === null) return 'Not enough history';
  return summary.estimatedBalanceAtNextIncome >= 0
    ? `${formatCurrency(summary.estimatedBalanceAtNextIncome)} left`
    : `${formatCurrency(Math.abs(summary.estimatedBalanceAtNextIncome))} short`;
}

function PurchaseResult({ result, nextIncomeDate }: { result: SimulationResult; nextIncomeDate: string }) {
  const labels = {
    recommended: 'Looks affordable',
    caution: 'Be careful',
    not_recommended: 'Not recommended',
  } as const;
  const decisionColor = result.decision === 'recommended'
    ? colors.safe
    : result.decision === 'caution' ? colors.watch : colors.critical;

  return (
    <View style={styles.result}>
      <View style={[styles.verdict, { borderColor: decisionColor }]}>
        <Text style={[styles.verdictText, { color: decisionColor }]}>{labels[result.decision]}</Text>
        <Text style={styles.verdictReason}>{result.explanation}</Text>
      </View>

      <Text style={styles.nextIncome}>Next allowance: {formatDate(nextIncomeDate)}</Text>
      <View style={styles.comparison}>
        <Outcome title="WITHOUT PURCHASE" summary={result.before} nextIncomeDate={nextIncomeDate} />
        <View style={styles.divider} />
        <Outcome title={`WITH ${formatCurrency(result.input.amount)} PURCHASE`} summary={result.after} nextIncomeDate={nextIncomeDate} />
      </View>
    </View>
  );
}

function Outcome({ title, summary, nextIncomeDate }: { title: string; summary: FinancialSummary; nextIncomeDate: string }) {
  return (
    <View style={styles.outcome}>
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.outcomeDate}>{moneyLasts(summary, nextIncomeDate)}</Text>
      <View style={styles.factRow}><Text style={styles.factLabel}>Risk</Text><Text style={[styles.factValue, { color: riskColor(summary.riskBand) }]}>{summary.riskBand.toUpperCase()}</Text></View>
      <View style={styles.factRow}><Text style={styles.factLabel}>At next allowance</Text><Text style={styles.factValue}>{balanceAtIncome(summary)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  hypothetical: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: spacing.md },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.xxl, marginTop: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4, maxWidth: 420 },
  result: { marginTop: spacing.lg },
  verdict: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 2, padding: spacing.xl },
  verdictText: { fontSize: 25, fontWeight: '900' },
  verdictReason: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  nextIncome: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center', marginVertical: spacing.lg },
  comparison: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border },
  outcome: { padding: spacing.xl },
  outcomeTitle: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  outcomeDate: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.sm, marginBottom: spacing.lg },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  factLabel: { color: colors.textMuted, fontSize: 12 },
  factValue: { color: colors.text, fontSize: 12, fontWeight: '900', textAlign: 'right' },
});
