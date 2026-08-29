import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChoiceChips } from '../components/ChoiceChips';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { scheduleRiskNotification } from '../services/notifications';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { SimulationResult, TransactionCategory } from '../types/finance';
import { formatCurrency, riskColor } from '../utils/format';

const simulatorCategories: TransactionCategory[] = ['shopping', 'food', 'entertainment', 'transport', 'health', 'other'];

export function SimulatorScreen() {
  const { profile, runSimulation, notificationsEnabled } = useFinance();
  const [description, setDescription] = useState('New phone purchase');
  const [amount, setAmount] = useState('5000');
  const [category, setCategory] = useState<TransactionCategory>('shopping');
  const [date, setDate] = useState(profile.analysisDate ?? new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const numericAmount = Number(amount);
  const canSimulate = numericAmount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const quickAmounts = useMemo(() => ['1000', '2500', '5000', '10000'], []);
  const simulate = () => {
    if (!canSimulate) return;
    setResult(runSimulation({ description: description.trim() || 'Hypothetical purchase', amount: numericAmount, category, proposedDate: date }));
  };
  const notify = async () => {
    if (!result) return;
    const shown = await scheduleRiskNotification(
      `🔥 ${APP_NAME} purchase warning`,
      `This ${formatCurrency(result.input.amount)} purchase could change your runway from ${result.before.runwayDays} to ${result.after.runwayDays} days.`,
    );
    Alert.alert(shown ? 'Warning sent' : 'Use your phone to test', shown ? 'The local notification is ready.' : 'Browser preview cannot display native notifications.');
  };
  return (
    <Screen title="What if?" subtitle="Preview a purchase without changing your real transaction data.">
      <View style={styles.formCard}>
        <View style={styles.formHeader}><View style={styles.formIcon}><Feather name="sliders" size={20} color={colors.primary} /></View><View><Text style={styles.formTitle}>Purchase impact</Text><Text style={styles.formHelper}>All five detectors rerun instantly.</Text></View></View>
        <FormField label="Purchase description" value={description} onChangeText={setDescription} placeholder="e.g. New phone" />
        <FormField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="5000" />
        <View style={styles.quickRow}>{quickAmounts.map((value) => <Text key={value} onPress={() => setAmount(value)} style={[styles.quickAmount, amount === value && styles.quickActive]}>{formatCurrency(Number(value))}</Text>)}</View>
        <Text style={styles.label}>Category</Text>
        <ChoiceChips values={simulatorCategories} selected={category} onSelect={setCategory} />
        <View style={styles.dateField}><FormField label="Proposed date (YYYY-MM-DD)" value={date} onChangeText={setDate} /></View>
        <FinButton label="Run safety check" icon="activity" disabled={!canSimulate} onPress={simulate} />
      </View>
      {result ? (
        <View style={styles.resultWrap}>
          <View style={[styles.verdict, { borderColor: riskColor(result.verdict), backgroundColor: `${riskColor(result.verdict)}16` }]}>
            <View><Text style={styles.verdictEyebrow}>{`${APP_NAME.toUpperCase()} VERDICT`}</Text><Text style={[styles.verdictValue, { color: riskColor(result.verdict) }]}>{result.verdict}</Text></View>
            <Feather name={result.riskChange > 0 ? 'alert-triangle' : 'check-circle'} size={28} color={riskColor(result.verdict)} />
          </View>
          <View style={styles.comparison}>
            <Comparison label="Risk score" before={`${result.before.riskScore}/100`} after={`${result.after.riskScore}/100`} change={result.riskChange} />
            <Comparison label="Money runway" before={`${result.before.runwayDays} days`} after={`${result.after.runwayDays} days`} change={result.runwayChange} />
            <Comparison label="Projected spend" before={formatCurrency(result.before.projectedMonthlySpending)} after={formatCurrency(result.after.projectedMonthlySpending)} change={result.after.projectedMonthlySpending - result.before.projectedMonthlySpending} />
          </View>
          <View style={styles.advice}>
            <Feather name="shield" size={20} color={colors.safe} />
            <Text style={styles.adviceText}>{result.riskChange > 0 ? `Waiting or reducing this purchase by ${formatCurrency(Math.min(result.input.amount, Math.max(1000, result.input.amount / 2)))} would protect more of your runway.` : 'This purchase does not materially increase the risks currently detected.'}</Text>
          </View>
          {notificationsEnabled && result.riskChange > 0 ? <FinButton label="Send warning to my phone" icon="bell" variant="secondary" onPress={() => void notify()} style={styles.notifyButton} /> : null}
          <Text style={styles.nonMutation}>Simulation only — your balance and transactions were not changed.</Text>
        </View>
      ) : (
        <View style={styles.emptyResult}><Feather name="eye" size={26} color={colors.textMuted} /><Text style={styles.emptyTitle}>Your result will appear here</Text><Text style={styles.emptyText}>Try the demo ₹5,000 purchase to see {APP_NAME} prevent damage rather than report it later.</Text></View>
      )}
    </Screen>
  );
}

function Comparison({ label, before, after, change }: { label: string; before: string; after: string; change: number }) {
  const adverse = label === 'Money runway' ? change < 0 : change > 0;
  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <Text style={styles.comparisonBefore}>{before}</Text>
      <Feather name="arrow-right" size={15} color={colors.textMuted} />
      <Text style={[styles.comparisonAfter, adverse && { color: colors.critical }]}>{after}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  formIcon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  formHelper: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -4, marginBottom: spacing.lg },
  quickAmount: { color: colors.textSecondary, backgroundColor: colors.backgroundRaised, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 7, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  quickActive: { color: colors.primary, backgroundColor: colors.primarySoft, borderColor: colors.primary },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  dateField: { marginTop: spacing.lg },
  resultWrap: { marginTop: spacing.lg },
  verdict: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verdictEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  verdictValue: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  comparison: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  comparisonLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', flex: 1 },
  comparisonBefore: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  comparisonAfter: { color: colors.text, fontSize: 14, fontWeight: '900', minWidth: 65, textAlign: 'right' },
  advice: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.safeSoft, borderRadius: radii.md, borderWidth: 1, borderColor: `${colors.safe}50`, padding: spacing.lg, marginTop: spacing.md },
  adviceText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1, fontWeight: '700' },
  notifyButton: { marginTop: spacing.md },
  nonMutation: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: spacing.md },
  emptyResult: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.xxl, marginTop: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4, maxWidth: 420 },
});
