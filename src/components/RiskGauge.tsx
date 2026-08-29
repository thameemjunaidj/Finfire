import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { RiskBand } from '../types/finance';
import { riskColor } from '../utils/format';

export function RiskGauge({ score, band, explanation }: { score: number; band: RiskBand; explanation: string }) {
  const accent = riskColor(band);
  return (
    <View
      accessible
      accessibilityLabel={`Money health ${band}, score ${score} out of 100. ${explanation}`}
      style={[styles.card, { borderColor: `${accent}80` }]}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR MONEY HEALTH</Text>
          <Text style={[styles.band, { color: accent }]}>{band}</Text>
        </View>
        <View style={[styles.scoreCircle, { borderColor: accent, backgroundColor: `${accent}15` }]}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.outOf}>/100</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${Math.max(4, score)}%`, backgroundColor: accent }]} />
      </View>
      <Text style={styles.explanation}>{explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderRadius: radii.xl, padding: spacing.xl, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  band: { fontSize: 25, fontWeight: '900', marginTop: spacing.xs },
  scoreCircle: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingTop: 20 },
  score: { color: colors.text, fontSize: 27, fontWeight: '900' },
  outOf: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  track: { height: 8, borderRadius: radii.pill, backgroundColor: colors.backgroundRaised, marginTop: spacing.xl, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: radii.pill },
  explanation: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
});
