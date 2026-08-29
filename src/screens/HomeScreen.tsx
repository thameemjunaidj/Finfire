import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCard } from '../components/AlertCard';
import { AlertDetailsModal } from '../components/AlertDetailsModal';
import { MetricCard } from '../components/MetricCard';
import { RiskGauge } from '../components/RiskGauge';
import { Screen, SectionTitle } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { FinancialAlert } from '../types/finance';
import { formatCurrency, riskColor } from '../utils/format';

export function HomeScreen({ onViewAlerts, onOpenSettings }: { onViewAlerts: () => void; onOpenSettings: () => void }) {
  const { profile, summary } = useFinance();
  const [selectedAlert, setSelectedAlert] = useState<FinancialAlert | null>(null);
  const maxSpend = Math.max(...summary.monthlySpend.map((item) => item.amount), 1);
  const month = new Date(`${profile.analysisDate ?? new Date().toISOString().slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <>
      <Screen
        title={`Hello, ${profile.name}`}
        subtitle={`${month} · Your financial early-warning dashboard`}
        action={<Pressable accessibilityLabel="Open settings" onPress={onOpenSettings} style={styles.settings}><Feather name="settings" size={19} color={colors.textSecondary} /></Pressable>}
      >
        <RiskGauge score={summary.riskScore} band={summary.riskBand} explanation={summary.riskExplanation} />
        <View style={styles.metrics}>
          <MetricCard label="Available balance" value={formatCurrency(summary.disposableBalance)} helper={`${formatCurrency(summary.protectedBalance)} after essential dues`} icon="credit-card" accent={colors.safe} />
          <MetricCard label="Money runway" value={`${summary.runwayDays} days`} helper="At your recent flexible-spend pace" icon="battery-charging" accent={riskColor(summary.riskBand)} />
          <MetricCard label="Projected spend" value={formatCurrency(summary.projectedMonthlySpending, true)} helper={`${formatCurrency(summary.normalMonthlySpending, true)} recent average`} icon="trending-up" accent={colors.primary} />
          <MetricCard label="Due in 7 days" value={formatCurrency(summary.upcomingPaymentsTotal)} helper={`${summary.upcomingPaymentsCount} automatic payments`} icon="calendar" accent={colors.watch} />
        </View>
        <SectionTitle title="Spending trend" />
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}><Text style={styles.chartLabel}>Monthly debits</Text><Text style={styles.chartValue}>{formatCurrency(summary.currentMonthSpending)}</Text></View>
          <View style={styles.chart}>
            {summary.monthlySpend.map((item, index) => {
              const active = index === summary.monthlySpend.length - 1;
              return (
                <View key={`${item.month}-${index}`} style={styles.barGroup}>
                  <Text style={styles.barValue}>{formatCurrency(item.amount, true)}</Text>
                  <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(7, (item.amount / maxSpend) * 100)}%`, backgroundColor: active ? colors.primary : colors.border }]} /></View>
                  <Text style={[styles.monthLabel, active && { color: colors.primary }]}>{item.month}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <SectionTitle title="Urgent warnings" action={<Pressable onPress={onViewAlerts}><Text style={styles.link}>View all</Text></Pressable>} />
        {summary.alerts.slice(0, 3).map((alert) => <AlertCard key={alert.id} alert={alert} onPress={() => setSelectedAlert(alert)} />)}
        {!summary.alerts.length ? <View style={styles.empty}><Feather name="check-circle" size={26} color={colors.safe} /><Text style={styles.emptyTitle}>No urgent warnings</Text><Text style={styles.emptyText}>FinFire will explain any material change it detects.</Text></View> : null}
      </Screen>
      <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  settings: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  chartCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  chartValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  chart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  barGroup: { flex: 1, height: '100%', alignItems: 'center' },
  barValue: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginBottom: 4 },
  barTrack: { flex: 1, width: '56%', minWidth: 22, backgroundColor: colors.backgroundRaised, borderRadius: radii.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: radii.sm },
  monthLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 5 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', backgroundColor: colors.safeSoft, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: `${colors.safe}50` },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
