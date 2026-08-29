import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { scheduleRiskNotification } from '../services/notifications';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { confirmAction, showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { formatDate } from '../utils/format';
import { isDateOnOrAfter, parseNonNegativeMoney, parsePositiveMoney } from '../utils/validation';
import { FinButton } from './FinButton';
import { FormField } from './FormField';

type SettingsView = 'main' | 'profile';

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    profile,
    notificationsEnabled,
    setNotificationsEnabled,
    updateProfile,
    resetDemo,
    eraseLocalData,
  } = useFinance();
  const [view, setView] = useState<SettingsView>('main');
  const [name, setName] = useState(profile.name);
  const [income, setIncome] = useState(String(profile.monthlyIncome));
  const [balance, setBalance] = useState(String(profile.availableBalance));
  const [nextIncomeDate, setNextIncomeDate] = useState(profile.nextIncomeDate);
  const [essentials, setEssentials] = useState(String(profile.essentialMonthlyExpenses));

  useEffect(() => {
    if (!visible) return;
    setName(profile.name);
    setIncome(String(profile.monthlyIncome));
    setBalance(String(profile.availableBalance));
    setNextIncomeDate(profile.nextIncomeDate);
    setEssentials(String(profile.essentialMonthlyExpenses));
  }, [profile, visible]);

  const close = () => {
    setView('main');
    onClose();
  };

  const testNotification = async () => {
    const shown = await scheduleRiskNotification(`🔥 ${APP_NAME} is ready`, 'Critical financial warnings will appear here when enabled.');
    showMessage(
      shown ? 'Notification sent' : 'Unavailable here',
      shown ? 'Check your notification centre.' : 'Local notifications require an Android or iPhone build with permission enabled.',
    );
  };

  const saveProfile = () => {
    const monthlyIncome = parsePositiveMoney(income);
    const availableBalance = parseNonNegativeMoney(balance);
    const essentialMonthlyExpenses = parseNonNegativeMoney(essentials);
    const analysisDate = profile.analysisDate ?? toIsoDate(new Date());
    if (
      !name.trim()
      || monthlyIncome === null
      || availableBalance === null
      || essentialMonthlyExpenses === null
      || !isDateOnOrAfter(nextIncomeDate, analysisDate)
    ) {
      showMessage('Check your profile', `Use valid amounts and an income date on or after ${analysisDate}.`);
      return;
    }
    updateProfile({
      ...profile,
      name: name.trim(),
      monthlyIncome,
      availableBalance,
      nextIncomeDate,
      essentialMonthlyExpenses,
    });
    setView('main');
    showMessage('Profile updated', 'Your risk score and warnings have been recalculated.');
  };

  const restoreDemo = () => confirmAction({
    title: 'Restore demo data?',
    message: 'This replaces the current profile, transactions, and scheduled payments with the original Arjun demo.',
    confirmLabel: 'Restore',
    destructive: true,
    onConfirm: () => {
      resetDemo();
      close();
    },
  });

  const erase = () => confirmAction({
    title: 'Erase local data?',
    message: 'This removes the profile, imported transactions, and manual entries from this device.',
    confirmLabel: 'Erase',
    destructive: true,
    onConfirm: () => void eraseLocalData().then(close),
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              {view === 'profile' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={() => setView('main')} style={styles.backLink}>
                  <Feather name="arrow-left" size={16} color={colors.primary} />
                  <Text style={styles.backText}>Settings</Text>
                </Pressable>
              ) : null}
              <Text style={styles.title}>{view === 'profile' ? 'Edit financial profile' : 'Settings & privacy'}</Text>
              <Text style={styles.subtitle}>{view === 'profile' ? `Dashboard date: ${formatDate(profile.analysisDate ?? toIsoDate(new Date()), true)}` : 'Your prototype data stays on this device.'}</Text>
            </View>
            <Pressable accessibilityLabel="Close settings" onPress={close} style={styles.close}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            {view === 'main' ? (
              <>
                <Pressable accessibilityRole="button" onPress={() => setView('profile')} style={styles.profileCard}>
                  <View style={styles.profileIcon}><Feather name="user" size={20} color={colors.primary} /></View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{profile.name}</Text>
                    <Text style={styles.rowHelper}>Edit balance, income, next income date, and essential spending.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Critical notifications</Text>
                    <Text style={styles.rowHelper}>Allow local warnings after risky simulations.</Text>
                  </View>
                  <Switch
                    accessibilityLabel="Critical notifications"
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>

                <View style={styles.privacyCard}>
                  <Feather name="shield" size={22} color={colors.safe} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Offline-first by design</Text>
                    <Text style={styles.rowHelper}>{APP_NAME} never asks for bank passwords, PINs, CVVs, or UPI PINs. Imported CSV data is stored locally.</Text>
                  </View>
                </View>

                <FinButton label="Test notification" icon="bell" variant="secondary" disabled={!notificationsEnabled} onPress={() => void testNotification()} />
                <FinButton label="Restore demo data" icon="refresh-cw" variant="ghost" onPress={restoreDemo} style={styles.action} />
                <FinButton label="Erase local data" icon="trash-2" variant="danger" onPress={erase} style={styles.action} />
                <Text style={styles.version}>{APP_NAME} 1.1 · Demo, manual, and user-imported data only</Text>
              </>
            ) : (
              <View>
                <FormField label="Your name" value={name} onChangeText={setName} placeholder="e.g. Thameem" />
                <FormField label="Monthly income (₹)" value={income} onChangeText={setIncome} keyboardType="decimal-pad" placeholder="48000" />
                <FormField label="Available balance (₹)" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="18500" />
                <FormField label="Next income date (YYYY-MM-DD)" value={nextIncomeDate} onChangeText={setNextIncomeDate} placeholder="2026-09-01" />
                <FormField label="Essential monthly expenses (₹)" value={essentials} onChangeText={setEssentials} keyboardType="decimal-pad" placeholder="14500" />
                <View style={styles.recalculationNote}>
                  <Feather name="refresh-cw" size={16} color={colors.primary} />
                  <Text style={styles.noteText}>Saving immediately recalculates all five detectors. Existing transactions are preserved.</Text>
                </View>
                <FinButton label="Save profile" icon="check" onPress={saveProfile} style={styles.save} />
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A6', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  panel: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, padding: spacing.xl, paddingBottom: spacing.md },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  backText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  scrollContent: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primarySoft, borderColor: `${colors.primary}55`, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  profileIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}20` },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  rowHelper: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  privacyCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.safeSoft, borderColor: `${colors.safe}50`, borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, marginVertical: spacing.lg },
  action: { marginTop: spacing.sm },
  version: { color: colors.textMuted, textAlign: 'center', fontSize: 10, marginTop: spacing.lg },
  recalculationNote: { flexDirection: 'row', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: `${colors.primary}55`, backgroundColor: colors.primarySoft, padding: spacing.md },
  noteText: { color: colors.textSecondary, fontSize: 10.5, lineHeight: 16, flex: 1 },
  save: { marginTop: spacing.lg },
});
