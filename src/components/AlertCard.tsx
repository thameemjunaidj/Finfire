import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { AlertSeverity, FinancialAlert } from '../types/finance';
import { plainLabel } from '../utils/format';

/**
 * Alert card.
 *
 * The three severities used to differ only by a slightly different red on a
 * 4px stripe, which meant "high" and "critical" looked the same at arm's
 * length. They now differ by WEIGHT, not just hue:
 *
 *   critical — filled: red-tinted card, thick bar, solid red badge, solid icon
 *   high     — outlined: plain card, thin bar, red outline badge, tinted icon
 *   watch    — quiet: no bar, no fill, grey badge and grey icon
 *
 * Read as a column, that reads as loud / medium / quiet before any of the
 * words are processed — and it survives being photographed from the back of
 * a room, which a pair of similar reds does not.
 */

interface Tier {
  barWidth: number;
  cardBackground: string;
  borderColor: string;
  iconBackground: string;
  iconColor: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeColor: string;
  titleSize: number;
  titleColor: string;
}

const TIERS: Record<AlertSeverity, Tier> = {
  critical: {
    barWidth: 5,
    cardBackground: colors.criticalSoft,
    borderColor: colors.critical,
    iconBackground: colors.critical,
    iconColor: colors.black,
    badgeBackground: colors.critical,
    badgeBorder: colors.critical,
    badgeColor: colors.black,
    titleSize: 16,
    titleColor: colors.text,
  },
  high: {
    barWidth: 3,
    cardBackground: colors.surface,
    borderColor: colors.border,
    iconBackground: colors.highSoft,
    iconColor: colors.high,
    badgeBackground: 'transparent',
    badgeBorder: colors.high,
    badgeColor: colors.high,
    titleSize: 15,
    titleColor: colors.text,
  },
  watch: {
    barWidth: 0,
    cardBackground: colors.background,
    borderColor: colors.border,
    iconBackground: colors.surfaceRaised,
    iconColor: colors.textMuted,
    badgeBackground: 'transparent',
    badgeBorder: 'transparent',
    badgeColor: colors.textMuted,
    titleSize: 14,
    titleColor: colors.textSecondary,
  },
};

function iconFor(type: FinancialAlert['type']): keyof typeof Feather.glyphMap {
  if (type === 'spending_surge') return 'trending-up';
  if (type === 'bill_anomaly') return 'zap';
  if (type === 'subscription_increase') return 'repeat';
  if (type === 'payment_pileup') return 'calendar';
  return 'battery';
}

export function AlertCard({ alert, onPress }: { alert: FinancialAlert; onPress?: () => void }) {
  const tier = TIERS[alert.severity];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${plainLabel(alert.severity)} warning: ${alert.title}. ${alert.message}`}
      accessibilityHint={onPress ? 'Opens evidence and recommended action' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: tier.cardBackground,
          borderColor: tier.borderColor,
          borderLeftWidth: tier.barWidth,
          borderLeftColor: tier.borderColor,
          paddingLeft: spacing.lg - tier.barWidth,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tier.iconBackground }]}>
        <Feather name={iconFor(alert.type)} size={17} color={tier.iconColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { fontSize: tier.titleSize, color: tier.titleColor }]}>
            {alert.title}
          </Text>
          <Text
            style={[
              styles.badge,
              {
                color: tier.badgeColor,
                backgroundColor: tier.badgeBackground,
                borderColor: tier.badgeBorder,
              },
            ]}
          >
            {plainLabel(alert.severity)}
          </Text>
        </View>

        {/* The evidence line moved into the detail modal. Three stacked lines
            per card across five cards was the bulk of the wall of numbers. */}
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
      </View>

      {onPress ? <Feather name="chevron-right" size={17} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  icon: { width: 34, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontWeight: '900', flex: 1 },
  badge: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
//Typescript(specifically TSX — TypeScript with JSX)
