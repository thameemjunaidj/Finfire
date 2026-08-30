import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { signOutOfAccount } from '../services/auth';
import { scheduleRiskNotification } from '../services/notifications';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { confirmAction, showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { formatDate } from '../utils/format';
import { isDateOnOrAfter, parseNonNegativeMoney, parsePositiveMoney } from '../utils/validation';
import { BackupCard } from './BackupCard';
import { FinButton } from './FinButton';
import { DatePickerField } from './DatePickerField';
import { FormField } from './FormField';

type SettingsView = 'main' | 'profile';

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    profile,
    notificationsEnabled,
    setNotificationsEnabled,
    updateProfile,
    signedInAs,
    sessionToken,
    signOut,
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

  /**
   * Signing out clears the session on the server as well as this phone, so a
   * token that leaks from a lost device stops working. It is best-effort: if
   * the network is down we still forget it locally, because refusing to sign
   * someone out of their own phone would be the worse failure.
   */
  const leave = () => confirmAction({
    title: 'Sign out?',
    message: signedInAs
      ? `You will need your password to sign back in as ${signedInAs}. Your spending stays on this phone.`
      : 'Your spending stays on this phone.',
    confirmLabel: 'Sign out',
    destructive: true,
    onConfirm: () => {
      if (sessionToken) void signOutOfAccount(sessionToken);
      signOut();
      close();
    },
  });

  /**
   * Wiping the phone.
   *
   * Worth keeping even though it is easy to mistake for a testing aid: an app
   * that claims your data is yours has to have a way to get rid of it that is
   * not "uninstall and hope". It says plainly that the backup is a separate
   * thing, because deleting one and assuming the other went too is exactly the
   * mistake someone would make.
   */
  const wipe = () => confirmAction({
    title: 'Erase everything on this phone?',
    message: 'Your spending, your details and your settings are removed from this device. '
      + 'This cannot be undone. Any backup you have saved is separate and stays until you delete it too.',
    confirmLabel: 'Erase',
    destructive: true,
    onConfirm: () => void eraseLocalData().then(close),
  });

  const close = () => {
    setView('main');
    onClose();
  };

  const testNotification = async () => {
    const shown = await scheduleRiskNotification(`🔥 ${APP_NAME} is ready`, 'Urgent money warnings will appear here when enabled.');
    showMessage(
      shown ? 'Notification sent' : 'Unavailable here',
      shown ? 'Check your notifications.' : 'Notifications need permission and work on Android or iPhone.',
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
      showMessage('Check your details', `Enter valid amounts and an income date on or after ${analysisDate}.`);
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
    showMessage('Details updated', 'Your money score and warnings are now up to date.');
  };


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
              <Text style={styles.title}>{view === 'profile' ? 'Edit your money details' : 'Settings & privacy'}</Text>
              <Text style={styles.subtitle}>{view === 'profile' ? `Information updated to ${formatDate(profile.analysisDate ?? toIsoDate(new Date()), true)}` : 'Your information stays on this device.'}</Text>
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
                    <Text style={styles.rowHelper}>Edit your balance, income, next income date and essential bills.</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>

                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Warnings on my phone</Text>
                    <Text style={styles.rowHelper}>Show a notification when a tested purchase may cause a problem.</Text>
                  </View>
                  <Switch
                    accessibilityLabel="Warnings on my phone"
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>

                <View style={styles.privacyCard}>
                  <Feather name="shield" size={22} color={colors.safe} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Private on this device</Text>
                    <Text style={styles.rowHelper}>{APP_NAME} never asks for bank passwords, PINs, CVVs or UPI PINs. Imported files stay on this device.</Text>
                  </View>
                </View>

                <FinButton label="Test notification" icon="bell" variant="secondary" disabled={!notificationsEnabled} onPress={() => void testNotification()} />
                <View style={styles.action}><BackupCard /></View>
                <FinButton label="Sign out" icon="log-out" variant="secondary" onPress={leave} style={styles.action} />
                <FinButton label="Erase everything on this phone" icon="trash-2" variant="danger" onPress={wipe} style={styles.action} />
                <Text style={styles.version}>{APP_NAME} 1.1 · Sample, manually added and imported information only</Text>
              </>
            ) : (
              <View>
                <FormField label="Your name" value={name} onChangeText={setName} placeholder="e.g. Thameem" />
                <FormField label="Monthly income (₹)" value={income} onChangeText={setIncome} keyboardType="decimal-pad" placeholder="48000" />
                <FormField label="Money currently available (₹)" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="18500" />
                <DatePickerField
                  label="When does your next money arrive?"
                  value={nextIncomeDate}
                  onChange={setNextIncomeDate}
                  earliest={toIsoDate(new Date())}
                  latest={`${new Date().getFullYear() + 1}-12-31`}
                />
<FormField label="Essential bills each month (₹)" value={essentials} onChangeText={setEssentials} keyboardType="decimal-pad" placeholder="14500" />
                <View style={styles.recalculationNote}>
                  <Feather name="refresh-cw" size={16} color={colors.primary} />
                  <Text style={styles.noteText}>Saving updates every warning. Your existing spending entries stay unchanged.</Text>
                </View>
                <FinButton label="Save changes" icon="check" onPress={saveProfile} style={styles.save} />
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
