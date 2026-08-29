/**
 * ForecastScreen — "where does this month end, and what would change it?"
 *
 * Home answers what is wrong now. This answers what happens next, which is
 * the whole preventive premise of FinExtinguisher.
 */

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetricCard } from '../components/MetricCard';
import { Screen, SectionTitle } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { CategoryForecast, SavingsAction } from '../types/finance';
import { formatCurrency, titleCase } from '../utils/format';

/**
 * One category, drawn as two stacked bars: where it is heading, and what
 * normal looks like. Two bars side by side make "double your usual" land
 * instantly in a way a percentage never does.
 */
function CategoryRow({ item, widest }: { item: CategoryForecast; widest: number }) {
  const over = item.trendPercentage > 15;
  const projectedWidth = widest > 0 ? Math.max(4, (item.projectedMonthEnd / widest) * 100) : 4;
  const baselineWidth = widest > 0 ? Math.max(4, (item.baselineMonth / widest) * 100) : 4;

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryHead}>
        <Text style={styles.categoryName}>{titleCase(item.category)}</Text>
        <Text style={[styles.categoryValue, over && styles.categoryValueOver]}>
          {formatCurrency(item.projectedMonthEnd)}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${projectedWidth}%` }, over && styles.barFillOver]} />
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barBaseline, { width: `${baselineWidth}%` }]} />
      </View>

      <View style={styles.categoryFoot}>
        <Text style={styles.categoryHelper}>usual amount {formatCurrency(item.baselineMonth)}</Text>
        {over ? (
          <Text style={styles.trendUp}>+{Math.round(item.trendPercentage)}%</Text>
        ) : (
          <Text style={styles.trendFlat}>looks normal</Text>
        )}
      </View>
    </View>
  );
}

function ActionCard({ action, index }: { action: SavingsAction; index: number }) {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionHead}>
        <View style={styles.actionRank}>
          <Text style={styles.actionRankText}>{index + 1}</Text>
        </View>
        <Text style={styles.actionTitle}>{action.title}</Text>
      </View>
      <Text style={styles.actionDetail}>{action.detail}</Text>
      {action.dailyReduction > 0 ? (
        <View style={styles.actionChip}>
          <Feather name="trending-down" size={12} color={colors.primary} />
          <Text style={styles.actionChipText}>{formatCurrency(action.dailyReduction)} a day</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ForecastScreen() {
  const { forecast, prediction, narrative, learned } = useFinance();
  const widest = Math.max(
    ...forecast.categories.map((c) => Math.max(c.projectedMonthEnd, c.baselineMonth)),
    1,
  );

  const savingsShort = !forecast.onTrack;
  const chanceOutOf100 = Math.round(prediction.shortfallProbability * 100);
  const risky = prediction.shortfallProbability >= 0.2;

  return (
    <Screen
      title="Your month ahead"
      subtitle={`${forecast.daysRemaining} days left this month. Here is what may happen if nothing changes.`}
    >
      {/* ---- The prediction, in words first ---- */}
      <View style={[styles.predictionCard, risky && styles.predictionCardAlert]}>
        <Text style={[styles.predictionHeadline, risky && styles.predictionHeadlineAlert]}>
          {narrative.headline}
        </Text>

        {/* A bar rather than a bare percentage: "45%" means little on its own,
            but a bar that is nearly half full is understood instantly. */}
        <View style={styles.chanceRow}>
          <View style={styles.chanceTrack}>
            <View style={[styles.chanceFill, { width: `${Math.max(2, chanceOutOf100)}%` }]} />
          </View>
          <Text style={styles.chanceValue}>{chanceOutOf100}%</Text>
        </View>
        <Text style={styles.chanceCaption}>
          chance of running short before your next money arrives
        </Text>

        <Text style={styles.predictionBody}>{narrative.body}</Text>

        <View style={styles.methodBox}>
          {/* Says plainly that this is a sample account, so nobody in the room
              mistakes a demo figure for a real one — and flags what lands next. */}
          <View style={styles.demoChip}>
            <Text style={styles.demoChipText}>Based on the sample spending in this app</Text>
          </View>
          <Text style={styles.methodTitle}>How we worked this out</Text>
          <Text style={styles.methodText}>{prediction.method}</Text>
          <Text style={styles.methodText}>
            Based on {prediction.daysObserved} days of sample spending
          </Text>
        </View>
      </View>

      {/* ---- The headline: where this month ends ---- */}
      <View style={[styles.hero, savingsShort && styles.heroAlert]}>
        <Text style={styles.heroLabel}>
          {forecast.projectedSavings >= 0 ? 'You may save this month' : 'You may be short this month'}
        </Text>
        <Text style={[styles.heroValue, savingsShort && styles.heroValueAlert]}>
          {formatCurrency(Math.abs(forecast.projectedSavings))}
        </Text>
        <Text style={styles.heroHelper}>
          {savingsShort
            ? `${formatCurrency(forecast.savingsGap)} below your ${formatCurrency(forecast.savingsTarget)} savings goal if nothing changes.`
            : `You are on track to reach your ${formatCurrency(forecast.savingsTarget)} savings goal.`}
        </Text>

        <View style={styles.heroSplit}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Income</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(forecast.expectedIncome)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Likely spending</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(forecast.projectedMonthEndSpending)}</Text>
          </View>
        </View>
      </View>

      {/* ---- What the model worked out on its own ---- */}
      {learned.trained && learned.patterns.length > 0 ? (
        <View style={styles.learnedCard}>
          <Text style={styles.learnedTitle}>What this app has noticed about you</Text>
          {learned.patterns.map((pattern) => (
            <View key={pattern.id} style={styles.learnedRow}>
              <Text style={styles.learnedDot}>—</Text>
              <View style={styles.learnedText}>
                <Text style={styles.learnedHeading}>{pattern.title}</Text>
                <Text style={styles.learnedDetail}>{pattern.detail}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.learnedFoot}>
            Worked out on this phone from your last {learned.daysTrainedOn} days. Nobody else sees it.
          </Text>
        </View>
      ) : null}

      {/* ---- The numbers behind it ---- */}
      <View style={styles.metrics}>
        <MetricCard
          icon="calendar"
          label="Next 7 days"
          value={formatCurrency(forecast.projectedNextWeekSpending)}
          helper={`Last week you spent ${formatCurrency(forecast.lastWeekSpending)}`}
          accent={forecast.projectedNextWeekSpending > forecast.baselineWeeklySpending ? colors.critical : colors.safe}
        />
        <MetricCard
          icon="target"
          label="Daily spending limit"
          value={`${formatCurrency(forecast.safeDailyAllowance)}/day`}
          helper={`You are spending ${formatCurrency(forecast.currentDailyPace)} a day`}
          accent={forecast.currentDailyPace > forecast.safeDailyAllowance ? colors.critical : colors.safe}
        />
        <MetricCard
          icon="activity"
          label="Likely month total"
          value={formatCurrency(forecast.projectedMonthEndSpending, true)}
          helper={`You usually spend ${formatCurrency(forecast.baselineMonthlySpending, true)}`}
          accent={forecast.projectedMonthEndSpending > forecast.baselineMonthlySpending ? colors.critical : colors.safe}
        />
        <MetricCard
          icon="clock"
          label="Spent so far"
          value={formatCurrency(forecast.currentMonthSpending, true)}
          helper={`Over the first ${forecast.daysElapsed} days`}
          accent={colors.white}
        />
      </View>

      {/* ---- Category by category ---- */}
      <SectionTitle title="Likely spending by category" />
      <View style={styles.panel}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>likely</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchBaseline]} />
            <Text style={styles.legendText}>usual</Text>
          </View>
        </View>
        {forecast.categories.map((item) => (
          <CategoryRow key={item.category} item={item} widest={widest} />
        ))}
      </View>

      {/* ---- What to actually do ---- */}
      <SectionTitle title={savingsShort ? 'Simple ways to reach your goal' : 'Ways to save a little more'} />
      {forecast.actions.length > 0 ? (
        forecast.actions.map((action, index) => (
          <ActionCard key={action.id} action={action} index={index} />
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Your spending already looks normal in every category.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  learnedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  learnedTitle: {
    color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: spacing.md,
  },
  learnedRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  learnedDot: { color: colors.primary, fontSize: 13, fontWeight: '900', lineHeight: 19 },
  learnedText: { flex: 1 },
  learnedHeading: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  learnedDetail: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  learnedFoot: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  predictionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  predictionCardAlert: { borderColor: colors.primary },
  predictionHeadline: { color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 29, letterSpacing: -0.4 },
  predictionHeadlineAlert: { color: colors.primary },

  chanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  chanceTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.backgroundRaised, overflow: 'hidden' },
  chanceFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  chanceValue: { color: colors.text, fontSize: 18, fontWeight: '900', minWidth: 48, textAlign: 'right' },
  chanceCaption: { color: colors.textMuted, fontSize: 11, marginTop: 6 },

  predictionBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: spacing.xl },

  methodBox: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  demoChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: spacing.md,
  },
  demoChipText: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  methodTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  methodText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },

  hero: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  heroAlert: { borderColor: colors.primary, backgroundColor: colors.criticalSoft },
  heroLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  heroValue: { color: colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginTop: spacing.sm },
  heroValueAlert: { color: colors.primary },
  heroHelper: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  heroSplit: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: spacing.lg },
  heroStat: { flex: 1 },
  heroDivider: { width: 1, height: 30, backgroundColor: colors.border },
  heroStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  heroStatValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },

  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },

  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  legend: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendSwatchBaseline: { backgroundColor: colors.textMuted },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  categoryRow: { marginBottom: spacing.lg },
  categoryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  categoryName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  categoryValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
  categoryValueOver: { color: colors.primary },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: colors.backgroundRaised, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: colors.white },
  barFillOver: { backgroundColor: colors.primary },
  barBaseline: { height: 7, borderRadius: 4, backgroundColor: colors.textMuted, opacity: 0.55 },
  categoryFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  categoryHelper: { color: colors.textMuted, fontSize: 11 },
  trendUp: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  trendFlat: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },

  actionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionRank: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  actionRankText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  actionTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900' },
  actionDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.md },
  actionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingVertical: 5, paddingHorizontal: 10,
    marginTop: spacing.md,
  },
  actionChipText: { color: colors.primary, fontSize: 11, fontWeight: '900' },

  emptyCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, padding: spacing.xl,
  },
  emptyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
});
