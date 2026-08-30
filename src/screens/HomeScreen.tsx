import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCard } from '../components/AlertCard';
import { AlertDetailsModal } from '../components/AlertDetailsModal';
import { MetricCard } from '../components/MetricCard';
import { RiskGauge } from '../components/RiskGauge';
import { Screen, SectionTitle } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { MINIMUM_HISTORY_DAYS } from '../engine/financeEngine';
import { colors, radii, spacing } from '../theme/colors';
import { FinancialAlert } from '../types/finance';
import { toIsoDate } from '../utils/dates';
import { formatCurrency, formatDate, formatWhenKnown, healthColor, healthFromRisk } from '../utils/format';

export function HomeScreen({ onViewAlerts, onOpenSettings, onAddSpending }: {
  onViewAlerts: () => void;
  onOpenSettings: () => void;
  /** Jumps to the Spending tab with the "add money" sheet already open. */
  onAddSpending: () => void;
}) {
  const { profile, summary, transactions } = useFinance();
  const [selectedAlert, setSelectedAlert] = useState<FinancialAlert | null>(null);
  const maxSpend = Math.max(...summary.monthlySpend.map((item) => item.amount), 1);
  const dashboardDate = profile.analysisDate ?? toIsoDate(new Date());
  const month = new Date(`${dashboardDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <>
      <Screen
        title={profile.name ? `Hello, ${profile.name}` : 'Your money'}
        subtitle={`${month} · A simple look at your money`}
        action={<Pressable accessibilityLabel="Open settings" onPress={onOpenSettings} hitSlop={10} style={styles.settings}><Feather name="settings" size={19} color={colors.textSecondary} /></Pressable>}
      >
        <View style={styles.dataStatus} accessible accessibilityLabel={`${profile.id.startsWith('demo-') ? 'Demo' : 'Local'} data evaluated ${formatDate(dashboardDate, true)}`}>
          <Feather name={profile.id.startsWith('demo-') ? 'play-circle' : 'lock'} size={14} color={colors.primary} />
          <Text style={styles.dataStatusText}>{profile.id.startsWith('demo-') ? 'SAMPLE ACCOUNT' : 'YOUR DATA'} · Updated {formatDate(dashboardDate, true)}</Text>
        </View>
        {/* A brand-new account used to land on a screen of zeroes with no clue
            what to do. Everything below needs spending to mean anything, so
            until there is some, this is the whole screen. */}
        {/* This used to be a card that TOLD you to go to the Spending tab.
            Telling someone where to tap, on a screen you could have made
            tappable, is a dead end with instructions written on it. */}
        {transactions.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your first payment"
            onPress={onAddSpending}
            style={({ pressed }) => [styles.firstRun, pressed && styles.firstRunPressed]}
          >
            <Feather name="plus-circle" size={28} color={colors.primary} />
            <Text style={styles.firstRunTitle}>Add your first few payments</Text>
            <Text style={styles.firstRunText}>
              Tap here to add what you have spent, or import a statement from your bank. After a
              week of spending this screen starts warning you about what is coming.
            </Text>
            <View style={styles.firstRunCta}>
              <Text style={styles.firstRunCtaText}>Add a payment</Text>
              <Feather name="arrow-right" size={14} color={colors.black} />
            </View>
          </Pressable>
        ) : null}

        {transactions.length > 0 ? (
          <>
        {/* A score needs something to score. Until there is a week of
            spending behind it, this says how far off that is instead of
            inventing a number — ₹2,000 of pocket money with ₹1,500 already
            gone was reading as perfect health, because nothing had been
            watched for long enough to look wrong. */}
        {summary.hasEnoughHistory ? (
          <RiskGauge score={summary.riskScore} band={summary.riskBand} explanation={summary.riskExplanation} />
        ) : (
          <View style={styles.building}>
            <View style={styles.buildingTop}>
              <View>
                <Text style={styles.buildingEyebrow}>YOUR MONEY HEALTH</Text>
                <Text style={styles.buildingTitle}>Still learning</Text>
              </View>
              <View style={styles.buildingCount}>
                <Text style={styles.buildingCountText}>
                  {Math.min(summary.daysOfHistory, MINIMUM_HISTORY_DAYS)}/{MINIMUM_HISTORY_DAYS}
                </Text>
              </View>
            </View>
            <View style={styles.buildingTrack}>
              <View
                style={[
                  styles.buildingFill,
                  { width: `${Math.max(5, Math.min(100, (summary.daysOfHistory / MINIMUM_HISTORY_DAYS) * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.buildingText}>
              {`A week of spending is what it takes to tell an unusual day from an ordinary one. `
                + `${MINIMUM_HISTORY_DAYS - Math.min(summary.daysOfHistory, MINIMUM_HISTORY_DAYS)} more days to go — `
                + `or import a bank statement and fill it in at once.`}
            </Text>
          </View>
        )}
        {/* Two metrics, not four. Projected spend and upcoming payments both
            now live on the Forecast tab, where they have room to be explained;
            repeating them here was a large part of what made this screen read
            as a wall of numbers. */}
        <View style={styles.metrics}>
          <MetricCard label="Money left" value={formatCurrency(summary.disposableBalance)} helper={`${formatCurrency(summary.protectedBalance)} after essential bills`} icon="credit-card" accent={colors.safe} />
          <MetricCard
            label="How long it may last"
            value={formatWhenKnown(summary.hasEnoughHistory, `${summary.runwayDays} days`)}
            helper={summary.hasEnoughHistory
              ? 'Based on your recent optional spending'
              : `Needs ${MINIMUM_HISTORY_DAYS} days of spending`}
            icon="battery-charging"
            accent={summary.hasEnoughHistory
              ? healthColor(healthFromRisk(summary.riskScore))
              : colors.textMuted}
          />
        </View>
        <SectionTitle title="Monthly spending" />
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}><Text style={styles.chartLabel}>Spent this month</Text><Text style={styles.chartValue}>{formatCurrency(summary.currentMonthSpending)}</Text></View>
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
        <SectionTitle title="What needs attention" action={<Pressable accessibilityRole="button" accessibilityLabel="View all warnings" onPress={onViewAlerts}><Text style={styles.link}>View all</Text></Pressable>} />
        {/* Two, not three — Home is a glance, the Alerts tab is the full list. */}
        {summary.alerts.slice(0, 2).map((alert) => <AlertCard key={alert.id} alert={alert} onPress={() => setSelectedAlert(alert)} />)}
        {summary.alerts.length > 2 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="View remaining warnings" onPress={onViewAlerts} style={styles.moreRow}>
            <Text style={styles.moreText}>{summary.alerts.length - 2} more</Text>
            <Feather name="arrow-right" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
          </>
        ) : null}
        {transactions.length > 0 && !summary.alerts.length ? <View style={styles.empty}><Feather name="check-circle" size={26} color={colors.safe} /><Text style={styles.emptyTitle}>Everything looks okay</Text><Text style={styles.emptyText}>We will tell you when something needs attention.</Text></View> : null}
      </Screen>
      <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  firstRun: {
    alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.lg,
  },
  firstRunPressed: { opacity: 0.85, borderColor: colors.high },
  firstRunTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  firstRunText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  firstRunCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 10, paddingHorizontal: spacing.xl,
  },
  firstRunCtaText: { color: colors.black, fontSize: 13, fontWeight: '900' },

  building: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.xl, padding: spacing.xl, gap: spacing.md,
  },
  buildingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buildingEyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  buildingTitle: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: spacing.xs },
  buildingCount: {
    borderWidth: 2, borderColor: colors.border, borderRadius: radii.pill,
    paddingVertical: 8, paddingHorizontal: spacing.lg,
  },
  buildingCountText: { color: colors.textSecondary, fontSize: 15, fontWeight: '900' },
  buildingTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.backgroundRaised, overflow: 'hidden' },
  buildingFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  buildingText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
