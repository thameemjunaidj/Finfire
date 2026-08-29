import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { FinancialAlert } from '../types/finance';
import { severityBackground, severityColor, titleCase } from '../utils/format';

export function AlertCard({ alert, onPress }: { alert: FinancialAlert; onPress?: () => void }) {
  const accent = severityColor(alert.severity);
  const icon = alert.type === 'spending_surge' ? 'trending-up'
    : alert.type === 'bill_anomaly' ? 'zap'
      : alert.type === 'subscription_increase' ? 'repeat'
        : alert.type === 'payment_pileup' ? 'calendar'
          : 'battery';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${titleCase(alert.severity)} warning: ${alert.title}. ${alert.message}`}
      accessibilityHint={onPress ? 'Opens evidence and recommended action' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: severityBackground(alert.severity) }]}>
        <Feather name={icon} size={19} color={accent} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={[styles.badge, { color: accent, backgroundColor: severityBackground(alert.severity) }]}>{titleCase(alert.severity)}</Text>
        </View>
        <Text style={styles.message}>{alert.message}</Text>
        <View style={styles.evidenceRow}>
          <Feather name="bar-chart-2" size={13} color={colors.textMuted} />
          <Text style={styles.evidence}>{alert.evidence}</Text>
        </View>
      </View>
      {onPress ? <Feather name="chevron-right" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderLeftWidth: 4, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  icon: { width: 38, height: 38, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontWeight: '900', flex: 1 },
  badge: { fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill, overflow: 'hidden' },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  evidence: { color: colors.textMuted, fontSize: 11, fontWeight: '700', flex: 1 },
});
