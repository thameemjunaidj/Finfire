import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCard } from '../components/AlertCard';
import { AlertDetailsModal } from '../components/AlertDetailsModal';
import { ChoiceChips } from '../components/ChoiceChips';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { AlertSeverity, FinancialAlert } from '../types/finance';

type AlertFilter = 'all' | AlertSeverity;

export function AlertsScreen() {
  const { summary } = useFinance();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [selected, setSelected] = useState<FinancialAlert | null>(null);
  const alerts = useMemo(() => filter === 'all' ? summary.alerts : summary.alerts.filter((alert) => alert.severity === filter), [filter, summary.alerts]);
  return (
    <>
      <Screen title="Early warnings" subtitle="Every warning includes evidence and one concrete action.">
        <ChoiceChips values={['all', 'critical', 'high', 'watch']} selected={filter} onSelect={setFilter} />
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}><Feather name="activity" size={20} color={colors.primary} /></View>
          <View style={styles.summaryText}><Text style={styles.summaryTitle}>{summary.alerts.length} active signals</Text><Text style={styles.summaryHelper}>Ranked by severity and likely financial impact</Text></View>
        </View>
        <View style={styles.list}>
          {alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onPress={() => setSelected(alert)} />)}
          {!alerts.length ? <Text style={styles.empty}>No {filter === 'all' ? '' : filter} warnings right now.</Text> : null}
        </View>
      </Screen>
      <AlertDetailsModal alert={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.lg, borderWidth: 1, borderColor: `${colors.primary}55`, padding: spacing.lg, marginTop: spacing.lg },
  summaryIcon: { width: 40, height: 40, backgroundColor: `${colors.primary}22`, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1 },
  summaryTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  summaryHelper: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  list: { marginTop: spacing.lg },
  empty: { color: colors.textSecondary, textAlign: 'center', padding: spacing.xxl, backgroundColor: colors.surface, borderRadius: radii.lg },
});
