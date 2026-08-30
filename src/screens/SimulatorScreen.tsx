import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceChips } from '../components/ChoiceChips';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { scheduleRiskNotification } from '../services/notifications';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { SimulationResult, TransactionCategory } from '../types/finance';
import { showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { formatCurrency, formatWhenKnown, healthColor, healthFromRisk, healthLabel } from '../utils/format';
import { isDateOnOrAfter, isValidIsoDate, parsePositiveMoney } from '../utils/validation';

const simulatorCategories: TransactionCategory[] = ['shopping', 'food', 'entertainment', 'transport', 'health', 'other'];

export function SimulatorScreen() {
  const { profile, runSimulation, notificationsEnabled } = useFinance();
  const [description, setDescription] = useState('New phone purchase');
  const [amount, setAmount] = useState('5000');
  const [category, setCategory] = useState<TransactionCategory>('shopping');
  const [date, setDate] = useState(profile.analysisDate ?? toIsoDate(new Date()));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const numericAmount = parsePositiveMoney(amount);
  const analysisDate = profile.analysisDate ?? toIsoDate(new Date());
  const canSimulate = numericAmount !== null
    && isValidIsoDate(date)
    && isDateOnOrAfter(date, analysisDate)
    && date <= profile.nextIncomeDate;
  const quickAmounts = useMemo(() => ['1000', '2500', '5000', '10000'], []);
  useEffect(() => {
    setDate(profile.analysisDate ?? toIsoDate(new Date()));
    setResult(null);
  }, [profile.id, profile.analysisDate, profile.nextIncomeDate]);
  const simulate = () => {
    if (!canSimulate) return;
    setResult(runSimulation({ description: description.trim() || 'Hypothetical purchase', amount: numericAmount as number, category, proposedDate: date }));
  };
  const notify = async () => {
    if (!result) return;
    const shown = await scheduleRiskNotification(
      `🔥 ${APP_NAME} purchase warning`,
      result.before.hasSpendingHistory
        ? `This ${formatCurrency(result.input.amount)} purchase could reduce how long your money lasts from ${result.before.runwayDays} to ${result.after.runwayDays} days.`
        : `This ${formatCurrency(result.input.amount)} purchase would leave you with ${formatCurrency(result.after.disposableBalance)}. Add some spending and I can also tell you how long that would last.`,
    );
    showMessage(shown ? 'Warning sent' : 'Use your phone to test', shown ? 'The local notification is ready.' : 'Browser preview cannot display native notifications.');
  };
  // The colour of the whole result block, taken from where health lands AFTER
  // the purchase — which is the thing the person is actually asking about.
  const verdictColor = result ? healthColor(healthFromRisk(result.after.riskScore)) : colors.safe;
  return (
    <Screen title="Try a purchase" subtitle="See what may happen before you spend the money.">
      <View style={styles.formCard}>
        <View style={styles.formHeader}><View style={styles.formIcon}><Feather name="sliders" size={20} color={colors.primary} /></View><View><Text style={styles.formTitle}>Check a purchase</Text><Text style={styles.formHelper}>We will update your money health and days left.</Text></View></View>
        <FormField label="What do you want to buy?" value={description} onChangeText={setDescription} placeholder="e.g. New phone" />
        <FormField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5000" />
        <View style={styles.quickRow}>{quickAmounts.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Use ${formatCurrency(Number(value))}`}
            onPress={() => setAmount(value)}
            style={[styles.quickAmount, amount === value && styles.quickActive]}
          >
            <Text style={[styles.quickAmountText, amount === value && styles.quickActiveText]}>{formatCurrency(Number(value))}</Text>
          </Pressable>
        ))}</View>
        <Text style={styles.label}>What type of purchase is it?</Text>
        <ChoiceChips values={simulatorCategories} selected={category} onSelect={setCategory} />
        <View style={styles.dateField}><FormField label="When would you buy it? (YYYY-MM-DD)" value={date} onChangeText={setDate} /></View>
        <Text style={styles.dateHelper}>Choose a date from {analysisDate} through {profile.nextIncomeDate}.</Text>
        <FinButton label="Check this purchase" icon="activity" disabled={!canSimulate} onPress={simulate} />
      </View>
      {result ? (
        <View style={styles.resultWrap}>
          <View style={[styles.verdict, { borderColor: verdictColor, backgroundColor: `${verdictColor}16` }]}>
            <View><Text style={styles.verdictEyebrow}>RESULT</Text><Text style={[styles.verdictValue, { color: verdictColor }]}>{healthLabel(result.verdict)}</Text></View>
            <Feather name={result.riskChange > 0 ? 'alert-triangle' : 'check-circle'} size={28} color={verdictColor} />
          </View>
          <View style={styles.comparison}>
            {/* Health, not risk — and so the arrow now means the opposite of
                what riskChange says, hence the minus. */}
            <Comparison
              label="Money health"
              before={`${healthFromRisk(result.before.riskScore)}/100`}
              after={`${healthFromRisk(result.after.riskScore)}/100`}
              change={-result.riskChange}
              higherIsBetter
            />
            <Comparison
              label="How long money may last"
              before={formatWhenKnown(result.before.hasSpendingHistory, `${result.before.runwayDays} days`)}
              after={formatWhenKnown(result.after.hasSpendingHistory, `${result.after.runwayDays} days`)}
              change={result.before.hasSpendingHistory ? result.runwayChange : 0}
              higherIsBetter
            />
            <Comparison label="Likely month total" before={formatCurrency(result.before.projectedMonthlySpending)} after={formatCurrency(result.after.projectedMonthlySpending)} change={result.after.projectedMonthlySpending - result.before.projectedMonthlySpending} />
          </View>
          <View style={styles.advice}>
            <Feather name="shield" size={20} color={colors.safe} />
            <Text style={styles.adviceText}>{result.riskChange > 0 ? `You may be safer if you wait or spend ${formatCurrency(Math.min(result.input.amount, Math.max(1000, result.input.amount / 2)))} less.` : 'This purchase does not make your current money situation noticeably worse.'}</Text>
          </View>
          {notificationsEnabled && result.riskChange > 0 ? <FinButton label="Send warning to my phone" icon="bell" variant="secondary" onPress={() => void notify()} style={styles.notifyButton} /> : null}
          <Text style={styles.nonMutation}>This is only a test. Nothing was added to your spending or balance.</Text>
        </View>
      ) : (
        <View style={styles.emptyResult}><Feather name="eye" size={26} color={colors.textMuted} /><Text style={styles.emptyTitle}>Your result will appear here</Text><Text style={styles.emptyText}>Try the sample ₹5,000 purchase to see how buying it could affect your month.</Text></View>
      )}
    </Screen>
  );
}

/**
 * `higherIsBetter` used to be inferred by comparing the label to a string,
 * which quietly broke the moment a label was reworded — and one was, when the
 * money score became money health. It is a prop now.
 */
function Comparison({ label, before, after, change, higherIsBetter = false }: { label: string; before: string; after: string; change: number; higherIsBetter?: boolean }) {
  const adverse = higherIsBetter ? change < 0 : change > 0;
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
  quickAmount: { backgroundColor: colors.backgroundRaised, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 7, overflow: 'hidden' },
  quickAmountText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  quickActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  quickActiveText: { color: colors.primary },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  dateField: { marginTop: spacing.lg },
  dateHelper: { color: colors.textMuted, fontSize: 10, marginTop: -spacing.sm, marginBottom: spacing.lg },
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
