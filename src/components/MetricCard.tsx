import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: keyof typeof Feather.glyphMap;
  accent?: string;
}

export function MetricCard({ label, value, helper, icon, accent = colors.primary }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: `${accent}20` }]}>
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.helper} numberOfLines={2}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 150, flexGrow: 1, flexBasis: '46%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  value: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  helper: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
