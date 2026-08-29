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
import { APP_NAME } from '../theme/brand';
import { FinancialAlert } from '../types/finance';
import { toIsoDate } from '../utils/dates';
import { formatCurrency, formatDate, riskColor } from '../utils/format';

export function HomeScreen({ onViewAlerts, onOpenSettings }: { onViewAlerts: () => void; onOpenSettings: () => void }) {
  const { profile, summary } = useFinance();
  const [selectedAlert, setSelectedAlert] = useState<FinancialAlert | null>(null);
  const maxSpend = Math.max(...summary.monthlySpend.map((item) => item.amount), 1);
  const dashboardDate = profile.analysisDate ?? toIsoDate(new Date());
  const month = new Date(`${dashboardDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <>
      <Screen
        title={`Hello, ${profile.name}`}
        subtitle={`${month} · Your financial early-warning dashboard`}
        action={<Pressable accessibilityLabel="Open settings" onPress={onOpenSettings} style={styles.settings}><Feather name="settings" size={19} color={colors.textSecondary} /></Pressable>}
      >
        <View style={styles.dataStatus} accessible accessibilityLabel={`${profile.id.startsWith('demo-') ? 'Demo' : 'Local'} data evaluated ${formatDate(dashboardDate, true)}`}>
          <Feather name={profile.id.startsWith('demo-') ? 'play-circle' : 'lock'} size={14} color={colors.primary} />
          <Text style={styles.dataStatusText}>{profile.id.startsWith('demo-') ? 'DEMO DATA' : 'LOCAL PROFILE'} · Evaluated {formatDate(dashboardDate, true)}</Text>
        </View>
        <RiskGauge score={summary.riskScore} band={summary.riskBand} explanation={summary.riskExplanation} />
        {/* Two metrics, not four. Projected spend and upcoming payments both
            now live on the Forecast tab, where they have room to be explained;
            repeating them here was a large part of what made this screen read
            as a wall of numbers. */}
        <View style={styles.metrics}>
          <MetricCard label="Available balance" value={formatCurrency(summary.disposableBalance)} helper={`${formatCurrency(summary.protectedBalance)} after essential dues`} icon="credit-card" accent={colors.safe} />
          <MetricCard label="Money runway" value={`${summary.runwayDays} days`} helper="At your recent flexible-spend pace" icon="battery-charging" accent={riskColor(summary.riskBand)} />
        </View>
        <SectionTitle title="Spending trend" />
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}><Text style={styles.chartLabel}>Monthly debits</Text><Text style={styles.chartValue}>{formatCurrency(summary.currentMonthSpending)}</Text></View>
          <View style={styles.chart}>
            {summary.monthlySpend.map((item, index) => {
              const active = index === summary.monthlySpend.length - 1;
              return (
                <View key={`${item.month}-${index}`} style={styles.barGroup} accessible accessibilityLabel={`${item.month} spending ${formatCurrency(item.amount)}`}>
                  <Text style={styles.barValue}>{formatCurrency(item.amount, true)}</Text>
                  <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(7, (item.amount / maxSpend) * 100)}%`, backgroundColor: active ? colors.primary : colors.border }]} /></View>
                  <Text style={[styles.monthLabel, active && { color: colors.primary }]}>{item.month}</Text>
                </View>
              );
            })}
          </View>
        </View>
<<<<<<< HEAD
        <SectionTitle title="Needs attention" action={<Pressable onPress={onViewAlerts}><Text style={styles.link}>View all</Text></Pressable>} />
        {/* Two, not three — Home is a glance, the Alerts tab is the full list. */}
        {summary.alerts.slice(0, 2).map((alert) => <AlertCard key={alert.id} alert={alert} onPress={() => setSelectedAlert(alert)} />)}
        {summary.alerts.length > 2 ? (
          <Pressable onPress={onViewAlerts} style={styles.moreRow}>
            <Text style={styles.moreText}>{summary.alerts.length - 2} more</Text>
            <Feather name="arrow-right" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
=======
        <SectionTitle title="Top warnings" action={<Pressable accessibilityRole="button" accessibilityLabel="View all warnings" onPress={onViewAlerts}><Text style={styles.link}>View all</Text></Pressable>} />
        {summary.alerts.slice(0, 3).map((alert) => <AlertCard key={alert.id} alert={alert} onPress={() => setSelectedAlert(alert)} />)}
>>>>>>> d76e5acd6e84024390df24c3ee9ff98c69ab238a
        {!summary.alerts.length ? <View style={styles.empty}><Feather name="check-circle" size={26} color={colors.safe} /><Text style={styles.emptyTitle}>No urgent warnings</Text><Text style={styles.emptyText}>{APP_NAME} will explain any material change it detects.</Text></View> : null}
      </Screen>
      <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  settings: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dataStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: `${colors.primary}55`, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 7, marginBottom: spacing.md },
  dataStatusText: { color: colors.primary, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
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
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
  moreText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: colors.safeSoft, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: `${colors.safe}50` },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
