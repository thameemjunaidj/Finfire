import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { useFinance } from '../context/FinanceContext';
import { FinancialAlert } from '../types/finance';
import { plainLabel, severityBackground, severityColor } from '../utils/format';
import { FinButton } from './FinButton';

/**
 * "Got it" means got it.
 *
 * It used to just close the sheet, so the warning stayed in the list and the
 * badge kept counting it — which teaches people that acknowledging a warning
 * does nothing, and then they stop reading them. Now it clears the warning and
 * the count drops with it.
 */
export function AlertDetailsModal({ alert, onClose }: { alert: FinancialAlert | null; onClose: () => void }) {
  const { dismissAlert } = useFinance();

  const acknowledge = () => {
    if (alert) dismissAlert(alert.id);
    onClose();
  };

  if (!alert) return null;
  const accent = severityColor(alert.severity);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={[styles.icon, { backgroundColor: severityBackground(alert.severity) }]}>
                <Feather name="alert-triangle" size={24} color={accent} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.severity, { color: accent }]}>{plainLabel(alert.severity)} warning</Text>
                <Text style={styles.title}>{alert.title}</Text>
              </View>
            </View>
            <Text style={styles.message}>{alert.message}</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>WHY YOU ARE SEEING THIS</Text>
              <Text style={styles.infoText}>{alert.evidence}</Text>
            </View>
            <View style={[styles.infoCard, { borderColor: `${colors.safe}55`, backgroundColor: colors.safeSoft }]}>
              <Text style={[styles.infoLabel, { color: colors.safe }]}>WHAT YOU CAN DO</Text>
              <Text style={styles.infoText}>{alert.recommendation}</Text>
            </View>
            <Text style={styles.disclaimer}>This is based on the information in the app. It is guidance, not financial advice.</Text>
            <FinButton label="Got it" onPress={acknowledge} style={styles.button} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
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
