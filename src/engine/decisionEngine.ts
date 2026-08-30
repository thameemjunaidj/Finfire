import { FinancialSummary, MoneyOutlook, RiskBand, SpendingForecast } from '../types/finance';
import { formatCurrency } from '../utils/format';

const riskLevels: Record<RiskBand, MoneyOutlook['riskLevel']> = {
  Safe: 'LOW',
  Caution: 'MODERATE',
  'High Risk': 'HIGH',
  Critical: 'CRITICAL',
};

/**
 * Turns the finance engine's facts into one plain-language decision.
 * It does not calculate money or use a language model; it only prioritises
 * already-computed facts so every screen tells the same story.
 */
export function buildMoneyOutlook(summary: FinancialSummary, forecast: SpendingForecast): MoneyOutlook {
  const spendingPace = Math.max(0, forecast.currentDailyPace);
  const baselineDaily = forecast.baselineWeeklySpending > 0
    ? forecast.baselineWeeklySpending / 7
    : 0;
  const spendingPaceChange = baselineDaily > 0
    ? Math.round(((spendingPace - baselineDaily) / baselineDaily) * 100)
    : null;
  const fastestCategory = [...forecast.categories]
    .filter((item) => item.discretionary && item.trendPercentage > 15)
    .sort((a, b) => b.trendPercentage - a.trendPercentage)[0];
  const mainAlert = summary.alerts[0];

  if (!summary.hasSpendingHistory) {
    return {
      riskLevel: riskLevels[summary.riskBand],
      headline: 'Add spending to check whether your money will last.',
      mainReason: 'There is not enough spending history to estimate your daily pace yet.',
      recommendedAction: 'Add a few recent payments or import a statement.',
      spendingPace,
      spendingPaceChange,
    };
  }

  const headline = summary.expectedToLastUntilIncome
    ? 'Your money is expected to last until your next income.'
    : `At your current pace, you may run short ${summary.shortfallDays} ${summary.shortfallDays === 1 ? 'day' : 'days'} early.`;

  let mainReason = mainAlert?.message ?? 'Your recent spending and upcoming payments look manageable.';
  if (!summary.expectedToLastUntilIncome) {
    mainReason = `You have ${formatCurrency(summary.protectedBalance)} left after essential payments, but your recent pace needs more to reach the next income.`;
  } else if (fastestCategory) {
    const label = fastestCategory.category.charAt(0).toUpperCase() + fastestCategory.category.slice(1);
    mainReason = `${label} spending is ${Math.round(fastestCategory.trendPercentage)}% above your recent normal.`;
  } else if (spendingPaceChange !== null && spendingPaceChange > 15) {
    mainReason = `Your daily spending pace is ${spendingPaceChange}% above your recent normal.`;
  }

  return {
    riskLevel: riskLevels[summary.riskBand],
    headline,
    mainReason,
    recommendedAction: mainAlert?.recommendation
      ?? `Keep optional spending near ${formatCurrency(summary.safeDailySpending)} a day until your next income.`,
    spendingPace,
    spendingPaceChange,
  };
}
