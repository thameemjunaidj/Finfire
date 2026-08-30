import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FinButton } from '../components/FinButton';
import { Screen, SectionTitle } from '../components/Screen';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { formatCurrency, formatDate, riskColor } from '../utils/format';

interface HomeScreenProps {
  onExplainRisk: () => void;
  onOpenSimulator: () => void;
  onOpenTransactions: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({ onExplainRisk, onOpenSimulator, onOpenTransactions, onOpenSettings }: HomeScreenProps) {
  const { profile, summary, outlook, transactions, recurringPayments } = useFinance();
  const recent = [...transactions]
    .filter((item) => item.direction === 'debit' && item.source !== 'simulation')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const upcoming = recurringPayments
    .filter((item) => item.nextPaymentDate >= (profile.analysisDate ?? ''))
    .filter((item) => item.nextPaymentDate <= profile.nextIncomeDate)
    .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
  const statusColor = riskColor(summary.riskBand);

  return (
    <Screen
      title={profile.name ? `Good morning, ${profile.name}` : 'Your money'}
      subtitle={profile.id.startsWith('demo-') ? 'Student demo account' : 'Your early warning for the next income'}
      action={<Pressable accessibilityLabel="Open settings" onPress={onOpenSettings} style={styles.settings}><Feather name="settings" size={19} color={colors.textSecondary} /></Pressable>}
    >
      <View style={styles.hero}>
        <Text style={styles.balance}>{formatCurrency(summary.disposableBalance)}</Text>
        <Text style={styles.balanceLabel}>available now</Text>
        <Text style={styles.incomeLine}>
          {summary.daysUntilNextIncome} {summary.daysUntilNextIncome === 1 ? 'day' : 'days'} until your next allowance · {formatDate(profile.nextIncomeDate)}
        </Text>

        <View style={[styles.status, { borderColor: statusColor }]}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{outlook.riskLevel} RISK</Text>
          <Text style={styles.headline}>{outlook.headline}</Text>
        </View>

        <View style={styles.reason}>
          <Text style={styles.eyebrow}>MAIN REASON</Text>
          <Text style={styles.reasonText}>{outlook.mainReason}</Text>
        </View>

        <View style={styles.actionBox}>
          <Feather name="arrow-right-circle" size={20} color={colors.primary} />
          <View style={styles.actionCopy}>
            <Text style={styles.eyebrow}>WHAT TO DO</Text>
            <Text style={styles.actionText}>{outlook.recommendedAction}</Text>
          </View>
        </View>

        <FinButton label="Why am I at risk?" icon="help-circle" onPress={onExplainRisk} />
        <FinButton label="Can I afford something?" icon="shopping-bag" variant="secondary" onPress={onOpenSimulator} style={styles.secondaryButton} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricLabel}>Safe daily spend</Text><Text style={styles.metricValue}>{formatCurrency(summary.safeDailySpending)}</Text></View>
        <View style={styles.metric}><Text style={styles.metricLabel}>After essential payments</Text><Text style={styles.metricValue}>{formatCurrency(summary.protectedBalance)}</Text></View>
      </View>

      <SectionTitle title="Payments before allowance" />
      <View style={styles.supportCard}>
        {upcoming.length ? upcoming.slice(0, 3).map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <View style={styles.paymentCopy}><Text style={styles.paymentName}>{payment.merchant}</Text><Text style={styles.paymentDate}>Due {formatDate(payment.nextPaymentDate)}</Text></View>
            <Text style={styles.paymentAmount}>{formatCurrency(payment.currentAmount)}</Text>
          </View>
        )) : <Text style={styles.emptyText}>No recurring payments are recorded before your next allowance.</Text>}
      </View>

      <SectionTitle title="Recent spending" action={<Pressable onPress={onOpenTransactions}><Text style={styles.link}>See all</Text></Pressable>} />
      <View style={styles.supportCard}>
        {recent.length ? recent.map((item) => <TransactionRow key={item.id} transaction={item} />) : (
          <Pressable onPress={onOpenTransactions} style={styles.emptyAction}>
            <Text style={styles.emptyText}>Add recent spending so FinFire can check whether your money will last.</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  settings: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  balance: { color: colors.text, fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.2 },
  balanceLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  incomeLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, marginBottom: spacing.xl },
  status: { borderTopWidth: 2, paddingTop: spacing.lg },
  statusLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  headline: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '900', marginTop: spacing.sm },
  reason: { backgroundColor: colors.backgroundRaised, borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  reasonText: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '800', marginTop: 5 },
  actionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginVertical: spacing.lg },
  actionCopy: { flex: 1 },
  actionText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  secondaryButton: { marginTop: spacing.sm },
  metrics: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  metric: { flex: 1, backgroundColor: colors.backgroundRaised, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  metricLabel: { color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 6 },
  supportCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  paymentCopy: { flex: 1 },
  paymentName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  paymentDate: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  paymentAmount: { color: colors.text, fontSize: 14, fontWeight: '900' },
  link: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  emptyAction: { paddingVertical: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, paddingVertical: spacing.lg },
});
