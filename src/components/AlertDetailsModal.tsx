import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { FinancialAlert } from '../types/finance';
import { severityBackground, severityColor, titleCase } from '../utils/format';
import { FinButton } from './FinButton';

export function AlertDetailsModal({ alert, onClose }: { alert: FinancialAlert | null; onClose: () => void }) {
  if (!alert) return null;
  const accent = severityColor(alert.severity);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={[styles.icon, { backgroundColor: severityBackground(alert.severity) }]}>
              <Feather name="alert-triangle" size={24} color={accent} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.severity, { color: accent }]}>{titleCase(alert.severity)} warning</Text>
              <Text style={styles.title}>{alert.title}</Text>
            </View>
          </View>
          <Text style={styles.message}>{alert.message}</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{`WHY ${APP_NAME.toUpperCase()} FLAGGED THIS`}</Text>
            <Text style={styles.infoText}>{alert.evidence}</Text>
          </View>
          <View style={[styles.infoCard, { borderColor: `${colors.safe}55`, backgroundColor: colors.safeSoft }]}>
            <Text style={[styles.infoLabel, { color: colors.safe }]}>ACTION TO TAKE NOW</Text>
            <Text style={styles.infoText}>{alert.recommendation}</Text>
          </View>
          <Text style={styles.disclaimer}>This is an informational warning based on local data, not regulated financial advice.</Text>
          <FinButton label="Got it" onPress={onClose} style={styles.button} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 680, backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, paddingBottom: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl },
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  severity: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.lg },
  infoCard: { backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.md },
  infoLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  infoText: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: spacing.sm, fontWeight: '700' },
  disclaimer: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: spacing.lg },
  button: { marginTop: spacing.lg },
});
