import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FinButton } from '../components/FinButton';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { formatCurrency } from '../utils/format';

export type InsightPage = 'overview' | 'forecast' | 'alerts' | 'assistant';

export function InsightsScreen({ onOpen }: { onOpen: (page: Exclude<InsightPage, 'overview'>) => void }) {
  const { summary, outlook, forecast } = useFinance();
  const facts = [
    ['Spending pace', `${formatCurrency(forecast.currentDailyPace)} a day`],
    ['Recurring payments due', `${formatCurrency(summary.upcomingPaymentsTotal)} in the next 7 days`],
    ['After essential payments', formatCurrency(summary.protectedBalance)],
    ['Days until next income', String(summary.daysUntilNextIncome)],
    ['Safe daily spending', formatCurrency(summary.safeDailySpending)],
  ];

  return (
    <Screen title="Why this result?" subtitle="The few facts that matter before your next income.">
      <View style={styles.reasonCard}>
        <Text style={styles.eyebrow}>MAIN REASON</Text>
        <Text style={styles.reason}>{outlook.mainReason}</Text>
        <Text style={styles.actionLabel}>WHAT TO DO</Text>
        <Text style={styles.action}>{outlook.recommendedAction}</Text>
      </View>

      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.factRow}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>More detail</Text>
      <FinButton label="See spending forecast" icon="trending-up" variant="secondary" onPress={() => onOpen('forecast')} />
      <FinButton label={`See all warnings (${summary.alerts.length})`} icon="alert-triangle" variant="secondary" onPress={() => onOpen('alerts')} style={styles.buttonGap} />
      <FinButton label="Ask about a money decision" icon="message-circle" variant="secondary" onPress={() => onOpen('assistant')} style={styles.buttonGap} />

      <Pressable style={styles.method} onPress={() => onOpen('forecast')}>
        <Feather name="info" size={15} color={colors.textMuted} />
        <Text style={styles.methodText}>FinFire uses your recorded spending and upcoming payments. These are explainable estimates, not guaranteed predictions.</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reasonCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.primary, padding: spacing.xl },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  reason: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '900', marginTop: spacing.sm },
  actionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: spacing.xl },
  action: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  facts: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  factLabel: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  factValue: { color: colors.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: spacing.xxl, marginBottom: spacing.md },
  buttonGap: { marginTop: spacing.sm },
  method: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.lg, marginTop: spacing.lg },
  methodText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, flex: 1 },
});
