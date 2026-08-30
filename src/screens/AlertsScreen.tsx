import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCard } from '../components/AlertCard';
import { AlertDetailsModal } from '../components/AlertDetailsModal';
import { Screen } from '../components/Screen';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { FinancialAlert } from '../types/finance';

/**
 * Alerts, grouped rather than filtered.
 *
 * This screen used to show filter chips, a summary card and then every alert
 * at equal weight — which meant the first thing a worried person saw was a
 * control panel, and a "watch" notice sat next to a critical one looking
 * roughly as important.
 *
 * Now the things that need action are open at the top, and the quiet ones are
 * folded away behind a single line. Same information, one decision to make
 * instead of ten.
 */
export function AlertsScreen({ onBack }: { onBack?: () => void }) {
  const { summary } = useFinance();
  const [selected, setSelected] = useState<FinancialAlert | null>(null);
  const [showLower, setShowLower] = useState(false);

  const { urgent, lower } = useMemo(() => ({
    urgent: summary.alerts.filter((alert) => alert.severity !== 'watch'),
    lower: summary.alerts.filter((alert) => alert.severity === 'watch'),
  }), [summary.alerts]);

  const criticalCount = urgent.filter((alert) => alert.severity === 'critical').length;

  return (
    <>
      <Screen
        title="Warnings"
        subtitle={
          urgent.length
            ? `${urgent.length} ${urgent.length === 1 ? 'thing needs' : 'things need'} attention${criticalCount ? `, ${criticalCount} urgently` : ''}.`
            : 'Nothing needs attention right now.'
        }
        action={onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to insights" onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={19} color={colors.textSecondary} />
          </Pressable>
        ) : undefined}
      >
        {urgent.length > 0 ? (
          <View>
            {urgent.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onPress={() => setSelected(alert)} />
            ))}
          </View>
        ) : (
          <View style={styles.clear}>
            <Feather name="check-circle" size={26} color={colors.safe} />
            <Text style={styles.clearTitle}>Everything looks okay</Text>
            <Text style={styles.clearText}>
              Nothing in your spending looks unusual, and no bills are due together.
            </Text>
          </View>
        )}

        {lower.length > 0 ? (
          <View style={styles.lowerBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showLower }}
              onPress={() => setShowLower((current) => !current)}
              style={styles.lowerToggle}
            >
              <Text style={styles.lowerLabel}>
                {lower.length} other {lower.length === 1 ? 'warning' : 'warnings'}
              </Text>
              <Feather name={showLower ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </Pressable>

            {showLower ? (
              <View style={styles.lowerList}>
                {lower.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onPress={() => setSelected(alert)} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Tap a warning to see why it appeared and what you can do.
        </Text>
      </Screen>

      <AlertDetailsModal alert={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  clear: {
    alignItems: 'center',
    backgroundColor: colors.safeSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
  },
  clearTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: spacing.sm },
  clearText: { color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 18 },

  lowerBlock: { marginTop: spacing.lg },
  lowerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  lowerLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  lowerList: { marginTop: spacing.sm },

  footnote: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.xl },
});
